import ApiError from '../utils/ApiError.js';

const SEGMENTS = ['params', 'query', 'body'];

/**
 * Валідація запиту Joi-схемами.
 *
 *   router.post('/', validate({ body: createEventSchema }), controller.create);
 *
 * Невідомі поля відкидаються (stripUnknown), усі помилки збираються разом (abortEarly: false)
 * і повертаються як 400 { message: 'Помилка валідації', details: [{ field, message }] }.
 */
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
