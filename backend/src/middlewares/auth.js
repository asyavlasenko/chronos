// Перевірка JWT access-токена з заголовка Authorization: Bearer <token>.
// Успіх: req.user = { id, email } і next(). Інакше — 401 через ApiError.

/**
 * TODO(@nastia):
 *   1. Дістати токен з req.headers.authorization ('Bearer …').
 *   2. jwt.verify(token, env.jwt.accessSecret) → payload { sub, email, tokenVersion }.
 *   3. (опційно) звірити tokenVersion з User, щоб працювало «Вийти на всіх пристроях».
 *   4. req.user = { id: payload.sub, email: payload.email }; next().
 *   5. Помилки → next(new ApiError(401, 'Потрібна авторизація')).
 *
 * ЗАГЛУШКА: пропускає всі запити без перевірки. Прибрати до першого деплою.
 */
export default function auth(req, res, next) {
  req.user = null;
  next();
}
