import Joi from 'joi';
import { ROLES } from '../../constants/index.js';
import { colorKey, email, idParams, objectId } from '../../utils/validation.js';

const name = () => Joi.string().trim().min(1).max(60).label('Назва');

const description = () => Joi.string().trim().max(300).allow('').label('Опис');

const memberRole = () => Joi.string().valid(ROLES.EDITOR, ROLES.VIEWER).label('Роль');

export const createCalendarSchema = Joi.object({
  name: name().required(),
  description: description(),
  color: colorKey().default('blue'),
});

export const updateCalendarSchema = Joi.object({
  name: name(),
  description: description(),
  color: colorKey(),
}).min(1);

export const visibilitySchema = Joi.object({
  isHidden: Joi.boolean().label('Прихований'),
  color: colorKey().allow(null),
}).min(1);

export const shareCalendarSchema = Joi.object({
  email: email().required(),
  role: memberRole().required(),
});

export const updateMemberSchema = Joi.object({
  role: memberRole().required(),
});

export const calendarIdParams = idParams;

export const memberParams = Joi.object({
  id: objectId().required(),
  userId: objectId().required(),
});

export const inviteParams = Joi.object({
  id: objectId().required(),
  inviteId: objectId().required(),
});
