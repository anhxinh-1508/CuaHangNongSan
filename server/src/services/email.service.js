const nodemailer = require("nodemailer");
const env = require("../config/env");

let _transporter = null;

/** Gmail App Password thường có dấu cách — bỏ khoảng trắng để tránh lỗi auth trên một số host */
function smtpPassNormalized() {
  return String(env.smtpPass || "").replace(/\s+/g, "");
}

function usesMailjet() {
  return (
    Boolean(env.mailjetApiKey) &&
    Boolean(env.mailjetSecretKey) &&
    Boolean(env.mailjetSenderEmail)
  );
}

function usesSmtp() {
  const pass = smtpPassNormalized();
  return Boolean(env.smtpHost?.trim() && env.smtpUser?.trim() && pass);
}

/** Cần ít nhất SMTP đủ biến hoặc Mailjet đủ biến */
function assertEmailConfigured() {
  if (usesSmtp() || usesMailjet()) return;
  const err = new Error(
    "Chưa cấu hình gửi email. Thêm SMTP_HOST + SMTP_USER + SMTP_PASS và/hoặc MAILJET_*."
  );
  err.code = "SMTP_NOT_CONFIGURED";
  throw err;
}

/**
 * Mailjet Send API v3.1 (HTTPS). Gói Free: giới hạn theo Mailjet (thường vài nghìn email/tháng).
 * Cần xác minh địa chỉ người gửi trong dashboard (không bắt buộc domain).
 * @see https://dev.mailjet.com/email/guides/send-api-v31/#send-a-basic-email
 */
async function sendViaMailjet({ to, subject, html }) {
  const auth = Buffer.from(`${env.mailjetApiKey}:${env.mailjetSecretKey}`).toString("base64");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 25_000);
  try {
    const res = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Messages: [
          {
            From: {
              Email: env.mailjetSenderEmail,
              Name: env.mailjetSenderName || "FreshFarm Organic",
            },
            To: [{ Email: to }],
            Subject: subject,
            HTMLPart: html,
          },
        ],
      }),
      signal: ac.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msgs = data.Messages?.[0]?.Errors || data.ErrorMessage || [];
      const msg =
        (Array.isArray(msgs) && msgs[0]?.ErrorMessage) ||
        (typeof data.ErrorMessage === "string" ? data.ErrorMessage : null) ||
        `HTTP ${res.status}`;
      const e = new Error(String(msg));
      e.code = "EMAILJET";
      e.status = res.status;
      throw e;
    }
    if (data.Messages?.[0]?.Status === "error") {
      const msgs = data.Messages?.[0]?.Errors || [];
      const msg = (Array.isArray(msgs) && msgs[0]?.ErrorMessage) || "Mailjet từ chối gửi";
      const e = new Error(String(msg));
      e.code = "EMAILJET";
      throw e;
    }
  } finally {
    clearTimeout(timer);
  }
}

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport(buildTransportOptions());
  }
  return _transporter;
}

function resetTransporter() {
  _transporter = null;
}

/** smtp.gmail.com → dùng preset Gmail (465 SSL), thường ổn định hơn 587 STARTTLS trên Render */
function isGmailSmtpHost() {
  const h = String(env.smtpHost || "")
    .trim()
    .toLowerCase();
  return h === "smtp.gmail.com" || h === "gmail";
}

function buildTransportOptions() {
  const pass = smtpPassNormalized();
  const user = env.smtpUser.trim();

  const longTimeouts = {
    pool: false,
    connectionTimeout: 45_000,
    greetingTimeout: 45_000,
    socketTimeout: 60_000,
  };

  /**
   * Gmail: mặc định dùng preset (thường là 465 SSL).
   * Nếu bạn đặt SMTP_PORT=587 → ép dùng STARTTLS trên 587 (chuẩn submission).
   */
  if (isGmailSmtpHost() && env.smtpPort !== 587) {
    return {
      service: "gmail",
      auth: { user, pass },
      ...longTimeouts,
    };
  }

  const host = env.smtpHost.trim();
  const port = env.smtpPort;
  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    ...longTimeouts,
    requireTLS: port === 587,
    tls: {
      minVersion: "TLSv1.2",
      servername: host,
    },
  };
}

async function sendViaSmtp({ to, subject, html }) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"FreshFarm Organic" <${env.smtpUser}>`,
    to,
    subject,
    html,
  });
}

/**
 * Mặc định: Mailjet trước (HTTPS, ổn trên Render). SMTP Gmail trên cloud thường treo 30–60s → request timeout trước khi fallback.
 * EMAIL_SMTP_FIRST=true: thử SMTP trước, lỗi thì Mailjet (phù hợp máy local có cả hai).
 */
async function deliverTransactionalMail({ to, subject, html }) {
  const smtpOk = usesSmtp();
  const mjOk = usesMailjet();

  if (!smtpOk && !mjOk) {
    const err = new Error("Chưa cấu hình gửi email.");
    err.code = "SMTP_NOT_CONFIGURED";
    throw err;
  }

  const preferSmtpFirst = env.emailSmtpFirst && smtpOk && mjOk;

  if (preferSmtpFirst) {
    try {
      await sendViaSmtp({ to, subject, html });
      return;
    } catch (e) {
      resetTransporter();
      console.warn("[Email] SMTP thất bại, thử Mailjet:", e.message);
      await sendViaMailjet({ to, subject, html });
      return;
    }
  }

  if (mjOk) {
    try {
      await sendViaMailjet({ to, subject, html });
      return;
    } catch (e) {
      if (smtpOk) {
        console.warn("[Email] Mailjet thất bại, thử SMTP:", e.message);
        try {
          await sendViaSmtp({ to, subject, html });
          return;
        } catch (smtpErr) {
          resetTransporter();
          throw smtpErr;
        }
      }
      throw e;
    }
  }

  await sendViaSmtp({ to, subject, html });
}

function htmlVerifyOtp(otp) {
  return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px;">
        <h2 style="color:#2e7d32;margin-bottom:8px;">FreshFarm Organic 🌿</h2>
        <p style="color:#555;">Xin chào,</p>
        <p style="color:#555;">Đây là mã OTP xác thực tài khoản của bạn:</p>
        <div style="text-align:center;margin:24px 0;">
          <span style="display:inline-block;font-size:36px;font-weight:bold;letter-spacing:12px;color:#2e7d32;background:#f1f8e9;padding:16px 32px;border-radius:8px;">${otp}</span>
        </div>
        <p style="color:#888;font-size:13px;">Mã có hiệu lực trong <strong>10 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
        <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;"/>
        <p style="color:#bbb;font-size:12px;">Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này.</p>
      </div>
    `;
}

function htmlResetPasswordOtp(otp) {
  return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px;">
        <h2 style="color:#2e7d32;margin-bottom:8px;">FreshFarm Organic 🌿</h2>
        <p style="color:#555;">Xin chào,</p>
        <p style="color:#555;">Bạn vừa yêu cầu đặt lại mật khẩu. Đây là mã OTP của bạn:</p>
        <div style="text-align:center;margin:24px 0;">
          <span style="display:inline-block;font-size:36px;font-weight:bold;letter-spacing:12px;color:#e65100;background:#fff3e0;padding:16px 32px;border-radius:8px;">${otp}</span>
        </div>
        <p style="color:#888;font-size:13px;">Mã có hiệu lực trong <strong>10 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
        <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;"/>
        <p style="color:#bbb;font-size:12px;">Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này.</p>
      </div>
    `;
}

/**
 * Chuyển lỗi gửi mail → HTTP status + message tiếng Việt
 */
function getSmtpFailureInfo(err) {
  if (!err) {
    return {
      status: 500,
      code: "MAIL_ERROR",
      message: "Gửi email thất bại (không rõ lý do).",
    };
  }
  if (err.name === "AbortError") {
    return {
      status: 503,
      code: "MAIL_ERROR",
      message: "Gửi email hết thời gian chờ. Thử lại sau.",
    };
  }
  if (err.code === "EMAILJET") {
    return {
      status: 500,
      code: "MAIL_ERROR",
      message: `Mailjet: ${err.message}. Kiểm tra MAILJET_API_KEY, MAILJET_SECRET_KEY và MAILJET_SENDER_EMAIL đã xác minh trên mailjet.com.`,
    };
  }
  if (err.code === "SMTP_NOT_CONFIGURED") {
    return {
      status: 503,
      code: "MAIL_ERROR",
      message:
        "Chưa cấu hình gửi email: thêm SMTP_* và/hoặc MAILJET_* trên Render.",
    };
  }

  const c = err.code;
  const rc = err.responseCode;

  if (c === "EAUTH" || rc === 535 || rc === 534) {
    return {
      status: 500,
      code: "MAIL_ERROR",
      message:
        "SMTP từ chối đăng nhập: sai tài khoản gửi hoặc mật ứng dụng Gmail. Kiểm tra SMTP_USER và SMTP_PASS trên Render (bật 2FA Gmail → tạo mật ứng dụng, không dùng mật khẩu đăng nhập thường).",
    };
  }

  if (c === "ETIMEDOUT" || c === "ECONNRESET" || c === "ESOCKET" || c === "ECONNREFUSED") {
    return {
      status: 503,
      code: "MAIL_ERROR",
      message:
        "Không kết nối được SMTP (timeout). Trên Render Gmail SMTP thường bị chặn — nên cấu hình MAILJET_* (API) thay cho SMTP.",
    };
  }

  if (c === "ETLS" || c === "ERR_TLS") {
    return {
      status: 503,
      code: "MAIL_ERROR",
      message: "Lỗi TLS khi gửi mail qua SMTP. Thử SMTP_PORT=465 hoặc dùng Mailjet (MAILJET_*) trên Render.",
    };
  }

  if (c === "EMESSAGE" || rc === 550 || rc === 552) {
    return {
      status: 500,
      code: "MAIL_ERROR",
      message: "Máy chủ mail từ chối gửi (địa chỉ người nhận hoặc chính sách gửi).",
    };
  }

  const short = err.message ? String(err.message).slice(0, 240) : "";
  return {
    status: 500,
    code: "MAIL_ERROR",
    message: short
      ? `Gửi email thất bại: ${short}`
      : "Gửi email thất bại. Kiểm tra log API trên Render (dòng [Email]).",
  };
}

/**
 * Gửi OTP xác thực email khi đăng ký tài khoản
 */
async function sendVerifyOtp(toEmail, otp) {
  assertEmailConfigured();
  const subject = "Mã xác thực tài khoản FreshFarm Organic";
  const html = htmlVerifyOtp(otp);
  await deliverTransactionalMail({ to: toEmail, subject, html });
}

/**
 * Gửi OTP đặt lại mật khẩu
 */
async function sendResetPasswordOtp(toEmail, otp) {
  assertEmailConfigured();
  const subject = "Đặt lại mật khẩu FreshFarm Organic";
  const html = htmlResetPasswordOtp(otp);
  await deliverTransactionalMail({ to: toEmail, subject, html });
}

module.exports = { sendVerifyOtp, sendResetPasswordOtp, getSmtpFailureInfo };
