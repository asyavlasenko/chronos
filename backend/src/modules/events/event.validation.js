import Joi from 'joi';
import { EVENT_TYPES, PRIORITIES } from '../../constants/index.js';
import { colorKey, email, isoDate, objectId } from '../../utils/validation.js';
import { TYPE_RULE_MESSAGES } from './event.model.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 400;
const MAX_PARTICIPANTS = 20;
const TYPES = Object.values(EVENT_TYPES);

const commaList = (allowed) =>
  Joi.custom((value, helpers) => {
    if (typeof value !== 'string') return helpers.error('string.base');

    const items = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (allowed && items.some((item) => !allowed.includes(item))) return helpers.error('any.only');

    return [...new Set(items)];
  });

const rangeLimit = (from) => new Date(from.getTime() + MAX_RANGE_DAYS * DAY_MS);

export const listEventsQuery = Joi.object({
  from: isoDate(),
  to: isoDate()
    .when('from', {
      is: isoDate().required(),
      then: Joi.date()
        .greater(Joi.ref('from'))
        .max(Joi.ref('from', { adjust: rangeLimit })),
    })
    .messages({
      'date.greater': 'Параметр «to» має бути пізніше за «from»',
      'date.max': `Діапазон не може перевищувати ${MAX_RANGE_DAYS} днів`,
    }),
  calendars: commaList(),
  types: commaList(TYPES),
  q: Joi.string().trim().max(100).empty(''),
  includeHidden: Joi.boolean().default(false),
})
  .and('from', 'to')
  .messages({ 'object.and': 'Параметри «from» і «to» потрібно передавати разом' });

const title = () => Joi.string().trim().max(120).label('Назва');
const type = () =>
  Joi.string()
    .valid(...TYPES)
    .label('Тип');
const calendar = () => objectId().label('Календар');
const participants = () => Joi.array().items(email()).max(MAX_PARTICIPANTS).label('Учасники');

const details = {
  allDay: Joi.boolean().label('Весь день'),
  color: colorKey().allow(null),
  location: Joi.string().trim().max(200).allow('').label('Місце'),
  description: Joi.string().trim().max(2000).allow('').label('Опис'),
  reminderMinutesBefore: Joi.number().integer().min(0).max(10080).allow(null).label('Нагадування'),
  priority: Joi.string()
    .valid(...Object.values(PRIORITIES))
    .label('Пріоритет'),
};

export const createEventSchema = Joi.object({
  title: title().required(),
  type: type().required(),
  calendar: calendar().required(),
  isFloating: Joi.when('type', {
    is: EVENT_TYPES.TASK,
    then: Joi.boolean(),
    otherwise: Joi.boolean().valid(false),
  })
    .label('Без дати')
    .messages({ 'any.only': TYPE_RULE_MESSAGES.floatingTaskOnly }),
  startAt: Joi.when('isFloating', {
    is: true,
    then: isoDate(),
    otherwise: isoDate().required(),
  })
    .label('Початок')
    .messages({ 'any.required': TYPE_RULE_MESSAGES.startRequired }),
  endAt: Joi.when('type', {
    is: EVENT_TYPES.ARRANGEMENT,
    then: isoDate()
      .allow(null)
      .when('startAt', {
        is: isoDate().required(),
        then: Joi.date().greater(Joi.ref('startAt')),
      })
      .messages({ 'date.greater': TYPE_RULE_MESSAGES.endAfterStart }),
    otherwise: Joi.any().strip(),
  }).label('Кінець'),
  ...details,
  participants: participants(),
});

export const updateEventSchema = Joi.object({
  title: title(),
  type: type(),
  calendar: calendar(),
  startAt: isoDate().label('Початок'),
  endAt: isoDate().allow(null).label('Кінець'),
  isFloating: Joi.boolean().label('Без дати'),
  ...details,
  isCompleted: Joi.boolean().label('Виконано'),
  participants: participants(),
}).min(1);

export const inviteToEventSchema = Joi.object({
  emails: Joi.array().items(email()).min(1).max(MAX_PARTICIPANTS).required().label('Email-адреси'),
});
