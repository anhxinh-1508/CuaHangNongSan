const FIELD_LABELS = {
  name: "Tên",
  title: "Tiêu đề",
  slug: "Slug",
  email: "Email",
  code: "Mã giảm giá",
  batchCode: "Mã lô hàng",
};

function errorHandler(err, req, res, next) {
  /* MongoDB duplicate key (E11000) → 409 */
  if (err.code === 11000) {
    const key = Object.keys(err.keyValue || {})[0] || "";
    const label = FIELD_LABELS[key] || key || "Giá trị";
    return res.status(409).json({
      code: "DUPLICATE_KEY",
      message: `${label} đã tồn tại`,
      errors: [],
    });
  }

  const status = err.status || 500;
  const payload = {
    code: err.code || "INTERNAL_SERVER_ERROR",
    message: err.message || "Lỗi máy chủ",
    errors: err.errors || [],
  };
  if (process.env.NODE_ENV !== "production" && status >= 500) {
    payload.stack = err.stack;
  }
  res.status(status).json(payload);
}

module.exports = errorHandler;
