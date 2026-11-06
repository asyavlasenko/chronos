import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

/**
 * Централізований обробник помилок. Усі помилки з контролерів/сервісів потрапляють сюди через next(err).
 * Формат відповіді: { status: 'error', message, details? }
 */
// eslint-disable-next-line no-unused-vars
export default function errorHandler(err, req, res, next) {
  let error = err;

  if (!(error instanceof ApiError)) {
    // TODO(@teammate1): мапити типові помилки —
    //   mongoose.Error.ValidationError → 400 з details по полях
    //   mongoose.Error.CastError → 400 «Некоректний id»
    //   MongoServerError code 11000 → 409 «Вже існує»
    //   jsonwebtoken JsonWebTokenError / TokenExpiredError → 401
    //   SyntaxError від express.json() → 400 «Некоректний JSON»
    error = new ApiError(
      err.statusCode || err.status || 500,
      err.message || 'Внутрішня помилка сервера',
    );
  }

  if (error.statusCode >= 500) {
    console.error(err);
  }

  res.status(error.statusCode).json({
    status: 'error',
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
    ...(env.isProduction ? {} : { stack: err.stack }),
  });
}
