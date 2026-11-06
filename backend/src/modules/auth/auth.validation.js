import Joi from 'joi';

// Схеми-заготовки. Поки описані поля — у коментарях; .unknown(true) пропускає тіло як є.
// Коли опишеш поля — прибери .unknown(true), щоб validate() відкидав зайве.

// { email, password (min 8), name (2..80), country? ('UA'), timezone? ('Europe/Kyiv') }
export const registerSchema = Joi.object().unknown(true); // TODO(@nastia)

// { email, password, remember? (boolean) }
export const loginSchema = Joi.object().unknown(true); // TODO(@nastia)

// { email }
export const passwordResetRequestSchema = Joi.object().unknown(true); // TODO(@nastia)

// { token, password (min 8) }
export const passwordResetConfirmSchema = Joi.object().unknown(true); // TODO(@nastia)
