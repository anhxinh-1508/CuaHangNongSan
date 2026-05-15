const path = require("path");
const dotenv = require("dotenv");

// Luôn đọc server/.env dù process.cwd() là thư mục gốc monorepo hay server/
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || "",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  /**
   * Gửi mail: mặc định Mailjet trước (ổn trên Render). Đặt EMAIL_SMTP_FIRST=true để thử SMTP trước rồi mới Mailjet.
   */
  emailSmtpFirst: (process.env.EMAIL_SMTP_FIRST || "").trim() === "true",
  mailjetApiKey: (process.env.MAILJET_API_KEY || "").trim(),
  mailjetSecretKey: (process.env.MAILJET_SECRET_KEY || "").trim(),
  mailjetSenderName: (process.env.MAILJET_SENDER_NAME || "FreshFarm Organic").trim(),
  mailjetSenderEmail: (process.env.MAILJET_SENDER_EMAIL || "").trim(),
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  aiProvider: (process.env.AI_PROVIDER || "mock").trim(),
  aiApiKey: (process.env.AI_API_KEY || "").trim(),
  aiModel: (process.env.AI_MODEL || "gpt-4o-mini").trim(),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  allowGuestCheckout: (process.env.ALLOW_GUEST_CHECKOUT || "true") === "true",
};

module.exports = env;
