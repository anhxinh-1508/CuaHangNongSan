const OpenAI = require("openai");
const { Product, ProductBatch } = require("../models");
const { refreshBatchStatuses, sumAvailableStockForProductIds } = require("./inventory.service");
const env = require("../config/env");

function normalize(text) {
  return (text || "").toLowerCase();
}

/** Chuẩn hóa lịch sử hội thoại cho LLM: bỏ tin rỗng, không bắt đầu bằng assistant. */
function trimConversationForLLM(msgs) {
  const list = Array.isArray(msgs) ? msgs.slice(-24) : [];
  const out = [];
  for (const m of list) {
    const role = m.role === "assistant" || m.role === "user" ? m.role : null;
    const content = String(m.content || "").trim();
    if (!role || !content) continue;
    out.push({ role, content: content.slice(0, 4000) });
  }
  while (out.length && out[0].role === "assistant") out.shift();
  return out;
}

const DEFAULT_FOLLOW_CUSTOMER_VI = [
  "Tôi muốn thêm gợi ý món ăn phù hợp bữa này",
  "Cho mình công thức đơn giản với các loại trên",
  "Mình muốn biết nguyên liệu nên mua kèm khi nấu",
];

function asTrimmedString(v, max = 2000) {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

/** Gợi ý chip: luôn theo góc khách (Tôi/Cho mình/Mình), tránh "Bạn có muốn…?" */
function normalizeFollowUpQuestions(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (let q of list) {
    q = asTrimmedString(q, 140);
    if (!q) continue;
    let m = q.match(/^bạn\s+có\s+muốn\s+biết\s+thêm\s+về\s+(.+?)\s*\??$/i);
    if (m) {
      const tail = m[1].replace(/\?+$/, "").trim();
      if (tail) out.push(`Tôi muốn biết thêm về ${tail}`);
      continue;
    }
    m = q.match(/^bạn\s+có\s+thích\s+(.+?)\s*\??$/i);
    if (m) {
      const tail = m[1].replace(/\?+$/, "").trim();
      if (tail) out.push(`Tôi muốn gợi ý thêm về ${tail}`);
      continue;
    }
    m = q.match(/^cần\s+thêm\s+thông\s+tin\s+về\s+(.+?)\s*\??$/i);
    if (m) {
      const tail = m[1].replace(/\?+$/, "").trim();
      if (tail) out.push(`Cho mình thêm thông tin về ${tail}`);
      continue;
    }
    if (/^bạn\s+có\s+/i.test(q)) {
      q = q.replace(/^bạn\s+có\s+/i, "Mình muốn ");
      if (!/\?\s*$/.test(q)) q = `${q.replace(/\.*\s*$/, "")}?`;
    }
    out.push(q);
    if (out.length >= 4) break;
  }
  return out.length ? out.slice(0, 4) : [...DEFAULT_FOLLOW_CUSTOMER_VI];
}

/** Câu Có/Không — gửi yesPrompt / noPrompt làm tin user tiếp theo */
function sanitizeQuickYesNo(raw) {
  if (!raw || typeof raw !== "object") return null;
  const question = asTrimmedString(raw.question, 220);
  const yesPrompt = asTrimmedString(raw.yesPrompt, 500);
  const noPrompt = asTrimmedString(raw.noPrompt, 500);
  if (!question || !yesPrompt || !noPrompt) return null;
  return { question, yesPrompt, noPrompt };
}

/** Gợi ý món — relatedProductIds chỉ giữ id có trong catalog */
function enrichCookingBlocks(rawList, byId, validIds) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  for (const item of rawList.slice(0, 2)) {
    const dishName = asTrimmedString(item?.dishName, 120) || "Gợi ý món";
    const summary = asTrimmedString(item?.summary, 600);
    const recipeSteps = asTrimmedString(item?.recipeSteps, 1200);
    const extraIngredientsNote = asTrimmedString(item?.extraIngredientsNote, 400);
    const ids = Array.isArray(item?.relatedProductIds) ? item.relatedProductIds : [];
    const relatedProducts = [];
    const seen = new Set();
    for (const rid of ids) {
      const sid = String(rid || "").trim();
      if (!sid || !validIds.has(sid) || seen.has(sid)) continue;
      seen.add(sid);
      const c = byId[sid];
      relatedProducts.push({
        productId: c.productId,
        name: c.name,
        unit: c.unit,
        price: c.price,
        supplier: c.supplier,
        expiryInfo: `HSD: ${c.expiryDate}`,
      });
      if (relatedProducts.length >= 6) break;
    }
    if (!summary && !recipeSteps && !extraIngredientsNote && !relatedProducts.length) continue;
    out.push({ dishName, summary, recipeSteps, extraIngredientsNote, relatedProducts });
  }
  return out;
}

/** Mock: gợi ý món + bước nấu + mua thêm từ vài sản phẩm đang chọn (không gọi LLM). */
function buildMockCookingSuggestions(pickedScored, byId, validIds) {
  const rows = pickedScored.map((x) => x.row).filter(Boolean);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.productId).slice(0, 6);
  const a = rows[0];
  const raw = [
    {
      dishName: `Salad eat clean với ${a.name}`,
      summary: `Món nhẹ, nhiều chất xơ — hợp bữa phụ hoặc ăn kiêng, dùng nông sản đang có trên shop.`,
      recipeSteps: `1) Rửa sạch ${a.name} và các loại đã mua.\n2) Cắt miếng vừa ăn, trộn trong tô.\n3) Rưới dầu oliu + chanh hoặc sốt yogurt ít béo.\n4) Dùng ngay để giữ độ giòn.`,
      extraIngredientsNote: `Có thể mua thêm ngoài shop: sữa chua không đường, hạt dinh dưỡng (óc chó, hạnh nhân), dầu oliu, chanh — tùy siêu thị gần nhà.`,
      relatedProductIds: ids,
    },
  ];
  if (rows.length >= 2) {
    const b = rows[1];
    raw.push({
      dishName: `Xào nhanh ${a.name} và ${b.name}`,
      summary: `Bữa tối vài phút, giữ vị tự nhiên của rau củ.`,
      recipeSteps: `1) Phi thơm tỏi (lửa vừa).\n2) Cho ${a.name}, ${b.name} vào, xào lửa lớn 2–3 phút.\n3) Nêm nhẹ, tắt bếp sớm để rau còn giòn.\n4) Ăn kèm cơm gạo lứt hoặc ăn không.`,
      extraIngredientsNote: `Mua thêm: tỏi, hành lá, dầu ăn — nếu eat clean thì hạn chế dầu và dùng muối ít.`,
      relatedProductIds: ids,
    });
  }
  return enrichCookingBlocks(raw, byId, validIds);
}

/** Sản phẩm đang bán, còn tồn theo FEFO, có lô chưa hết hạn — dùng cho OpenAI và mock. */
async function buildEligibleCatalog(maxScan = 150) {
  const products = await Product.find({ isActive: true })
    .sort({ soldCount: -1, ratingAvg: -1 })
    .limit(maxScan)
    .lean();

  await refreshBatchStatuses();
  const stockMap = await sumAvailableStockForProductIds(products.map((p) => p._id));

  const rows = [];
  for (const product of products) {
    const stock = stockMap.get(product._id.toString()) || 0;
    if (stock <= 0) continue;
    const nextBatch = await ProductBatch.findOne({
      productId: product._id,
      expiryDate: { $gt: new Date() },
      quantityInStock: { $gt: 0 },
      isDisabled: { $ne: true },
    })
      .sort({ expiryDate: 1 })
      .lean();
    if (!nextBatch) continue;
    const desc = (product.description || "").replace(/\s+/g, " ").trim().slice(0, 280);
    rows.push({
      productId: product._id.toString(),
      name: product.name,
      description: desc,
      unit: product.unit,
      price: product.salePrice ?? product.price,
      supplier: product.supplier || "",
      certifications: product.certifications || [],
      stock,
      expiryDate: new Date(nextBatch.expiryDate).toISOString().slice(0, 10),
    });
  }
  return rows;
}

async function suggestProductsMock(message, maxItems = 5) {
  const q = normalize(message);
  const greeting =
    /^(xin\s*chào|chào(\s+bạn)?|hello|hi|hey|chao|good\s*morning)\b|^\s*chào\s*!?\s*$/i.test(
      (message || "").trim()
    );

  const catalog = await buildEligibleCatalog(120);
  if (!catalog.length) {
    return {
      answer:
        "Hiện chưa có sản phẩm đủ tồn để gợi ý. Bạn có thể xem trang Sản phẩm hoặc gửi yêu cầu qua mục Liên hệ trên website.",
      recommendations: [],
      followUpQuestions: normalizeFollowUpQuestions([
        "Tôi muốn để lại email khi cửa hàng có hàng",
        "Cho mình xem trang Liên hệ để hỏi thêm",
      ]),
      cookingSuggestions: [],
      quickYesNo: null,
      actions: [{ type: "open_contact", label: "Liên hệ cửa hàng" }],
    };
  }

  if (greeting && String(message || "").trim().length < 48) {
    const top = catalog.slice(0, Math.min(maxItems, 5)).map((c) => ({
      productId: c.productId,
      name: c.name,
      unit: c.unit,
      price: c.price,
      supplier: c.supplier,
      expiryInfo: `HSD: ${c.expiryDate}`,
      reason: "Đang có sẵn trong kho, bán chạy và còn hạn sử dụng tốt.",
      matchScore: 0.88,
    }));
    const byId = Object.fromEntries(catalog.map((c) => [c.productId, c]));
    const validIds = new Set(catalog.map((c) => c.productId));
    const scoredTop = top.map((t) => ({ row: catalog.find((c) => c.productId === t.productId) })).filter((x) => x.row);
    const cookingSuggestions = buildMockCookingSuggestions(scoredTop, byId, validIds);
    return {
      answer:
        "Chào bạn! Mình là trợ lý tư vấn nông sản của cửa hàng. Bạn cứ mô tả nhu cầu (bữa ăn, nấu món gì, ăn kiêng, ngân sách…) — dưới đây là vài gợi ý phổ biến đang có hàng.",
      recommendations: top,
      followUpQuestions: normalizeFollowUpQuestions([
        "Tôi đang tìm loại thực phẩm cho bữa tối nay",
        "Mình muốn ưu tiên hữu cơ hoặc VietGAP, gợi ý giúp",
      ]),
      cookingSuggestions,
      quickYesNo: null,
      actions: [
        { type: "view_detail", label: "Xem chi tiết" },
        { type: "add_to_cart", label: "Thêm vào giỏ" },
      ],
    };
  }

  const tokens = q.split(/[^a-z0-9àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]+/i).filter((t) => t.length >= 2);

  const scored = [];
  for (const row of catalog) {
    const blob = normalize([row.name, row.description, ...(row.certifications || [])].join(" "));
    let score = 0;
    for (const t of tokens) {
      if (t.length >= 2 && blob.includes(t)) score += 2;
    }
    if (q.includes("hữu cơ") || q.includes("organic")) {
      if ((row.certifications || []).some((c) => normalize(c).includes("hữu") || normalize(c).includes("organic")))
        score += 4;
    }
    if (q.includes("vietgap")) {
      if ((row.certifications || []).some((c) => normalize(c).includes("vietgap"))) score += 4;
    }
    if (q.includes("globalgap")) {
      if ((row.certifications || []).some((c) => normalize(c).includes("globalgap"))) score += 4;
    }
    if (q.includes("giảm cân") || q.includes("eat clean") || q.includes("healthy") || q.includes("an kieng"))
      score += 1;
    if (q.includes("nước ép") || q.includes("nuoc ep") || q.includes("ép")) score += 1;
    scored.push({ row, score: score || 0 });
  }
  scored.sort((a, b) => b.score - a.score || b.row.stock - a.row.stock);
  let picked = scored.filter((x) => x.score > 0).slice(0, maxItems);
  if (!picked.length) picked = scored.slice(0, maxItems);

  const hasKeywordHit = picked.some((x) => x.score > 0);
  const recommendations = picked.map(({ row, score }) => ({
    productId: row.productId,
    name: row.name,
    unit: row.unit,
    price: row.price,
    supplier: row.supplier,
    expiryInfo: `HSD: ${row.expiryDate}`,
    reason: hasKeywordHit
      ? "Khớp với từ khóa / chứng nhận bạn nhắc tới và đang còn trong kho."
      : "Đang có sẵn — thử thêm tên loại rau củ hoặc món bạn muốn nấu để mình lọc chính xác hơn.",
    matchScore: Math.min(1, 0.55 + score * 0.08),
  }));

  const answer = hasKeywordHit
    ? "Dựa trên tồn kho thật, mình chọn các mặt hàng gần với mô tả của bạn nhất."
    : "Mình chưa thấy từ khóa khớp mạnh; đây là vài sản phẩm đang có hàng để bạn tham khảo. Bạn có thể ghi rõ tên loại hoặc món ăn nhé.";

  const byId = Object.fromEntries(catalog.map((c) => [c.productId, c]));
  const validIds = new Set(catalog.map((c) => c.productId));
  const cookingSuggestions = buildMockCookingSuggestions(picked, byId, validIds);

  const wantsCookingHint =
    q.includes("nấu") ||
    q.includes("mon") ||
    q.includes("món") ||
    q.includes("công thức") ||
    q.includes("che bien") ||
    q.includes("chế biến") ||
    q.includes("recipe") ||
    q.includes("giảm cân") ||
    q.includes("eat clean") ||
    q.includes("healthy");

  let quickYesNo = null;
  if (wantsCookingHint && cookingSuggestions.length) {
    quickYesNo = {
      question: "Bạn có muốn mình gợi ý thêm món khác cùng nguyên liệu trên không?",
      yesPrompt: "Có, cho mình thêm một món khác dùng cùng nguyên liệu này",
      noPrompt: "Không, vậy là đủ cho mình rồi",
    };
  }

  return {
    answer,
    recommendations,
    followUpQuestions: normalizeFollowUpQuestions([
      "Tôi cần gợi ý cho bữa chính hoặc đồ uống trong ngày",
      "Cho mình biết nguyên liệu nên mua kèm khi nấu các món trên",
    ]),
    cookingSuggestions,
    quickYesNo,
    actions: [
      { type: "view_detail", label: "Xem chi tiết" },
      { type: "add_to_cart", label: "Thêm vào giỏ" },
      { type: "add_to_wishlist", label: "Lưu wishlist" },
    ],
  };
}

/**
 * OpenAI: chỉ được chọn productId có trong catalog; trả JSON. Có ngữ cảnh hội thoại.
 */
async function suggestWithOpenAI(catalog, maxItems, conversationMessages) {
  const validIds = new Set(catalog.map((c) => c.productId));
  const model = env.aiModel && env.aiModel !== "mock" ? env.aiModel : "gpt-4o-mini";

  const client = new OpenAI({ apiKey: env.aiApiKey });
  const catalogPayload = catalog.map((c) => ({
    productId: c.productId,
    name: c.name,
    description: c.description,
    unit: c.unit,
    priceVnd: c.price,
    supplier: c.supplier,
    certifications: c.certifications,
    stock: c.stock,
    expiryDate: c.expiryDate,
  }));

  const system = `Bạn là trợ lý tư vấn nông sản/thực phẩm của cửa hàng trực tuyến FreshFarm Organic (Việt Nam). Luôn trả lời bằng tiếng Việt, ngắn gọn, thân thiện, không phán xét.

QUY TẮC QUAN TRỌNG:
- CHỈ gợi ý sản phẩm có \`productId\` nằm trong danh sách JSON bên dưới. Không bịa sản phẩm, giá, tồn kho hay hạn sử dụng ngoài dữ liệu đó.
- Giá hiển thị cho khách là \`priceVnd\` (đồng Việt Nam). Có thể nói "khoảng …đ" nếu cần làm tròn nhẹ.
- Nếu khách hỏi vận chuyển/thanh toán: thanh toán COD hoặc QR (chuyển khoản) tùy cửa hàng; phí ship thường miễn khi đơn đạt mức tạm tính (khách xem chi tiết ở bước thanh toán). Không cam kết số tiền cụ thể nếu không chắc.
- Nếu câu hỏi ngoài nông sản/thực phẩm (chính trị, y khoa chẩn đoán, pháp luật…): từ chối lịch sự và gợi ý liên hệ /contact trên website.
- Khi khách hỏi nấu ăn / món / công thức / giảm cân / bữa ăn: trong \`answer\` hoặc khối \`cookingSuggestions\` hãy gợi ý món phù hợp, các bước nấu ngắn (recipeSteps), nguyên liệu thường mua thêm ngoài shop (extraIngredientsNote — được phép là hàng không có trong catalog), và \`relatedProductIds\` chỉ trỏ sản phẩm trong danh sách catalog phù hợp món đó.

DANH SÁCH SẢN PHẨM ĐANG CÓ HÀNG (JSON):
${JSON.stringify(catalogPayload)}

Nhiệm vụ: Đọc nhu cầu khách (tin nhắn mới nhất là quan trọng nhất), chọn tối đa ${maxItems} sản phẩm phù hợp nhất (tên, mô tả, chứng nhận, nhà cung cấp, ngữ cảnh như giảm cân, hữu cơ, nấu ăn…).

Trả về DUY NHẤT một object JSON (không markdown), đúng schema:
{
  "answer": "string — lời trả lời tự nhiên cho khách",
  "recommendations": [
    {
      "productId": "string — phải trùng một productId trong danh sách",
      "name": "string — tên đúng như trong danh sách",
      "reason": "string — 1–2 câu tiếng Việt vì sao phù hợp",
      "matchScore": 0.0 đến 1.0
    }
  ],
  "followUpQuestions": ["string"],
  "cookingSuggestions": [
    {
      "dishName": "string — tên món gợi ý",
      "summary": "string — 1–3 câu: món này hợp khi nào / dinh dưỡng",
      "recipeSteps": "string — 3–8 bước ngắn, có thể xuống dòng \\n",
      "extraIngredientsNote": "string — gia vị, đậu, thịt… thường mua thêm (có thể không bán trên shop)",
      "relatedProductIds": ["string — chỉ id trong catalog, tối đa 6"]
    }
  ],
  "quickYesNo": null
}

followUpQuestions: tối đa 4 chuỗi. BẮT BUỘC viết theo GÓC KHÁCH (họ bấm chip để gửi lại như tin nhắn): bắt đầu bằng "Tôi ", "Cho mình ", "Mình muốn " hoặc tương đương. CẤM kiểu "Bạn có muốn…?", "Bạn có thích…?", "Cần thêm thông tin…?" (hỏi ngược khách).

quickYesNo: chỉ dùng khi thật sự cần xác nhận Có/Không. Khi dùng, đặt object:
{ "question": "câu hỏi ngắn", "yesPrompt": "nội dung tin nhắn khi khách bấm Có", "noPrompt": "nội dung khi khách bấm Không" }
yesPrompt/noPrompt cũng viết như khách gửi (vd: "Có, cho mình thêm công thức chi tiết"). Nếu không cần thì để null.

cookingSuggestions: tối đa 2 món; có thể mảng rỗng nếu không phù hợp ngữ cảnh.

Nếu không có sản phẩm phù hợp: recommendations = [], cookingSuggestions có thể rỗng, followUpQuestions theo góc khách để khách mô tả thêm, answer giải thích nhẹ nhàng.`;

  const conv = trimConversationForLLM(conversationMessages);

  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: system }, ...conv],
    temperature: 0.4,
    max_tokens: 2200,
  });

  const text = completion.choices[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("OPENAI_INVALID_JSON");
  }

  const rawRecs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
  const byId = Object.fromEntries(catalog.map((c) => [c.productId, c]));

  const recommendations = [];
  const seen = new Set();
  for (const r of rawRecs) {
    const id = r.productId && String(r.productId);
    if (!id || !validIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    const c = byId[id];
    recommendations.push({
      productId: c.productId,
      name: c.name,
      unit: c.unit,
      price: c.price,
      supplier: c.supplier,
      expiryInfo: `HSD: ${c.expiryDate}`,
      reason: typeof r.reason === "string" && r.reason.trim() ? r.reason.trim() : "Phù hợp với nhu cầu bạn mô tả.",
      matchScore: Math.min(1, Math.max(0, Number(r.matchScore) || 0.75)),
    });
    if (recommendations.length >= maxItems) break;
  }

  const fromModel = normalizeFollowUpQuestions(parsed.followUpQuestions);
  const cookingSuggestions = enrichCookingBlocks(parsed.cookingSuggestions, byId, validIds);
  const quickYesNo = sanitizeQuickYesNo(parsed.quickYesNo);

  return {
    answer:
      typeof parsed.answer === "string" && parsed.answer.trim()
        ? parsed.answer.trim()
        : "Cảm ơn bạn đã hỏi. Dưới đây là một số gợi ý từ kho hàng hiện có.",
    recommendations,
    followUpQuestions: fromModel,
    cookingSuggestions,
    quickYesNo,
    actions: [
      { type: "view_detail", label: "Xem chi tiết" },
      { type: "add_to_cart", label: "Thêm vào giỏ" },
      { type: "add_to_wishlist", label: "Lưu wishlist" },
    ],
  };
}

/**
 * Entry: OpenAI nếu AI_PROVIDER=openai và có AI_API_KEY; ngược lại dùng mock.
 * @param {string} message — tin nhắn mới nhất (trùng với user cuối trong conversationMessages)
 * @param {number} maxItems
 * @param {Array<{role:string,content:string}>} conversationMessages — đã gồm tin user mới
 */
async function suggestProducts(message, maxItems = 5, conversationMessages = []) {
  const providerLc = (env.aiProvider || "").toLowerCase();
  const hasKey = Boolean(env.aiApiKey);
  const useOpenAI = providerLc === "openai" && hasKey;
  const conv = trimConversationForLLM(conversationMessages);

  if (!useOpenAI) {
    const why =
      !hasKey && providerLc === "openai"
        ? "AI_PROVIDER=openai nhưng AI_API_KEY trống."
        : !hasKey
          ? "Thiếu AI_API_KEY."
          : providerLc !== "openai"
            ? `AI_PROVIDER=${JSON.stringify(env.aiProvider ?? "")} (đặt \"openai\" để dùng API).`
            : "";
    console.info("[chatbot] chế độ: GIẢ LẬP (mock — rule + catalog DB).", why || "");
  }

  if (useOpenAI) {
    try {
      const catalog = await buildEligibleCatalog(180);
      if (!catalog.length) {
        console.info(
          "[chatbot] chế độ: CỐ ĐỊNH (không gọi OpenAI — catalog không có sản phẩm đủ tồn/hạn)."
        );
        console.info("[chatbot] OpenAI: catalog rỗng (không có SP đủ tồn/hạn), trả lời cố định — không gọi API.");
        return {
          answer:
            "Hiện cửa hàng chưa có sản phẩm nào đủ tồn kho để gợi ý. Bạn xem mục Sản phẩm hoặc gửi liên hệ tại trang Liên hệ trên website nhé.",
          recommendations: [],
          followUpQuestions: normalizeFollowUpQuestions([
            "Cho mình biết khi nào cửa hàng nhập hàng lại",
            "Mình muốn xem trang Liên hệ để hỏi trực tiếp",
          ]),
          cookingSuggestions: [],
          quickYesNo: null,
          actions: [],
        };
      }
      const maxCatalogForContext = 55;
      const sliced = catalog.slice(0, maxCatalogForContext);
      const model = env.aiModel && env.aiModel !== "mock" ? env.aiModel : "gpt-4o-mini";
      console.info("[chatbot] chế độ: OPENAI — đang gọi API…", { model, catalogItems: sliced.length, historyTurns: conv.length });
      const out = await suggestWithOpenAI(sliced, maxItems, conv);
      console.info(
        "[chatbot] chế độ: OPENAI — hoàn tất.",
        "Gợi ý:",
        out.recommendations?.length ?? 0,
        "sản phẩm."
      );
      return out;
    } catch (err) {
      console.error("[chatbot] OpenAI lỗi → chuyển sang GIẢ LẬP (mock):", err.message || err);
      console.info("[chatbot] chế độ: GIẢ LẬP (mock — fallback sau lỗi OpenAI).");
    }
  }

  return suggestProductsMock(message, maxItems);
}

module.exports = { suggestProducts, buildEligibleCatalog, trimConversationForLLM };
