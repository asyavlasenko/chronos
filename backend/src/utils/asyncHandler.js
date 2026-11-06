/**
 * Обгортка для async-контролерів: прокидає відхилений проміс у next(err),
 * щоб не писати try/catch у кожному обробнику.
 *
 *   router.get('/', asyncHandler(async (req, res) => { … }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
