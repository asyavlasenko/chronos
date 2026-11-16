import Joi from 'joi';
import { TIME_FORMATS, WEEK_STARTS } from '../../constants/index.js';
import { password, timezone } from '../../utils/validation.js';

const AVATAR_URL_MESSAGE = 'Поле «{{#label}}» має бути посиланням http або https';

const notificationsSchema = Joi.object({
  emailReminders: Joi.boolean().label('Нагадування на email'),
  push: Joi.boolean().label('Push-сповіщення'),
  sharedCalendarEmails: Joi.boolean().label('Листи про спільні календарі'),
}).label('Сповіщення');

export const updateMeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).label('Ім’я'),
  avatarUrl: Joi.string()
    .trim()
    .uri({ scheme: ['http', 'https'] })
    .max(2048)
    .allow(null)
    .messages({ 'string.uri': AVATAR_URL_MESSAGE, 'string.uriCustomScheme': AVATAR_URL_MESSAGE })
    .label('Аватар'),
  country: Joi.string().trim().uppercase().length(2).label('Країна'),
  timezone: timezone(),
  defaultArrangementDuration: Joi.number().integer().min(5).max(480).label('Тривалість зустрічі'),
  weekStartsOn: Joi.number()
    .valid(...Object.values(WEEK_STARTS))
    .label('Початок тижня'),
  timeFormat: Joi.string()
    .valid(...TIME_FORMATS)
    .label('Формат часу'),
  showWeekNumbers: Joi.boolean().label('Номери тижнів'),
  showHolidays: Joi.boolean().label('Показ свят'),
  notifications: notificationsSchema,
}).min(1);

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().max(128).required().label('Поточний пароль'),
  newPassword: password().required().label('Новий пароль'),
});
