export default class ApiError extends Error {
  constructor(statusCode, message, details, code) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
