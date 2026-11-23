import Joi from 'joi';

export const MAX_TEXT_LENGTH = 500;

export const draftSchema = Joi.object({
  text: Joi.string().trim().min(2).max(MAX_TEXT_LENGTH).required().label('Текст'),
});
