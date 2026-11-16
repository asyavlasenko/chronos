import Joi from 'joi';
import { COLOR_KEYS } from '../constants/index.js';

export const messages = {
  'any.required': 'Поле «{{#label}}» обов’язкове',
  'any.only': 'Недопустиме значення поля «{{#label}}»',
  'any.invalid': 'Некоректне значення поля «{{#label}}»',
  'string.base': 'Поле «{{#label}}» має бути рядком',
  'string.empty': 'Поле «{{#label}}» не може бути порожнім',
  'string.email': 'Некоректний email',
  'string.min': 'Поле «{{#label}}» має містити щонайменше {{#limit}} символів',
  'string.max': 'Поле «{{#label}}» має містити не більше {{#limit}} символів',
  'string.length': 'Поле «{{#label}}» має містити рівно {{#limit}} символів',
  'string.hex': 'Некоректний ідентифікатор',
  'string.uri': 'Поле «{{#label}}» має бути посиланням',
  'string.uriCustomScheme': 'Поле «{{#label}}» має бути посиланням http або https',
  'number.base': 'Поле «{{#label}}» має бути числом',
  'number.integer': 'Поле «{{#label}}» має бути цілим числом',
  'number.min': 'Поле «{{#label}}» має бути не менше {{#limit}}',
  'number.max': 'Поле «{{#label}}» має бути не більше {{#limit}}',
  'boolean.base': 'Поле «{{#label}}» має бути true або false',
  'date.base': 'Поле «{{#label}}» має бути датою',
  'date.format': 'Поле «{{#label}}» має бути датою у форматі ISO 8601',
  'array.base': 'Поле «{{#label}}» має бути списком',
  'array.min': 'Поле «{{#label}}» має містити щонайменше {{#limit}} елементів',
  'array.max': 'Поле «{{#label}}» має містити не більше {{#limit}} елементів',
  'object.base': 'Некоректний формат даних',
  'object.min': 'Передай хоча б одне поле для зміни',
};

export const objectId = () => Joi.string().hex().length(24).label('Ідентифікатор');

export const email = () =>
  Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(254)
    .label('Email');

export const password = () => Joi.string().min(8).max(128).label('Пароль');

export const colorKey = () =>
  Joi.string()
    .valid(...COLOR_KEYS)
    .label('Колір');

export const isoDate = () => Joi.date().iso();

export const timezone = () =>
  Joi.string()
    .max(64)
    .custom((value, helpers) => {
      try {
        Intl.DateTimeFormat('en', { timeZone: value });
        return value;
      } catch {
        return helpers.error('any.invalid');
      }
    })
    .label('Часовий пояс');

export const idParams = Joi.object({ id: objectId().required() });
