import ApiError from '../utils/ApiError.js';
import { messages } from '../utils/validation.js';

const SEGMENTS = ['params', 'query', 'body'];

export default function validate(schemas) {
  return (req, res, next) => {
    const details = [];

    SEGMENTS.forEach((segment) => {
      const schema = schemas[segment];
      if (!schema) return;

      const { error, value } = schema.validate(req[segment], {
        abortEarly: false,
        stripUnknown: true,
        errors: { wrap: { label: '' } },
        messages,
      });

      if (error) {
        error.details.forEach((d) => details.push({ field: d.path.join('.'), message: d.message }));
      } else {
        req[segment] = value;
      }
    });

    if (details.length > 0) {
      next(new ApiError(400, 'Помилка валідації', details));
      return;
    }
    next();
  };
}
