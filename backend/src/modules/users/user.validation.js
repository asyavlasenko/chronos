import Joi from 'joi';
import {
  BOARD_MODULES,
  THEME_COLORS,
  THEME_MODES,
  TIME_FORMATS,
  WEEK_STARTS,
} from '../../constants/index.js';
import { password, timezone } from '../../utils/validation.js';

const AVATAR_URL_MESSAGE =
  'Поле «{{#label}}» має бути посиланням http або https чи зображенням PNG, JPEG або WebP до 100 КБ';
const AVATAR_DATA_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const MAX_AVATAR_DATA_LENGTH = 140000;

const notificationsSchema = Joi.object({
  emailReminders: Joi.boolean().label('Нагадування на email'),
  push: Joi.boolean().label('Push-сповіщення'),
  sharedCalendarEmails: Joi.boolean().label('Листи про спільні календарі'),
}).label('Сповіщення');

export const updateMeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).label('Ім’я'),
  avatarUrl: Joi.alternatives()
    .try(
      Joi.string()
        .trim()
        .uri({ scheme: ['http', 'https'] })
        .max(2048),
      Joi.string().pattern(AVATAR_DATA_PATTERN).max(MAX_AVATAR_DATA_LENGTH),
    )
    .allow(null)
    .messages({ 'alternatives.match': AVATAR_URL_MESSAGE })
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
  hiddenModules: Joi.array()
    .items(Joi.string().valid(...BOARD_MODULES))
    .unique()
    .max(BOARD_MODULES.length)
    .label('Приховані блоки'),
  theme: Joi.object({
    color: Joi.string()
      .valid(...THEME_COLORS)
      .required()
      .label('Колір теми'),
    mode: Joi.string()
      .valid(...THEME_MODES)
      .required()
      .label('Режим теми'),
  }).label('Тема'),
}).min(1);

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().max(128).required().label('Поточний пароль'),
  newPassword: password().required().label('Новий пароль'),
});
