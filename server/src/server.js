/** Mọi thao tác Date dùng múi VN (setHours, v.v.) — BSON trong MongoDB vẫn là UTC. */
process.env.TZ = "Asia/Ho_Chi_Minh";

/** Tránh DNS IPv6 trước khiến kết nối SMTP (Gmail) timeout trên một số môi trường cloud (Render, v.v.) */
try {
  const dns = require("dns");
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
} catch {
  /* ignore */
}

const app = require("./app");
const env = require("./config/env");
const { connectDb } = require("./config/db");
const { backfillProductSearchFields } = require("./services/productSearchBackfill");

async function bootstrap() {
  await connectDb();
  try {
    await backfillProductSearchFields();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[product-search] Backfill lỗi (có thể bỏ qua nếu DB trống):", e.message);
  }
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`FreshFarm Organic API running on port ${env.port}`);
    if (env.nodeEnv !== "production") {
      const openaiOn =
        (env.aiProvider || "").toLowerCase() === "openai" && Boolean(env.aiApiKey);
      // eslint-disable-next-line no-console
      console.log(
        `[chatbot] AI_PROVIDER=${JSON.stringify(env.aiProvider)} | key ${env.aiApiKey ? "OK" : "THIẾU"} | model=${env.aiModel} → ${openaiOn ? "sẽ gọi OpenAI" : "chỉ mock (xem .env + restart)"}`
      );
    }
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Bootstrap failed", err);
  process.exit(1);
});
