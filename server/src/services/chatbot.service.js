const OpenAI = require("openai");
const { Product, ProductBatch } = require("../models");
const { refreshBatchStatuses, sumAvailableStockForProductIds } = require("./inventory.service");
const { removeVietnameseTones } = require("../utils/viFold");
const env = require("../config/env");

function normalize(text) {
  return (text || "").toLowerCase();
}

/** Bỏ dấu tiếng Việt — khớp tên SP khi khách gõ không dấu (mo → Mơ) */
function fold(text) {
  return removeVietnameseTones(text || "");
}

function foldTokens(text) {
  return fold(text).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Khớp từ đơn — tránh "pho" khớp nhầm trong "sapoche", "mo" trong "mong"… */
function foldHasToken(foldedText, token) {
  if (!token) return false;
  const t = fold(token);
  if (!t) return false;
  if (t.includes(" ")) return fold(foldedText).includes(t);
  const words = foldTokens(foldedText);
  if (words.some((w) => w === t)) return true;
  if (t.length >= 4) {
    return words.some((w) => w.startsWith(t));
  }
  return false;
}

function foldedTextMatchesPhrase(foldedText, entryNorm) {
  if (!entryNorm) return false;
  if (entryNorm.includes(" ")) return fold(foldedText).includes(entryNorm);
  return foldHasToken(foldedText, entryNorm);
}

/** Khách hỏi giới thiệu / tác dụng / lợi ích về một loại thực phẩm */
const INTRO_QUERY_PATTERNS = [
  /giới\s*thiệu/,
  /tác\s*dụng/,
  /lợi\s*ích/,
  /công\s*dụng/,
  /dinh\s*dưỡng/,
  /thành\s*phần/,
  /có\s*tốt\s*không/,
  /ăn\s+.+\s+có\s+lợi/,
  /uống\s+.+\s+có\s+lợi/,
];

/** Cụm tên dễ nhầm — chỉ dùng để phân biệt, không liệt kê từng sản phẩm */
const KNOWN_FOOD_PHRASES = [
  { key: "chanh dây", aliases: ["chanh dây", "chanh day", "trái chanh dây", "quả chanh dây"] },
  { key: "chanh leo", aliases: ["chanh leo", "trái chanh leo", "quả chanh leo"] },
  { key: "hồng xiêm", aliases: ["hồng xiêm", "hong xiem", "quả hồng xiêm", "trái hồng xiêm", "sapoche", "sapodilla"] },
  { key: "hồng giòn", aliases: ["hồng giòn", "hong gion", "quả hồng giòn", "trái hồng giòn"] },
  { key: "khoai lang", aliases: ["khoai lang"] },
  { key: "mật ong", aliases: ["mật ong", "mat ong"] },
  { key: "nước ép", aliases: ["nước ép", "nuoc ep", "nước ep"] },
];

const KNOWN_FOOD_PHRASES_SORTED = [...KNOWN_FOOD_PHRASES].sort(
  (a, b) => Math.max(...b.aliases.map((a) => a.length)) - Math.max(...a.aliases.map((a) => a.length))
);

function extractFoodPhraseFromText(text) {
  const q = normalize(text);
  for (const item of KNOWN_FOOD_PHRASES_SORTED) {
    for (const alias of item.aliases) {
      if (q.includes(normalize(alias))) return item.key;
    }
  }
  return "";
}

function isGenericBenefitsText(text) {
  return /là nông sản\/thực phẩm tự nhiên, thường được dùng trong chế biến/i.test(text || "");
}

function lookupDisambiguationBenefits(topic) {
  const key = normalize(topic);
  if (DISAMBIGUATION_BENEFITS_VI[key]) return DISAMBIGUATION_BENEFITS_VI[key];
  const phrase = extractFoodPhraseFromText(topic);
  if (phrase && DISAMBIGUATION_BENEFITS_VI[phrase]) return DISAMBIGUATION_BENEFITS_VI[phrase];
  return "";
}

/** Từ nhiễu trong tên SP — không dùng làm chủ đề đơn lẻ (đã bỏ dấu) */
const CATALOG_NAME_NOISE_WORDS = new Set(
  [
    "tươi", "sạch", "khô", "hữu cơ", "organic", "truyền thống", "đặc sản", "cao phong",
    "việt", "bắc", "nam", "đông", "tây", "vàng", "xanh", "đỏ", "trắng", "thơm", "ngọt",
    "hữu", "cơ", "sản", "hàng", "quả", "trái", "nấm", "loại", "đặc",
  ].map((w) => fold(w))
);

/** Tên SP trùng từ thường gặp trong câu hỏi — không khớp từ full message (vd: tôi ≠ Tỏi) */
const HOMONYM_CATALOG_WORDS = new Set(["toi"]);

/** Từ phổ biến trong câu hỏi — bỏ qua khi quét cụm catalog trong tin nhắn */
const CATALOG_PHRASE_MATCH_STOP = new Set(
  [
    "toi", "tôi", "ban", "bạn", "minh", "mình", "cho", "ve", "về", "muon", "muốn",
    "tham", "khao", "khảo", "mua", "tim", "tìm", "can", "cần", "co", "có", "khong", "không",
    "la", "là", "gi", "gì", "nay", "này", "do", "đó", "voi", "với", "cac", "các",
  ].map((w) => fold(w))
);

/** Cụm tên lấy từ catalog thật — áp dụng cho mọi sản phẩm trong shop */
function buildCatalogPhraseEntries(catalog) {
  const entries = [];
  const seen = new Set();
  for (const row of catalog || []) {
    const name = String(row.name || "").trim();
    if (!name) continue;
    const fullKey = fold(name);
    if (!seen.has(fullKey)) {
      seen.add(fullKey);
      entries.push({ phrase: name, norm: fullKey, productId: row.productId });
    }
    const words = name.split(/\s+/).filter(Boolean);
    for (const word of words) {
      const norm = fold(word);
      if (norm.length < 3 || CATALOG_NAME_NOISE_WORDS.has(norm) || seen.has(norm)) continue;
      seen.add(norm);
      entries.push({ phrase: word, norm, productId: row.productId });
    }
    for (let len = Math.min(words.length, 5); len >= 2; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(" ");
        const norm = fold(phrase);
        if (norm.length < 3 || seen.has(norm)) continue;
        seen.add(norm);
        entries.push({ phrase, norm, productId: row.productId });
      }
    }
  }
  return entries.sort((a, b) => b.norm.length - a.norm.length);
}

function isLikelyHomonymProductMention(text, norm) {
  if (!HOMONYM_CATALOG_WORDS.has(norm)) return true;
  const words = foldTokens(text);
  const meaningful = words.filter((w) => !CATALOG_PHRASE_MATCH_STOP.has(w));
  if (meaningful.length === 1 && meaningful[0] === norm) return true;
  const folded = fold(text);
  const intentMatch = folded.match(/(?:mua|tim|can|cần|tham\s*khao)\s+(.+)/);
  if (intentMatch && foldHasToken(intentMatch[1], norm)) return true;
  return false;
}

function isOverlyBroadCatalogPhraseMatch(text, norm) {
  if (!norm || norm.includes(" ")) return false;
  const textWords = foldTokens(text).filter(
    (w) => !CATALOG_PHRASE_MATCH_STOP.has(w) && !CATALOG_NAME_NOISE_WORDS.has(w) && w.length >= 2
  );
  if (textWords.length <= 1) return false;
  const extraWords = textWords.filter((w) => w !== norm && w.length >= 3);
  return extraWords.length > 0;
}

function significantTopicWords(topicKey) {
  return fold(topicKey)
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !CATALOG_NAME_NOISE_WORDS.has(w));
}

/** Chủ đề và SP cùng từ đầu nhưng loại phụ khác nhau (vd: hồng xiêm ≠ hồng giòn) */
function hasDistinctSubtypeConflict(topicKey, row) {
  const topicWords = significantTopicWords(topicKey);
  if (topicWords.length < 2) return false;

  const topicNorm = fold(topicKey);
  const nameNorm = fold(row?.name || "");
  const blob = fold([row?.name, row?.description].join(" "));
  if (blob.includes(topicNorm)) return false;

  const productSig = significantNameWords(nameNorm);
  if (topicWords[0] !== productSig[0] || productSig.length < 2) return false;

  const topicTail = topicWords[topicWords.length - 1];
  const productTail = productSig[productSig.length - 1];
  if (topicTail.length < 3 || productTail.length < 3) return false;
  if (topicTail === productTail) return false;
  if (foldHasToken(blob, topicTail)) return false;

  return true;
}

function extractCatalogPhraseFromText(text, catalog) {
  const q = fold(text);
  if (!q || !catalog?.length) return "";
  for (const { phrase, norm } of buildCatalogPhraseEntries(catalog)) {
    if (CATALOG_PHRASE_MATCH_STOP.has(norm) && !isLikelyHomonymProductMention(text, norm)) continue;
    if (HOMONYM_CATALOG_WORDS.has(norm) && !isLikelyHomonymProductMention(text, norm)) continue;
    if (isOverlyBroadCatalogPhraseMatch(text, norm)) continue;
    if (foldedTextMatchesPhrase(q, norm)) return phrase;
  }
  return "";
}

/** Lấy chủ đề thực phẩm rõ ràng từ câu hỏi — ưu tiên hơn quét catalog (tránh nhầm tôi → Tỏi) */
function extractExplicitFoodTopic(message) {
  const raw = String(message || "").trim();
  if (!raw) return "";

  const traiQua = raw.match(/(?:trái|quả)\s+([a-z0-9àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]+(?:\s+[a-z0-9àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]+)*)/i);
  if (traiQua) {
    const label = traiQua[0].trim();
    const fromKnown = extractFoodPhraseFromText(label);
    if (fromKnown) return fromKnown;
    return label;
  }

  const patterns = [
    /tham\s+khảo\s+(.+?)(?:\?|\.|,|$)/i,
    /(?:mua|tìm|tim|cần|can)\s+(.+?)(?:\?|\.|,|$)/i,
    /về\s+(.+?)(?:\?|\.|,|$)/i,
  ];
  for (const rx of patterns) {
    const m = raw.match(rx);
    if (!m) continue;
    const chunk = m[1].trim();
    const fromKnown = extractFoodPhraseFromText(chunk);
    if (fromKnown) return fromKnown;
    const meaningful = meaningfulTopicFromChunk(chunk);
    if (meaningful) return meaningful;
  }
  return "";
}

function extractBareProductQuery(message, catalog = null) {
  const words = foldTokens(message);
  const meaningful = words.filter((w) => !CATALOG_PHRASE_MATCH_STOP.has(w) && w.length >= 2);
  const token = meaningful.length === 1 ? meaningful[0] : words.length === 1 && words[0].length >= 2 ? words[0] : "";
  if (!token) return "";
  if (catalog?.length) {
    for (const { phrase, norm } of buildCatalogPhraseEntries(catalog)) {
      if (norm === token || fold(phrase) === token) return phrase;
    }
  }
  return token;
}

function findCatalogTopicMatches(topicKey, catalog, maxItems = 5) {
  if (!topicKey || !catalog?.length) return [];
  const terms = topicMatchTerms(topicKey);
  return catalog
    .map((row) => ({ row, score: scoreCatalogRowForTopic(row, terms, topicKey) }))
    .filter((x) => isStrongCatalogTopicMatch(x.row, topicKey, x.score))
    .sort((a, b) => b.score - a.score || b.row.stock - a.row.stock)
    .slice(0, maxItems);
}

function topicTokensForMatch(topicKey) {
  const folded = fold(topicKey);
  if (!folded) return [];
  if (folded.includes(" ") || extractFoodPhraseFromText(topicKey)) {
    return [folded];
  }
  if (CATALOG_NAME_NOISE_WORDS.has(folded)) return [];
  return [folded];
}

function catalogNameMatchesTopic(row, topicKey) {
  const topicNorm = fold(topicKey);
  const nameNorm = fold(row?.name || "");
  if (!topicNorm || !nameNorm) return false;
  if (nameNorm.includes(topicNorm)) return true;
  if (!topicNorm.includes(" ")) {
    return topicTokenMatchesProductName(topicNorm, nameNorm);
  }
  const sig = significantTopicWords(topicKey);
  const nameSig = significantNameWords(nameNorm);
  return sig.length > 0 && sig.every((tw) => nameSig.some((nw) => nw === tw || (tw.length >= 4 && nw.startsWith(tw))));
}

function isStrongCatalogTopicMatch(row, topicKey, score = 0) {
  if (hasDistinctSubtypeConflict(topicKey, row)) return false;
  const topicNorm = fold(topicKey || "");
  const nameNorm = fold(row?.name || "");
  const blob = fold([row?.name, row?.description].join(" "));
  if (!topicNorm) return score > 0;

  const nameWords = nameNorm.split(/\s+/).filter(Boolean);
  const significantWords = nameWords.filter((w) => !CATALOG_NAME_NOISE_WORDS.has(w));
  if (topicNorm.length <= 3 && !topicNorm.includes(" ")) {
    return significantWords.some(
      (nw, idx) =>
        (nw === topicNorm && (idx === 0 || significantWords.length === 1)) ||
        (topicNorm.length >= 3 && idx === 0 && nw.startsWith(topicNorm))
    );
  }

  if (nameNorm === topicNorm || (topicNorm.length >= 4 && nameNorm.includes(topicNorm))) return true;
  if (topicNorm.includes(" ") && blob.includes(topicNorm)) return true;
  const topicWords = topicTokensForMatch(topicKey);
  if (topicWords.some((tw) => nameWords.some((nw) => nw === tw || (tw.length >= 4 && nw.startsWith(tw))))) {
    return true;
  }
  if (topicWords.some((tw) => foldHasToken(blob, tw))) return true;
  if (topicNorm.includes(" ")) {
    const sig = significantTopicWords(topicKey);
    const matched = sig.filter((tw) => topicTokenMatchesProductName(tw, nameNorm) || foldHasToken(blob, tw));
    if (matched.length < sig.length) return false;
  }
  return score >= 12;
}

function buildContextCatalogForOpenAI(catalog, topicKey, maxBase = 55, maxExtra = 10) {
  const base = catalog.slice(0, maxBase);
  if (!topicKey) return base;
  const matched = findCatalogTopicMatches(topicKey, catalog, maxExtra).map((x) => x.row);
  const ids = new Set(base.map((c) => c.productId));
  const extra = matched.filter((r) => !ids.has(r.productId));
  return [...base, ...extra];
}

/** Mô tả phân biệt tên dễ nhầm (chanh dây / chanh leo / chanh) — không liệt kê từng SP */
const DISAMBIGUATION_BENEFITS_VI = {
  chanh:
    "Chanh (chanh vàng, chanh xanh — họ cam chanh) nhiều vitamin C và axit citric, giúp thanh mát, hỗ trợ tiêu hóa và tăng hương vị món ăn. Pha chanh với mật ong hoặc dùng làm gia vị cho salad, nước sốt là cách dùng phổ biến.",
  "chanh dây":
    "Chanh dây là loại trái riêng, vị chua ngọt đặc trưng, ruột vàng hoặc tím, có nhiều hạt li ti. Thường dùng làm nước ép, sinh tố hoặc ăn trực tiếp. Chanh dây giàu vitamin A, C và chất xơ, hỗ trợ tiêu hóa và giải khát. Lưu ý: chanh dây KHÔNG phải chanh (quả chanh citrus) và KHÔNG phải chanh leo — đây là các loại trái khác nhau.",
  "chanh leo":
    "Chanh leo là loại trái riêng (thường vỏ vàng, ruột trong, nhiều hạt), hay dùng pha nước giải khát. Không nhầm với chanh (citrus) hay chanh dây.",
  "hồng xiêm":
    "Hồng xiêm (sapoche) là loại trái nhiệt đới, vỏ nâu mỏng, thịt quả mềm ngọt, mùi thơm đặc trưng như mật ong, thường ăn trực tiếp khi chín. Giàu vitamin A, C, chất xơ và khoáng chất, hỗ trợ tiêu hóa và bổ sung năng lượng tự nhiên. Lưu ý: hồng xiêm KHÔNG phải hồng (quả hồng/hồng giòn) — đây là hai loại trái khác nhau.",
  "hồng giòn":
    "Hồng giòn là quả hồng thu hoạch khi còn cứng, vỏ căng bóng, ăn giòn rụm, vị ngọt thanh. Khác với hồng xiêm (sapoche) — hồng xiêm có thịt mềm, vị ngọt như mật ong.",
};

/** Từ khóa mở rộng — chỉ các chủ đề dễ nhầm; còn lại dùng tên/mô tả từ catalog */
const TOPIC_MATCH_TERMS = {
  chanh: ["chanh vàng", "chanh xanh", "nước chanh", "nuoc chanh", "quả chanh", "qua chanh"],
  "chanh dây": ["chanh dây", "chanh day", "trái chanh dây", "quả chanh dây"],
  "chanh leo": ["chanh leo", "trái chanh leo", "quả chanh leo"],
};

/** Gợi ý từ khóa lỏng — chỉ chủ đề dễ nhầm */
const TOPIC_SIMILAR_HINTS = {
  chanh: ["nước chanh", "nuoc chanh", "chanh vàng", "chanh xanh", "vitamin", "acid"],
  "chanh dây": ["chanh dây", "chanh day", "nước ép", "nuoc ep", "sinh tố", "sinh to", "trái", "trai"],
  "chanh leo": ["chanh leo", "nước", "giải khát", "giai khat"],
  "hồng xiêm": ["xoài", "xoai", "chuối", "chuoi", "na", "mít", "mit", "mãng cầu", "mang cau", "nhãn", "nhan", "vải", "vai", "ổi", "oi", "thanh long", "dâu", "dau", "quả", "trái"],
};

/** Gợi ý mặc định cho trái cây không có trong shop */
const DEFAULT_FRUIT_SIMILAR_HINTS = ["xoài", "xoai", "chuối", "chuoi", "na", "mít", "mit", "dâu", "dau", "cam", "buoi", "bưởi", "quả", "trái"];

function expandSimilarSearchTerms(terms, topicKey = "") {
  const out = new Set();
  for (const t of terms) {
    if (!t) continue;
    out.add(t);
    const hints = TOPIC_SIMILAR_HINTS[normalize(t)];
    if (hints) hints.forEach((h) => out.add(h));
  }
  if (topicKey) {
    const keyHints = TOPIC_SIMILAR_HINTS[normalize(topicKey)];
    if (keyHints) keyHints.forEach((h) => out.add(h));
    for (const w of normalize(topicKey).split(/\s+/).filter((w) => w.length >= 2)) out.add(w);
  }
  return [...out];
}

function isSimilarProductsRequest(message) {
  const q = normalize(message);
  return /gợi\s*ý.*tương\s*tự|tương\s*tự.*gợi\s*ý|xem\s*thêm.*tương\s*tự|sản\s*phẩm\s*tương\s*tự|goi\s*y.*tuong\s*tu/i.test(q);
}

function extractTopicFromSimilarRequest(message) {
  const raw = String(message || "");
  const patterns = [
    /tương\s*tự\s+(.+?)(?:\?|\.|,|$)/i,
    /liên quan\s+(?:đến\s+)?(.+?)(?:\?|\.|,|$)/i,
    /gợi\s*ý\s+thêm\s+(?:sản\s*phẩm\s+)?(?:tương\s*tự\s+)?(.+?)(?:\?|\.|,|$)/i,
  ];
  for (const rx of patterns) {
    const m = raw.match(rx);
    if (!m) continue;
    const chunk = m[1].trim();
    const fromKnown = extractFoodPhraseFromText(chunk);
    if (fromKnown) return fromKnown;
    const meaningful = meaningfulTopicFromChunk(chunk);
    if (meaningful) return meaningful;
  }
  return "";
}

function resolveTopicFromConversation(conversationMessages, catalog = null) {
  const rows = Array.isArray(conversationMessages) ? conversationMessages : [];
  for (let i = rows.length - 2; i >= 0; i--) {
    if (rows[i]?.role !== "user") continue;
    const topic = resolveTopicKey(String(rows[i].content || ""), catalog);
    if (topic) return topic;
  }
  return "";
}

function getSimilarSearchHints(topicKey) {
  const key = normalize(topicKey);
  if (TOPIC_SIMILAR_HINTS[key]) return TOPIC_SIMILAR_HINTS[key];
  const phrase = extractFoodPhraseFromText(topicKey);
  if (phrase && TOPIC_SIMILAR_HINTS[phrase]) return TOPIC_SIMILAR_HINTS[phrase];
  if (lookupDisambiguationBenefits(topicKey) && /trái|quả|trai|qua/i.test(topicKey)) {
    return DEFAULT_FRUIT_SIMILAR_HINTS;
  }
  return [];
}

/** Gợi ý SP theo nhóm gợi ý (vd: hồng xiêm → xoài, chuối…) khi không khớp tên trong catalog */
function findSimilarByKnownTopicHints(catalog, topicKey, maxItems = 3) {
  const hints = getSimilarSearchHints(topicKey);
  if (!hints.length) return [];

  const scored = [];
  for (const row of catalog) {
    if (hasDistinctSubtypeConflict(topicKey, row)) continue;
    const nameNorm = fold(row.name || "");
    const nameSig = significantNameWords(nameNorm);
    let score = 0;

    for (const hint of hints) {
      const hn = fold(hint);
      if (!hn || hn.length < 2) continue;
      if (topicTokenMatchesProductName(hn, nameNorm)) score += hn.length >= 4 ? 14 : 10;
      else if (nameSig.some((nw) => nw === hn || (hn.length >= 4 && nw.startsWith(hn)))) score += 12;
    }

    if (foldHasToken(nameNorm, "qua") || foldHasToken(nameNorm, "trai")) score += 6;

    if (score > 0) scored.push({ row, score });
  }

  scored.sort((a, b) => b.score - a.score || b.row.stock - a.row.stock);
  return scored.filter((x) => x.score >= 10).slice(0, maxItems);
}

/** Gợi ý SP tương tự khi không có từ khóa cứng — dựa trên tên/mô tả catalog */
function findSimilarByTopicOverlap(catalog, topicKey, maxItems = 3) {
  if (!topicKey || !catalog?.length) return [];
  const topicNorm = fold(topicKey);
  let topicWords = topicNorm.split(/\s+/).filter((w) => w.length >= 2 && !CATALOG_NAME_NOISE_WORDS.has(w));
  if (!topicWords.length && topicNorm.length >= 2) topicWords = [topicNorm];

  const scored = [];
  for (const row of catalog) {
    if (hasDistinctSubtypeConflict(topicKey, row)) continue;
    const nameNorm = fold(row.name || "");
    const blob = fold([row.name, row.description].join(" "));
    const nameWords = nameNorm.split(/\s+/).filter(Boolean);
    let score = 0;
    for (const tw of topicWords) {
      if (nameWords.some((nw, idx) => nw === tw || (tw.length >= 4 && idx === 0 && nw.startsWith(tw)))) score += 12;
      else if (tw.length > 3 && topicTokenMatchesProductName(tw, nameNorm)) score += tw.length >= 5 ? 8 : 5;
    }
    if (score > 0) scored.push({ row, score });
  }
  scored.sort((a, b) => b.score - a.score || b.row.stock - a.row.stock);
  return scored.slice(0, maxItems);
}

function findSimilarInCatalog(catalog, { terms, topicKey = "", outOfStock = [], excludeIds = new Set(), maxItems = 3 }) {
  if (!catalog?.length) return [];

  const exclude = new Set(excludeIds);
  for (const p of outOfStock) {
    if (p?.productId) exclude.add(String(p.productId));
  }

  const outCategoryIds = new Set(
    outOfStock.map((p) => (p.categoryId ? String(p.categoryId) : "")).filter(Boolean)
  );

  const searchTerms = expandSimilarSearchTerms(terms, topicKey);
  const directTerms = terms.filter(Boolean);

  const scored = [];
  for (const row of catalog) {
    if (exclude.has(row.productId)) continue;

    let score = scoreCatalogRowForTopic(row, directTerms, topicKey) * 0.6;
    score += scoreCatalogRowForTopic(row, searchTerms, topicKey);

    if (row.categoryId && outCategoryIds.has(String(row.categoryId))) score += 7;

    const blob = normalize([row.name, row.description].join(" "));
    for (const t of directTerms) {
      if (t.length >= 3 && blob.includes(normalize(t).slice(0, Math.min(4, t.length)))) score += 2;
    }

    if (score > 0) scored.push({ row, score });
  }

  scored.sort((a, b) => b.score - a.score || b.row.stock - a.row.stock);

  if (scored.length) return scored.slice(0, maxItems);

  // Fallback nhẹ: SP cùng danh mục với mặt hàng hết hàng
  if (outCategoryIds.size) {
    const byCat = catalog
      .filter((row) => !exclude.has(row.productId) && outCategoryIds.has(String(row.categoryId)))
      .slice(0, maxItems)
      .map((row) => ({ row, score: 4 }));
    if (byCat.length) return byCat;
  }

  const overlap = findSimilarByTopicOverlap(
    catalog.filter((row) => !exclude.has(row.productId)),
    topicKey,
    maxItems
  );
  if (overlap.length) return overlap;

  return findSimilarByKnownTopicHints(
    catalog.filter((row) => !exclude.has(row.productId)),
    topicKey,
    maxItems
  );
}

function detectProductIntroQuery(message, catalog = null) {
  const q = normalize(message);
  const isIntro = INTRO_QUERY_PATTERNS.some((rx) => rx.test(q));
  return { isIntro, topic: isIntro ? extractIntroTopic(message, catalog) : "" };
}

function extractIntroTopic(message, catalog = null) {
  const raw = String(message || "").trim();
  const phrase = extractFoodPhraseFromText(raw);
  if (phrase) return phrase;

  const q = normalize(raw);

  let m = raw.match(/về\s+(.+?)(?:\?|\.|,|$)/i);
  if (m) {
    const fromChunk = extractFoodPhraseFromText(m[1]);
    if (fromChunk) return fromChunk;

    const fromMeaningful = meaningfulTopicFromChunk(m[1]);
    if (fromMeaningful) return fromMeaningful;

    if (catalog?.length) {
      const fromCatalog = extractCatalogPhraseFromText(m[1], catalog);
      if (fromCatalog) return fromCatalog;
    }
  }

  m = raw.match(/giới\s*thiệu\s+(?:cho\s+tôi\s+|tôi\s+)?(?:về\s+)?(.+)/i);
  if (m) {
    const fromChunk = extractFoodPhraseFromText(m[1]);
    if (fromChunk) return fromChunk;

    const fromMeaningful = meaningfulTopicFromChunk(m[1]);
    if (fromMeaningful) return fromMeaningful;

    if (catalog?.length) {
      const fromCatalog = extractCatalogPhraseFromText(m[1], catalog);
      if (fromCatalog) return fromCatalog;
    }
  }

  if (catalog?.length) {
    const fromCatalog = extractCatalogPhraseFromText(raw, catalog);
    if (fromCatalog) return fromCatalog;
  }

  const stop = new Set([
    "cho", "toi", "tôi", "ve", "về", "cua", "của", "gioi", "giới", "thieu", "thiệu",
    "tac", "tác", "dung", "dụng", "loi", "lợi", "ich", "ích", "cong", "công",
    "minh", "ban", "bạn", "la", "là", "gi", "gì", "the", "nào", "muon", "muốn",
    "qua", "quả", "trai", "trái",
  ]);
  const tokens = q.split(/[^a-z0-9àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]+/).filter((t) => t.length >= 2);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (!stop.has(tokens[i])) return tokens[i];
  }
  return "";
}

function topicMatchTerms(topic) {
  if (!topic) return [];
  const key = normalize(topic);
  const folded = fold(topic);
  if (TOPIC_MATCH_TERMS[key]) return [...TOPIC_MATCH_TERMS[key]];
  const terms = new Set([topic]);
  if (folded && folded !== key) terms.add(folded);
  if (folded.includes(" ")) {
    terms.add(folded);
    for (const t of folded.split(/\s+/)) {
      if (t.length >= 3) terms.add(t);
    }
  }
  return [...terms];
}

function significantNameWords(nameNorm) {
  return String(nameNorm || "")
    .split(/\s+/)
    .filter((w) => !CATALOG_NAME_NOISE_WORDS.has(w));
}

function topicTokenMatchesProductName(token, nameNorm) {
  const t = fold(token);
  if (!t) return false;
  const sig = significantNameWords(nameNorm);
  if (!sig.length) return false;
  if (t.length <= 3 && !t.includes(" ")) {
    return sig[0] === t || (sig.length === 1 && sig[0] === t);
  }
  return foldHasToken(nameNorm, t);
}

function primaryTopicWord(topicKey) {
  const words = fold(topicKey).split(/\s+/).filter((w) => w.length >= 2 && !CATALOG_NAME_NOISE_WORDS.has(w));
  return words[0] || "";
}

const INTRO_TOPIC_SKIP = new Set([
  "tac", "tác", "dung", "dụng", "loi", "lợi", "ich", "ích", "cong", "công",
  "cho", "toi", "tôi", "qua", "quả", "trai", "trái", "loai", "loại", "san", "sản", "pham", "phẩm",
  "hay", "hãy", "gioi", "giới", "thieu", "thiệu", "ve", "về", "ve", "về",
]);

function meaningfulTopicFromChunk(chunk) {
  const parts = normalize(chunk).split(/\s+/).filter(Boolean);
  const meaningful = parts.filter((p) => !INTRO_TOPIC_SKIP.has(p) && p.length >= 2);
  if (!meaningful.length) return "";
  if (meaningful.length >= 2) return meaningful.join(" ");
  return meaningful[0];
}

/** Khớp chính xác hoặc cùng nhóm (vd: lê ki ma → Lê Tai Nung, Dưa lê) */
function findRelatedCatalogMatches(topicKey, catalog, maxItems = 5) {
  if (!topicKey || !catalog?.length) return { matches: [], relation: "none" };

  const exact = findCatalogTopicMatches(topicKey, catalog, maxItems);
  if (exact.length) return { matches: exact, relation: "exact" };

  const topicNorm = fold(topicKey);
  const primary = primaryTopicWord(topicKey);
  const scored = [];

  for (const row of catalog) {
    if (hasDistinctSubtypeConflict(topicKey, row)) continue;
    const nameNorm = fold(row.name || "");
    const nameWords = nameNorm.split(/\s+/).filter(Boolean);
    let score = 0;

    if (topicNorm.includes(" ") && nameNorm.includes(topicNorm)) score += 45;
    const sigWords = nameWords.filter((w) => !CATALOG_NAME_NOISE_WORDS.has(w));
    if (primary && sigWords[0] === primary) score += 30;
    else if (primary && primary.length <= 3 && sigWords.some((nw, idx) => nw === primary && idx === 0)) score += 20;
    else if (primary && primary.length > 3 && sigWords.some((nw) => nw === primary)) score += 20;
    else if (primary && primary.length >= 4 && foldHasToken(nameNorm, primary)) score += 12;

    for (const tw of topicNorm.split(/\s+/).filter((w) => w.length >= 3)) {
      if (topicTokenMatchesProductName(tw, nameNorm)) score += 8;
    }

    if (score >= 18) scored.push({ row, score });
  }

  scored.sort((a, b) => b.score - a.score || b.row.stock - a.row.stock);
  const matches = scored.slice(0, maxItems);
  return { matches, relation: matches.length ? "related" : "none" };
}

function findSimilarForUnavailableTopic(catalog, topicKey, maxItems = 3) {
  const { matches } = findRelatedCatalogMatches(topicKey, catalog, maxItems);
  const filteredRelated = matches.filter((m) => !hasDistinctSubtypeConflict(topicKey, m.row));
  if (filteredRelated.length) return filteredRelated;

  const topicWords = significantTopicWords(topicKey).filter((w) => w.length >= 3);
  if (topicWords.length) {
    const scored = [];
    for (const row of catalog) {
      if (hasDistinctSubtypeConflict(topicKey, row)) continue;
      const nameNorm = fold(row.name || "");
      let matchedWords = 0;
      for (const tw of topicWords) {
        if (topicTokenMatchesProductName(tw, nameNorm)) matchedWords += 1;
      }
      if (topicWords.length >= 2 && matchedWords < topicWords.length) continue;
      if (matchedWords > 0) {
        scored.push({ row, score: matchedWords * 12 });
      }
    }
    scored.sort((a, b) => b.score - a.score || b.row.stock - a.row.stock);
    const wordMatches = scored.filter((x) => x.score >= 12).slice(0, maxItems);
    if (wordMatches.length) return wordMatches;
  }

  return findSimilarByKnownTopicHints(catalog, topicKey, maxItems);
}

function buildSimilarProductsResult(topicKey, similarPicked, maxItems = 3, { brief = false } = {}) {
  const label = topicKey || "sản phẩm bạn hỏi";
  const similarRecs = similarPicked.slice(0, maxItems).map(({ row, score }) => ({
    productId: row.productId,
    name: row.name,
    unit: row.unit,
    price: row.price,
    supplier: row.supplier,
    expiryInfo: `HSD: ${row.expiryDate}`,
    reason: `Sản phẩm tương tự "${label}" đang có sẵn tại cửa hàng.`,
    matchScore: Math.min(1, 0.75 + (score || 0) * 0.01),
  }));

  let answer = brief
    ? ""
    : `Cửa hàng hiện chưa có "${label}" trong danh mục đang bán.`;
  if (similarRecs.length) {
    const simNames = similarRecs.map((s) => `"${s.name}"`).join(", ");
    answer += brief
      ? `Gợi ý ${similarRecs.length === 1 ? "sản phẩm tương tự" : "các sản phẩm tương tự"} "${label}" đang có sẵn: ${simNames}.`
      : `\n\nGợi ý ${similarRecs.length === 1 ? "sản phẩm tương tự" : "các sản phẩm tương tự"} đang có sẵn: ${simNames}.`;
  } else {
    answer += brief
      ? `Hiện chưa có sản phẩm tương tự "${label}" đang sẵn hàng. Bạn có thể liên hệ cửa hàng hoặc xem thêm tại trang Sản phẩm.`
      : " Bạn có thể liên hệ cửa hàng để được báo khi có hàng trở lại, hoặc xem thêm tại trang Sản phẩm.";
  }

  return {
    answer: answer.trim(),
    recommendations: similarRecs,
    followUpQuestions: normalizeFollowUpQuestions([
      similarRecs.length ? "Cho mình xem thêm sản phẩm tương tự khác" : "Tôi muốn để lại liên hệ khi cửa hàng có hàng",
      "Mình muốn xem trang Sản phẩm",
      similarRecs.length ? `Tôi muốn mua ${similarRecs[0].name}` : "Cho mình gợi ý sản phẩm khác đang có sẵn",
    ]),
    cookingSuggestions: [],
    quickYesNo: similarRecs.length
      ? {
          question: "Bạn có muốn xem thêm sản phẩm tương tự khác không?",
          yesPrompt: `Có, gợi ý thêm sản phẩm tương tự ${label}`,
          noPrompt: "Không, vậy là đủ cho mình rồi",
        }
      : null,
    actions: similarRecs.length
      ? [
          { type: "view_detail", label: "Xem chi tiết" },
          { type: "add_to_cart", label: "Thêm vào giỏ" },
          { type: "open_contact", label: "Liên hệ cửa hàng" },
        ]
      : UNAVAILABLE_ACTIONS,
  };
}

function scoreCatalogRowForTopic(row, terms, topicKey = "") {
  const blob = fold([row.name, row.description, row.supplier, ...(row.certifications || [])].join(" "));
  const topicNorm = fold(topicKey || "");
  const nameNorm = fold(row.name || "");
  let score = 0;

  if (topicNorm && nameNorm === topicNorm) score += 50;
  else if (topicNorm && topicNorm.length >= 4 && nameNorm.includes(topicNorm)) score += 35;

  if (topicNorm && topicNorm.includes(" ") && blob.includes(topicNorm)) {
    score += 30;
  }

  const blockBareChanh =
    topicNorm === "chanh day" || topicNorm === "chanh leo" || topicNorm.includes("chanh d");

  for (const term of terms) {
    if (!term || term.length < 2) continue;
    const tn = fold(term);
    if (blockBareChanh && (tn === "chanh" || tn === "day" || tn === "leo")) continue;
    if (topicNorm === "chanh" && (blob.includes("chanh day") || blob.includes("chanh leo")) && tn === "chanh") {
      continue;
    }
    if (tn.length <= 3 && !tn.includes(" ")) {
      if (topicTokenMatchesProductName(tn, nameNorm)) score += 7;
    } else if (foldHasToken(blob, tn)) {
      score += tn.length >= 6 ? 12 : tn.length >= 4 ? 8 : 4;
    } else if (topicNorm.length >= 2) {
      const nameWords = nameNorm.split(/\s+/).filter(Boolean);
      if (nameWords.some((nw) => nw === tn || (tn.length >= 4 && nw.startsWith(tn)))) {
        score += tn.length >= 4 ? 10 : 7;
      }
    }
  }
  return score;
}

const QUERY_STOP_TOKENS = new Set([
  "cho", "toi", "tôi", "ve", "về", "cua", "của", "gioi", "giới", "thieu", "thiệu",
  "tac", "tác", "dung", "dụng", "loi", "lợi", "ich", "ích", "cong", "công",
  "minh", "ban", "bạn", "la", "là", "gi", "gì", "the", "nào", "mua", "tim", "tìm",
  "can", "cần", "co", "có", "shop", "cua", "cửa", "hang", "hàng", "san", "sản",
  "pham", "phẩm", "nong", "nông", "com", "cơm", "an", "ăn", "uong", "uống",
]);

/** Từ khóa khách đang tìm (tên loại SP, nguyên liệu…) */
function extractQueryTerms(message) {
  const { isIntro, topic } = detectProductIntroQuery(message);
  if (isIntro && topic) return topicMatchTerms(topic);
  const phrase = extractFoodPhraseFromText(message);
  if (phrase) return topicMatchTerms(phrase);
  const q = normalize(message);
  const tokens = q.split(/[^a-z0-9àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]+/).filter((t) => t.length >= 2);
  const terms = tokens.filter((t) => !QUERY_STOP_TOKENS.has(t));
  return terms.length ? terms : tokens;
}

function hasSpecificProductIntent(message) {
  const q = normalize(message);
  const { isIntro } = detectProductIntroQuery(message);
  if (isIntro) return true;
  const terms = extractQueryTerms(message);
  if (!terms.length) return false;
  if (/mua|tìm|tim|cần|can|tham\s*khảo|tham\s*khao|có\s*không|co\s*khong|gợi\s*ý|goi\s*y|bán|ban|shop|cửa\s*hàng|san\s*pham|sản\s*phẩm|tương\s*tự|tuong\s*tu/i.test(q)) return true;
  return terms.some((t) => t.length >= 3);
}

function scoreProductDocForTerms(product, terms, topicKey = "") {
  return scoreCatalogRowForTopic(
    {
      name: product.name,
      description: product.description,
      supplier: product.supplier,
      certifications: product.certifications || [],
    },
    terms,
    topicKey
  );
}

function resolveTopicKey(message, catalog = null, conversationMessages = []) {
  const similarTopic = extractTopicFromSimilarRequest(message);
  if (similarTopic) return similarTopic;

  const { isIntro, topic: introTopic } = detectProductIntroQuery(message, catalog);
  const explicit = extractExplicitFoodTopic(message);
  if (isIntro) {
    const introWords = significantTopicWords(introTopic);
    const explicitWords = significantTopicWords(explicit);
    if (explicit && explicitWords.length > introWords.length) return explicit;
    if (introTopic) return introTopic;
    if (explicit) return explicit;
  }
  const hardcoded = extractFoodPhraseFromText(message);
  if (hardcoded) return hardcoded;
  if (catalog?.length) {
    const fromCatalog = extractCatalogPhraseFromText(message, catalog);
    if (fromCatalog) return fromCatalog;
  }
  const bare = extractBareProductQuery(message, catalog);
  if (bare) return bare;
  if (conversationMessages?.length) {
    const fromHistory = resolveTopicFromConversation(conversationMessages, catalog);
    if (fromHistory) return fromHistory;
  }
  return "";
}

function buildCatalogIntroText(topicKey, scoredMatches) {
  if (!scoredMatches?.length) return "";
  const top = scoredMatches[0].row;
  const desc = (top.description || "").trim();
  if (desc) {
    return `${top.name} là sản phẩm đang có tại FreshFarm Organic. ${desc}`;
  }
  const label = topicKey || top.name;
  return `${top.name} đang có sẵn tại cửa hàng — phù hợp nếu bạn muốn trải nghiệm ${label} từ nguồn hàng tươi.`;
}

/** Chọn phần giới thiệu tốt nhất: catalog → phân biệt tên → OpenAI → mẫu chung */
function pickIntroAnswer({ topicKey, scored, llmAnswer = "" }) {
  const catalogIntro = buildCatalogIntroText(topicKey, scored);
  const disambiguation = lookupDisambiguationBenefits(topicKey);
  const llm = (llmAnswer || "").trim();

  if (scored?.length && catalogIntro) return catalogIntro;
  if (disambiguation) return disambiguation;
  if (llm && !isGenericBenefitsText(llm)) return llm;
  if (catalogIntro) return catalogIntro;
  if (llm) return llm;
  return buildGenericBenefitsFallback(topicKey);
}

function buildGenericBenefitsFallback(topic) {
  const label = topic || "loại thực phẩm này";
  return `${label.charAt(0).toUpperCase() + label.slice(1)} là nông sản/thực phẩm tự nhiên, thường được dùng trong chế biến và bổ sung dinh dưỡng hằng ngày. Bạn nên chọn nguồn gốc rõ ràng, hạn sử dụng còn tốt và dùng vừa phải phù hợp thể trạng.`;
}

/** Ưu tiên SP trong catalog khớp đúng chủ đề khách hỏi — áp dụng mọi sản phẩm shop */
function mergeTopicRecommendations(message, result, catalog, maxItems = 5, conversationMessages = []) {
  const topicKey = resolveTopicKey(message, catalog, conversationMessages);
  if (!topicKey || !catalog?.length || !result) return result;

  if (isSimilarProductsRequest(message)) {
    const similarPicked = findSimilarForUnavailableTopic(catalog, topicKey, maxItems);
    return { ...result, ...buildSimilarProductsResult(topicKey, similarPicked, maxItems, { brief: true }) };
  }

  const terms = topicMatchTerms(topicKey);
  const { isIntro } = detectProductIntroQuery(message, catalog);
  const llmAnswer = (result.answer || "").trim();
  const { matches: scored, relation } = findRelatedCatalogMatches(topicKey, catalog, maxItems + 3);
  const hasExact = relation === "exact";
  const hasCatalog = scored.length > 0;
  const hasRelated = relation === "related";

  if (!hasCatalog && !isIntro) {
    const similarPicked = findSimilarForUnavailableTopic(catalog, topicKey, maxItems);
    return { ...result, ...buildSimilarProductsResult(topicKey, similarPicked, maxItems) };
  }

  const existingIds = new Set((result.recommendations || []).map((r) => String(r.productId)));
  const boosted = [];
  for (const { row, score } of scored) {
    if (existingIds.has(row.productId)) continue;
    boosted.push({
      productId: row.productId,
      name: row.name,
      unit: row.unit,
      price: row.price,
      supplier: row.supplier,
      expiryInfo: `HSD: ${row.expiryDate}`,
      reason: `Sản phẩm "${row.name}" đúng với "${topicKey}" bạn đang hỏi và đang có sẵn tại cửa hàng.`,
      matchScore: Math.min(1, 0.88 + score * 0.01),
    });
    if (boosted.length >= maxItems) break;
  }

  const strongMatches = scored.filter((s) => isStrongCatalogTopicMatch(s.row, topicKey, s.score));
  const introNameMatches = hasExact
    ? strongMatches.filter((s) => catalogNameMatchesTopic(s.row, topicKey))
    : strongMatches;
  const matchedNames = introNameMatches.slice(0, maxItems).map((s) => s.row.name);
  const productLine = matchedNames.length
    ? `\n\nTại FreshFarm Organic, bạn có thể tham khảo: ${matchedNames.join(", ")}.`
    : "";

  let answer = llmAnswer;
  let similarPicked = [];

  if (isIntro && hasCatalog) {
    const picks = (hasExact ? introNameMatches : strongMatches).slice(0, maxItems);
    if (hasExact) {
      answer = pickIntroAnswer({ topicKey, scored: picks, llmAnswer }) + productLine;
    } else if (hasRelated) {
      answer = pickIntroAnswer({ topicKey, scored: [], llmAnswer });
      if (!/chưa có|hết hàng|không có/i.test(answer)) {
        answer += `\n\nHiện cửa hàng chưa có "${topicKey}" đúng tên, nhưng bạn có thể tham khảo các mặt hàng liên quan:`;
      }
      answer += productLine;
    }
    const reasonText = hasRelated
      ? `Sản phẩm liên quan đến "${topicKey}" đang có sẵn tại cửa hàng.`
      : `Sản phẩm đúng với "${topicKey}" bạn đang hỏi và đang có sẵn tại cửa hàng.`;
    const catalogOnly = picks.map((s) => ({
      productId: s.row.productId,
      name: s.row.name,
      unit: s.row.unit,
      price: s.row.price,
      supplier: s.row.supplier,
      expiryInfo: `HSD: ${s.row.expiryDate}`,
      reason: reasonText,
      matchScore: Math.min(1, 0.88 + s.score * 0.01),
    }));
    return { ...result, answer: answer.trim(), recommendations: catalogOnly };
  }

  if (isIntro && !hasCatalog) {
    answer = pickIntroAnswer({ topicKey, scored: [], llmAnswer });

    if (!/chưa có|hết hàng|không có sản phẩm/i.test(answer)) {
      answer += `\n\nHiện FreshFarm Organic chưa có sản phẩm "${topicKey}" hoặc mặt hàng liên quan đang sẵn hàng.`;
    }

    similarPicked = findSimilarForUnavailableTopic(catalog, topicKey, maxItems);
    if (lookupDisambiguationBenefits(topicKey)) {
      similarPicked = similarPicked.filter((s) => !hasDistinctSubtypeConflict(topicKey, s.row));
    }
    if (similarPicked.length) {
      const simNames = similarPicked.map((s) => `"${s.row.name}"`).join(", ");
      answer += `\n\nGợi ý sản phẩm tương tự đang có sẵn: ${simNames}.`;
    }
    const similarRecs = similarPicked.map(({ row, score }) => ({
      productId: row.productId,
      name: row.name,
      unit: row.unit,
      price: row.price,
      supplier: row.supplier,
      expiryInfo: `HSD: ${row.expiryDate}`,
      reason: `Sản phẩm tương tự "${topicKey}" đang có sẵn tại cửa hàng.`,
      matchScore: Math.min(1, 0.75 + (score || 0) * 0.01),
    }));
    const quickYesNo = similarRecs.length
      ? {
          question: "Bạn có muốn xem thêm sản phẩm tương tự khác không?",
          yesPrompt: `Có, gợi ý thêm sản phẩm tương tự ${topicKey}`,
          noPrompt: "Không, vậy là đủ cho mình rồi",
        }
      : {
          question: `Bạn có muốn xem thêm sản phẩm tương tự "${topicKey}" không?`,
          yesPrompt: `Có, gợi ý thêm sản phẩm tương tự ${topicKey}`,
          noPrompt: "Không, vậy là đủ cho mình rồi",
        };
    return {
      ...result,
      answer: answer.trim(),
      recommendations: similarRecs,
      quickYesNo,
      followUpQuestions: normalizeFollowUpQuestions([
        similarRecs.length ? "Cho mình xem thêm sản phẩm tương tự khác" : `Có, gợi ý thêm sản phẩm tương tự ${topicKey}`,
        "Mình muốn xem trang Sản phẩm",
        "Cho mình gợi ý sản phẩm khác đang có sẵn",
      ]),
    };
  } else if (boosted.length) {
    const topName = boosted[0]?.name;
    if (topName && !answer.includes(topName)) {
      answer += `\n\nTại cửa hàng đang có "${topName}" — bạn có thể tham khảo sản phẩm này.`;
    }
  }

  const filteredExisting = (result.recommendations || []).filter((r) => {
    if (isIntro && !hasExact) return false;
    const row = catalog.find((c) => c.productId === r.productId);
    if (!row) return false;
    return isStrongCatalogTopicMatch(row, topicKey, scoreCatalogRowForTopic(row, terms, topicKey));
  });

  const merged = boosted.length ? [...boosted] : [];
  const similarRecs = similarPicked.map(({ row, score }) => ({
    productId: row.productId,
    name: row.name,
    unit: row.unit,
    price: row.price,
    supplier: row.supplier,
    expiryInfo: `HSD: ${row.expiryDate}`,
    reason: `Sản phẩm tương tự "${topicKey}" đang có sẵn tại cửa hàng.`,
    matchScore: Math.min(1, 0.75 + (score || 0) * 0.01),
  }));

  const pool = boosted.length
    ? filteredExisting
    : scored.length
      ? scored.map((s) => ({
          productId: s.row.productId,
          name: s.row.name,
          unit: s.row.unit,
          price: s.row.price,
          supplier: s.row.supplier,
          expiryInfo: `HSD: ${s.row.expiryDate}`,
          reason: `Sản phẩm "${s.row.name}" đúng với "${topicKey}" bạn đang hỏi và đang có sẵn tại cửa hàng.`,
          matchScore: Math.min(1, 0.88 + s.score * 0.01),
        }))
      : similarRecs;

  for (const r of pool) {
    if (merged.length >= maxItems) break;
    if (!merged.some((m) => m.productId === r.productId)) merged.push(r);
  }

  if (!merged.length && !isIntro) return result;

  return { ...result, answer: answer.trim(), recommendations: merged };
}

function topicReferenceForLLM(topicKey, catalog = []) {
  const ref = lookupDisambiguationBenefits(topicKey);
  if (ref) {
    return `\n\nMÔ TẢ THAM CHIẾU cho "${topicKey}" (dùng làm cơ sở, không nhầm với loại khác):\n${ref}`;
  }
  const matches = findCatalogTopicMatches(topicKey, catalog, 3);
  if (matches.length) {
    const lines = matches
      .map(({ row }) => {
        const desc = (row.description || "").trim();
        return desc
          ? `- ${row.name}: ${desc}`
          : `- ${row.name} — đang có sẵn tại cửa hàng.`;
      })
      .join("\n");
    return `\n\nSẢN PHẨM CỬA HÀNG liên quan "${topicKey}" (ưu tiên giới thiệu và gợi ý các mặt hàng này):\n${lines}`;
  }
  if (!topicKey) return "";
  return `\n\nKhách đang hỏi giới thiệu về "${topicKey}". Viết 3–6 câu tiếng Việt về đặc điểm, dinh dưỡng và cách dùng phổ biến. Nếu không có sản phẩm khớp tên trong catalog thì nói rõ cửa hàng chưa có hàng đó và gợi ý tối đa 3 sản phẩm tương tự còn trong danh sách.`;
}

/** Tìm SP khớp từ khóa — phân tách còn hàng / hết hàng (kể cả SP không nằm trong catalog gợi ý) */
async function findAvailabilityByTerms(terms, topicKey = "") {
  if (!terms.length) return { inStock: [], outOfStock: [] };
  const products = await Product.find({ isActive: true })
    .select("name description supplier certifications unit price salePrice categoryId")
    .lean();
  await refreshBatchStatuses();
  const stockMap = await sumAvailableStockForProductIds(products.map((p) => p._id));

  const inStock = [];
  const outOfStock = [];
  for (const p of products) {
    const score = scoreProductDocForTerms(p, terms, topicKey);
    if (score <= 0) continue;
    const row = {
      productId: p._id.toString(),
      name: p.name,
      categoryId: p.categoryId ? String(p.categoryId) : "",
      score,
      stock: stockMap.get(p._id.toString()) || 0,
    };
    if (row.stock > 0) inStock.push(row);
    else outOfStock.push(row);
  }
  inStock.sort((a, b) => b.score - a.score);
  outOfStock.sort((a, b) => b.score - a.score);
  return { inStock, outOfStock };
}

const UNAVAILABLE_FOLLOW_UPS = [
  "Tôi muốn để lại liên hệ khi cửa hàng có hàng",
  "Cho mình gợi ý sản phẩm khác đang có sẵn",
  "Mình muốn xem trang Liên hệ cửa hàng",
];

const UNAVAILABLE_ACTIONS = [
  { type: "open_contact", label: "Liên hệ cửa hàng" },
  { type: "view_products", label: "Xem trang Sản phẩm" },
];

/** Trả lời khi không có SP liên quan đang bán hoặc đang hết hàng — kèm gợi ý tương tự */
function buildUnavailableProductResponse({
  topicLabel,
  terms,
  topicKey = "",
  benefitsText,
  outOfStock,
  includeBenefits = false,
  catalog = [],
  maxItems = 3,
}) {
  const label = topicLabel || topicKey || (terms && terms.length ? terms[terms.length - 1] : "") || "sản phẩm bạn hỏi";
  const outNames = (outOfStock || []).slice(0, 3).map((p) => `"${p.name}"`);
  const similar = findSimilarInCatalog(catalog, { terms: terms || [], topicKey: topicKey || topicLabel, outOfStock, maxItems });

  let answer = "";
  if (includeBenefits && benefitsText) {
    answer = benefitsText;
  }

  if (outNames.length) {
    const stockNote =
      outNames.length === 1
        ? `Cửa hàng có ${outNames[0]} trong danh mục nhưng hiện đang hết hàng hoặc lô hàng chưa đủ điều kiện bán.`
        : `Cửa hàng có các mặt hàng ${outNames.join(", ")} liên quan đến "${label}" nhưng hiện đang hết hàng hoặc lô hàng chưa đủ điều kiện bán.`;
    answer = answer ? `${answer}\n\n${stockNote}` : stockNote;
  } else {
    const missingNote = `Hiện FreshFarm Organic chưa có sản phẩm liên quan đến "${label}" đang sẵn hàng.`;
    answer = answer ? `${answer}\n\n${missingNote}` : missingNote;
  }

  if (similar.length) {
    const simNames = similar.map((s) => `"${s.row.name}"`).join(", ");
    answer += `\n\nGợi ý ${similar.length === 1 ? "sản phẩm tương tự" : "các sản phẩm tương tự"} đang có sẵn: ${simNames}.`;
  } else {
    answer += " Bạn có thể liên hệ cửa hàng để được báo khi có hàng trở lại, hoặc xem thêm tại trang Sản phẩm.";
  }

  const recommendations = catalogRowsToRecommendations(similar, () =>
    `Sản phẩm tương tự "${label}" đang có sẵn tại cửa hàng.`
  );

  const actions = similar.length
    ? [
        { type: "view_detail", label: "Xem chi tiết" },
        { type: "add_to_cart", label: "Thêm vào giỏ" },
        { type: "open_contact", label: "Liên hệ cửa hàng" },
      ]
    : UNAVAILABLE_ACTIONS;

  return {
    answer,
    recommendations,
    followUpQuestions: normalizeFollowUpQuestions([
      similar.length ? "Cho mình xem thêm sản phẩm tương tự khác" : "Tôi muốn để lại liên hệ khi cửa hàng có hàng",
      "Mình muốn xem trang Sản phẩm",
      "Cho mình gợi ý món ăn với sản phẩm trên",
    ]),
    cookingSuggestions: [],
    quickYesNo: similar.length
      ? {
          question: "Bạn có muốn xem thêm sản phẩm tương tự khác không?",
          yesPrompt: `Có, gợi ý thêm sản phẩm tương tự ${label}`,
          noPrompt: "Không, vậy là đủ cho mình rồi",
        }
      : null,
    actions,
  };
}

/** OpenAI trả recommendations rỗng — bổ sung thông tin hết hàng + SP tương tự */
async function applyUnavailableFallbackIfNeeded(message, result, catalog = []) {
  if (result.recommendations?.length) return result;
  if (!hasSpecificProductIntent(message)) return result;

  const terms = extractQueryTerms(message);
  if (!terms.length) return result;

  const topicKey = resolveTopicKey(message, catalog);
  const { outOfStock } = await findAvailabilityByTerms(terms, topicKey);
  const { isIntro } = detectProductIntroQuery(message, catalog);
  const llmAnswer = typeof result.answer === "string" ? result.answer.trim() : "";

  const fallback = buildUnavailableProductResponse({
    topicLabel: topicKey || terms[terms.length - 1],
    terms,
    topicKey,
    outOfStock,
    benefitsText: isIntro && llmAnswer ? llmAnswer : undefined,
    includeBenefits: isIntro && Boolean(llmAnswer),
    catalog,
    maxItems: 3,
  });

  if (!isIntro && llmAnswer && /hết hàng|chưa có|không có|không còn|chưa bán/i.test(llmAnswer)) {
    if (fallback.recommendations?.length) {
      const simNames = fallback.recommendations.map((r) => `"${r.name}"`).join(", ");
      fallback.answer = `${llmAnswer}\n\nGợi ý sản phẩm tương tự đang có sẵn: ${simNames}.`;
    } else {
      fallback.answer = llmAnswer;
    }
    if (result.followUpQuestions?.length) fallback.followUpQuestions = result.followUpQuestions;
  } else if (!isIntro && llmAnswer) {
    fallback.answer = `${llmAnswer}\n\n${fallback.answer}`;
  }

  return fallback;
}

function catalogRowsToRecommendations(rows, reasonFn) {
  return rows.map(({ row, score }) => ({
    productId: row.productId,
    name: row.name,
    unit: row.unit,
    price: row.price,
    supplier: row.supplier,
    expiryInfo: `HSD: ${row.expiryDate}`,
    reason: typeof reasonFn === "function" ? reasonFn(row, score) : reasonFn,
    matchScore: Math.min(1, 0.7 + (score || 0) * 0.04),
  }));
}

function buildIngredientBenefitsText(topic, catalog = [], llmAnswer = "") {
  const scored = findCatalogTopicMatches(topic, catalog, 3);
  return pickIntroAnswer({ topicKey: topic, scored, llmAnswer });
}

/** Mock: giới thiệu tác dụng + gợi ý SP shop liên quan */
async function buildProductIntroMockResponse(topic, catalog, maxItems) {
  const terms = topicMatchTerms(topic);
  const topicLabel = topic || "thực phẩm";
  const benefits = buildIngredientBenefitsText(topic, catalog);

  const scored = catalog
    .map((row) => ({ row, score: scoreCatalogRowForTopic(row, terms, topicLabel) }))
    .sort((a, b) => b.score - a.score || b.row.stock - a.row.stock);

  const picked = scored.filter((x) => x.score > 0).slice(0, maxItems);

  if (!picked.length) {
    const { outOfStock } = await findAvailabilityByTerms(terms, topicLabel);
    const benefits = buildIngredientBenefitsText(topic, catalog);
    return buildUnavailableProductResponse({
      topicLabel,
      terms,
      topicKey: topicLabel,
      benefitsText: isGenericBenefitsText(benefits) ? undefined : benefits,
      outOfStock,
      includeBenefits: !isGenericBenefitsText(benefits),
      catalog,
      maxItems,
    });
  }

  const productNames = picked.map((x) => x.row.name);
  let answer = benefits;
  answer += `\n\nTại FreshFarm Organic, bạn có thể tham khảo: ${productNames.join(", ")}.`;
  answer += ` Đặc biệt "${picked[0].row.name}" đang có sẵn trong kho, phù hợp nếu bạn muốn trải nghiệm sản phẩm liên quan đến ${topicLabel}.`;

  const recommendations = catalogRowsToRecommendations(picked, () =>
    `Sản phẩm trong cửa hàng có liên quan đến ${topicLabel} mà bạn đang tìm hiểu.`
  );

  const byId = Object.fromEntries(catalog.map((c) => [c.productId, c]));
  const validIds = new Set(catalog.map((c) => c.productId));

  return {
    answer,
    recommendations,
    followUpQuestions: normalizeFollowUpQuestions([
      `Tôi muốn mua sản phẩm liên quan đến ${topicLabel}`,
      `Cho mình biết cách dùng ${topicLabel} hằng ngày`,
      `Mình muốn gợi ý món ăn hoặc đồ uống từ ${topicLabel}`,
    ]),
    cookingSuggestions: buildMockCookingSuggestions(picked, byId, validIds),
    quickYesNo: {
      question: `Bạn có muốn xem thêm sản phẩm khác liên quan đến ${topicLabel} không?`,
      yesPrompt: `Có, gợi ý thêm sản phẩm liên quan đến ${topicLabel}`,
      noPrompt: "Không, vậy là đủ cho mình rồi",
    },
    actions: [
      { type: "view_detail", label: "Xem chi tiết" },
      { type: "add_to_cart", label: "Thêm vào giỏ" },
      { type: "add_to_wishlist", label: "Lưu wishlist" },
    ],
  };
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
      categoryId: product.categoryId ? String(product.categoryId) : "",
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

  const { isIntro, topic } = detectProductIntroQuery(message, catalog);
  if (isIntro) {
    return buildProductIntroMockResponse(topic, catalog, maxItems);
  }

  const queryTerms = extractQueryTerms(message);
  const topicKey = resolveTopicKey(message, catalog);
  const specificIntent = hasSpecificProductIntent(message);

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

  if (!picked.length && specificIntent && queryTerms.length) {
    const { inStock, outOfStock } = await findAvailabilityByTerms(queryTerms, topicKey);
    if (!inStock.length) {
      return buildUnavailableProductResponse({
        topicLabel: topicKey || queryTerms[queryTerms.length - 1],
        terms: queryTerms,
        topicKey,
        outOfStock,
        catalog,
        maxItems: Math.min(maxItems, 3),
      });
    }
    const catalogById = Object.fromEntries(catalog.map((c) => [c.productId, c]));
    picked = inStock
      .map((hit) => {
        const row = catalogById[hit.productId];
        return row ? { row, score: hit.score } : null;
      })
      .filter(Boolean)
      .slice(0, maxItems);
    if (!picked.length) {
      return buildUnavailableProductResponse({
        topicLabel: topicKey || queryTerms[queryTerms.length - 1],
        terms: queryTerms,
        topicKey,
        outOfStock,
        catalog,
        maxItems: Math.min(maxItems, 3),
      });
    }
  }

  if (!picked.length) {
    if (specificIntent && queryTerms.length) {
      const { outOfStock } = await findAvailabilityByTerms(queryTerms, topicKey);
      return buildUnavailableProductResponse({
        topicLabel: topicKey || queryTerms[queryTerms.length - 1],
        terms: queryTerms,
        topicKey,
        outOfStock,
        catalog,
        maxItems: Math.min(maxItems, 3),
      });
    }
    picked = scored.slice(0, maxItems);
  }

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
    : specificIntent
      ? "Mình chưa tìm thấy sản phẩm khớp rõ với yêu cầu của bạn trong kho đang bán."
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
async function suggestWithOpenAI(catalog, maxItems, conversationMessages, topicKey = "", fullCatalog = []) {
  const refCatalog = fullCatalog.length ? fullCatalog : catalog;
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
- CHỈ gợi ý sản phẩm có \`productId\` nằm trong danh sách JSON bên dưới. Danh sách này CHỈ gồm sản phẩm đang còn hàng và lô chưa hết hạn. Không bịa sản phẩm, giá, tồn kho hay hạn sử dụng ngoài dữ liệu đó.
- Giá hiển thị cho khách là \`priceVnd\` (đồng Việt Nam). Có thể nói "khoảng …đ" nếu cần làm tròn nhẹ.
- Nếu khách hỏi vận chuyển/thanh toán: thanh toán COD hoặc QR (chuyển khoản) tùy cửa hàng; phí ship thường miễn khi đơn đạt mức tạm tính (khách xem chi tiết ở bước thanh toán). Không cam kết số tiền cụ thể nếu không chắc.
- Nếu câu hỏi ngoài nông sản/thực phẩm (chính trị, y khoa chẩn đoán, pháp luật…): từ chối lịch sự và gợi ý liên hệ /contact trên website.
- Khi khách hỏi nấu ăn / món / công thức / giảm cân / bữa ăn: trong \`answer\` hoặc khối \`cookingSuggestions\` hãy gợi ý món phù hợp, các bước nấu ngắn (recipeSteps), nguyên liệu thường mua thêm ngoài shop (extraIngredientsNote — được phép là hàng không có trong catalog), và \`relatedProductIds\` chỉ trỏ sản phẩm trong danh sách catalog phù hợp món đó.
- KHI KHÁCH HỎI GIỚI THIỆU / TÁC DỤNG / LỢI ÍCH / CÔNG DỤNG / DINH DƯỠNG về một loại thực phẩm (vd: "giới thiệu cho tôi về tác dụng của cam"):
  • Trong \`answer\`: viết 3–6 câu tiếng Việt giới thiệu lợi ích/dinh dưỡng phổ biến của loại đó (không chẩn đoán bệnh, không thay thế bác sĩ).
  • Sau phần giới thiệu, gợi ý rõ sản phẩm CỦA CỬA HÀNG trong catalog có liên quan (vd: hỏi về cam → ưu tiên "Nước ép cam Cao Phong" nếu có trong danh sách).
  • \`recommendations\` phải chứa các sản phẩm khớp chủ đề nhất; \`reason\` giải thích vì sao sản phẩm shop liên quan đến câu hỏi của khách.
  • \`followUpQuestions\` gợi ý khách mua thử hoặc tìm hiểu thêm (theo góc khách: "Tôi muốn mua...", "Cho mình biết cách dùng...").
- PHÂN BIỆT TÊN TRÁI (bắt buộc — không được nhầm):
  • "chanh" / chanh vàng / chanh xanh = họ cam chanh (citrus). KHÔNG phải chanh dây, KHÔNG phải chanh leo.
  • "chanh dây" = loại trái riêng (passion fruit), vị chua ngọt, ruột vàng hoặc tím. KHÔNG gọi là chanh leo, KHÔNG mô tả như chanh citrus.
  • "chanh leo" = loại trái khác, khác chanh dây và khác chanh citrus.
  • "hồng xiêm" (sapoche) = trái nhiệt đới thịt mềm ngọt. KHÔNG phải hồng/hồng giòn (quả hồng ăn giòn).
  • "hồng giòn" = quả hồng thu hoạch cứng, giòn ngọt. KHÔNG phải hồng xiêm.
  • Khi khách hỏi về "chanh dây" hoặc "quả chanh dây", nếu catalog có sản phẩm tên chứa "Chanh dây" thì PHẢI đưa vào \`recommendations\` và giới thiệu đúng loại trái đó.
- KHI KHÁCH HỎI VỀ MỘT SẢN PHẨM / NGUYÊN LIỆU (bất kỳ tên nào trong shop):
  • Nếu \`name\` trong danh sách catalog khớp hoặc gần khớp với chủ đề khách hỏi → PHẢI ưu tiên đưa sản phẩm đó vào \`recommendations\`.
  • Dùng \`description\` của sản phẩm trong catalog làm cơ sở giới thiệu; không bịa thông tin ngoài dữ liệu có sẵn.
- KHI KHÁCH HỎI SẢN PHẨM / NGUYÊN LIỆU CỤ THỂ mà KHÔNG có trong danh sách catalog (hoặc không còn hàng):
  • Trong \`answer\`: nói rõ cửa hàng hiện chưa có hoặc đang hết hàng mặt hàng liên quan.
  • Gợi ý tối đa 3 \`recommendations\` là sản phẩm TƯƠNG TỰ còn hàng trong catalog (cùng nhóm: đồ uống, rau, trái cây, cùng danh mục…). \`reason\` phải ghi rõ "sản phẩm tương tự".
  • KHÔNG gợi ý sản phẩm hoàn toàn không liên quan.
  • Vẫn có thể trả lời kiến thức chung (tác dụng, dinh dưỡng) nếu khách hỏi giới thiệu.

DANH SÁCH SẢN PHẨM ĐANG CÓ HÀNG (JSON):
${JSON.stringify(catalogPayload)}

Nhiệm vụ: Đọc nhu cầu khách (tin nhắn mới nhất là quan trọng nhất), chọn tối đa ${maxItems} sản phẩm phù hợp nhất (tên, mô tả, chứng nhận, nhà cung cấp, ngữ cảnh như giảm cân, hữu cơ, nấu ăn…).

Trả về DUY NHẤT một object JSON (không markdown), đúng schema:
{
  "answer": "string — lời trả lời tự nhiên cho khách (text thuần, KHÔNG dùng markdown: không **, không #, không danh sách markdown)",
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

Nếu không có sản phẩm đúng ý: gợi ý tối đa 3 sản phẩm tương tự trong catalog (recommendations), answer giải thích hết hàng/chưa có và giới thiệu các món thay thế; không đề xuất sản phẩm lệch chủ đề.${topicReferenceForLLM(topicKey, refCatalog)}`;

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
/** Gỡ markdown trong answer — UI chat hiển thị text thuần, không render ** */
function stripMarkdownFromAnswer(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

function stripLooseSimilarProductMentions(text) {
  return String(text || "")
    .replace(/\s*Tuy nhiên,\s*bạn có thể tham khảo[^.?!]*[.?!]/gi, "")
    .replace(/\s*Bạn có thể tham khảo[^.?!]*(?:như|gồm|các sản phẩm|một số)[^.?!]*[.?!]/gi, "")
    .replace(/\s*[,;.]?\s*(?:đều |cũng )?là những loại trái cây[^.?!]*[.?!]/gi, "")
    .trim();
}
function sanitizeChatResult(result) {
  if (!result || typeof result !== "object") return result;
  if (typeof result.answer === "string") {
    result.answer = stripMarkdownFromAnswer(result.answer);
  }
  return result;
}

async function suggestProductsEntry(message, maxItems = 5, conversationMessages = []) {
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
        return sanitizeChatResult({
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
        });
      }
      const maxCatalogForContext = 55;
      const topicKey = resolveTopicKey(message, catalog);
      const contextCatalog = buildContextCatalogForOpenAI(catalog, topicKey, maxCatalogForContext);
      const model = env.aiModel && env.aiModel !== "mock" ? env.aiModel : "gpt-4o-mini";
      console.info("[chatbot] chế độ: OPENAI — đang gọi API…", {
        model,
        catalogItems: contextCatalog.length,
        topicKey: topicKey || null,
        historyTurns: conv.length,
      });
      const out = await suggestWithOpenAI(contextCatalog, maxItems, conv, topicKey, catalog);
      let finalOut = await applyUnavailableFallbackIfNeeded(message, out, catalog);
      finalOut = mergeTopicRecommendations(message, finalOut, catalog, maxItems, conv);
      console.info(
        "[chatbot] chế độ: OPENAI — hoàn tất.",
        "Gợi ý:",
        finalOut.recommendations?.length ?? 0,
        "sản phẩm."
      );
      return sanitizeChatResult(finalOut);
    } catch (err) {
      console.error("[chatbot] OpenAI lỗi → chuyển sang GIẢ LẬP (mock):", err.message || err);
      console.info("[chatbot] chế độ: GIẢ LẬP (mock — fallback sau lỗi OpenAI).");
    }
  }

  return sanitizeChatResult(await suggestProductsMock(message, maxItems));
}

async function suggestProducts(message, maxItems = 5, conversationMessages = []) {
  return suggestProductsEntry(message, maxItems, conversationMessages);
}

module.exports = { suggestProducts, buildEligibleCatalog, trimConversationForLLM };
