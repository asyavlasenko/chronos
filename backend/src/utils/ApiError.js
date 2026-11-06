/**
 * Операційна помилка з HTTP-статусом. Кидай її з сервісів/контролерів,
 * errorHandler перетворить на JSON-відповідь.
 *
 *   throw new ApiError(404, 'Подію не знайдено');
 *   throw new ApiError(400, 'Помилка валідації', [{ field: 'email', message: '…' }]);
 */
export default class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
