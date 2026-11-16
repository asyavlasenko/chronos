import Joi from 'joi';

export const listQuerySchema = Joi.object({
  year: Joi.number().integer().min(1970).max(2100).label('Рік'),
  country: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z]{2}$/)
    .label('Країна')
    .messages({
      'string.pattern.base': 'Поле «{{#label}}» має складатися з двох латинських літер',
    }),
});
