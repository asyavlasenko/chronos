import Joi from 'joi';

export const inviteTokenSchema = Joi.string().hex().length(64).required().label('Токен');

export const isInviteToken = (value) => !inviteTokenSchema.validate(value).error;
