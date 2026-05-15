class AppError extends Error {
  constructor(code, message, status = 400, errors = []) {
    super(message);
    this.code = code;
    this.status = status;
    this.errors = errors;
  }
}

module.exports = AppError;
