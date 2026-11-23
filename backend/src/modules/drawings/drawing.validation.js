import Joi from 'joi';
import { colorKey, isoDate } from '../../utils/validation.js';
import { MAX_POINTS, MAX_WIDTH, MIN_POINTS } from './drawing.model.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 62;
const MIN_TIME = Date.UTC(2000, 0, 1);
const MAX_TIME = Date.UTC(2100, 0, 1);
const MAX_Y = 4000;

const point = Joi.array()
  .ordered(
    Joi.number().min(MIN_TIME).max(MAX_TIME).required(),
    Joi.number().min(0).max(MAX_Y).required(),
  )
  .label('Точка');

const rangeLimit = (from) => new Date(from.getTime() + MAX_RANGE_DAYS * DAY_MS);

export const createDrawingSchema = Joi.object({
  color: colorKey().required(),
  width: Joi.number().integer().min(1).max(MAX_WIDTH).required().label('Товщина'),
  points: Joi.array().items(point).min(MIN_POINTS).max(MAX_POINTS).required().label('Точки'),
});

export const rangeQuery = Joi.object({
  from: isoDate().required().label('Початок діапазону'),
  to: isoDate()
    .required()
    .greater(Joi.ref('from'))
    .max(Joi.ref('from', { adjust: rangeLimit }))
    .label('Кінець діапазону')
    .messages({
      'date.greater': 'Кінець діапазону має бути пізніше за початок',
      'date.max': `Діапазон не може перевищувати ${MAX_RANGE_DAYS} дні`,
    }),
});
