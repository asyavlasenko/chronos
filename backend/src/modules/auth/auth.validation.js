import Joi from 'joi';
import { email, password, timezone } from '../../utils/validation.js';

export const registerSchema = Joi.object({
  email: email().required(),
  password: password().required(),
  name: Joi.string().trim().min(2).max(80).required().label('Ім’я'),
  country: Joi.string().trim().uppercase().length(2).label('Країна'),
  timezone: timezone(),
});

export const loginSchema = Joi.object({
  email: email().required(),
  password: Joi.string().max(128).required().label('Пароль'),
  remember: Joi.boolean().default(true).label('Запам’ятати мене'),
});

export const passwordResetRequestSchema = Joi.object({
  email: email().required(),
});

export const passwordResetConfirmSchema = Joi.object({
  token: Joi.string().hex().length(64).required().label('Токен'),
  password: password().required(),
});
