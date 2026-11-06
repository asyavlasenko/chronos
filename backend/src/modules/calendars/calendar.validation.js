import Joi from 'joi';

// { name (1..60), description? (..300), color? (один із COLOR_KEYS) }
export const createCalendarSchema = Joi.object().unknown(true); // TODO(@nastia)

// { name?, description?, color? }
export const updateCalendarSchema = Joi.object().unknown(true); // TODO(@nastia)

// { isHidden: boolean, color?: COLOR_KEYS } — налаштування ПОТОЧНОГО учасника
export const visibilitySchema = Joi.object().unknown(true); // TODO(@nastia)

// { email, role: 'editor'|'viewer' }
export const shareCalendarSchema = Joi.object().unknown(true); // TODO(@nastia)

// { role: 'editor'|'viewer' }
export const updateMemberSchema = Joi.object().unknown(true); // TODO(@nastia)

// params: { id: ObjectId }
export const calendarIdParams = Joi.object().unknown(true); // TODO(@nastia)
