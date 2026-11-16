import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

function toApiError(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return new ApiError(400, 'Помилка валідації', details);
  }

  if (err instanceof mongoose.Error.CastError) {
    return new ApiError(400, 'Некоректний ідентифікатор або значення поля');
  }

  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
    const details = field ? [{ field, message: 'Таке значення вже використовується' }] : undefined;
    return new ApiError(409, 'Такий запис уже існує', details);
  }

  if (err instanceof jwt.JsonWebTokenError) {
    return new ApiError(401, 'Сесія недійсна або закінчилась, увійди знову');
  }

  if (err?.type === 'entity.parse.failed') {
    return new ApiError(400, 'Некоректний JSON у тілі запиту');
  }

  if (err?.type === 'entity.too.large') {
    return new ApiError(413, 'Запит завеликий');
  }

  const status = err?.statusCode || err?.status || 500;
  const message = status >= 500 && env.isProduction ? 'Внутрішня помилка сервера' : err?.message;
  return new ApiError(status, message || 'Внутрішня помилка сервера');
}

export default function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  const error = toApiError(err);

  if (error.statusCode >= 500 && !env.isTest) {
    console.error(err);
  }

  res.status(error.statusCode).json({
    status: 'error',
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
    ...(env.nodeEnv === 'development' ? { stack: err?.stack } : {}),
  });
}
