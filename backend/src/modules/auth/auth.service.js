// Сервіс auth: уся логіка тут, контролери лише викликають і віддають відповідь.

/**
 * Реєстрація: хеш пароля (bcryptjs), створення User і ГОЛОВНОГО календаря (isMain: true,
 * members: [{ user, role: 'owner' }]), лист підтвердження email (опційно).
 * @param {{ email: string, password: string, name: string, country?: string, timezone?: string }} dto
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
 */
export async function register() {
  throw new Error('TODO(@nastia): auth.service.register');
}

/**
 * Вхід: пошук за email (+passwordHash через select), bcrypt.compare, пара токенів.
 */
export async function login() {
  throw new Error('TODO(@nastia): auth.service.login');
}

/**
 * Ротація refresh-токена: перевірити підпис і tokenVersion, видати нову пару.
 */
export async function refresh() {
  throw new Error('TODO(@nastia): auth.service.refresh');
}

/**
 * Запит скидання пароля: згенерувати токен, зберегти хеш і expiresAt у User, надіслати лист.
 */
export async function requestPasswordReset() {
  throw new Error('TODO(@nastia): auth.service.requestPasswordReset');
}

/**
 * Підтвердження скидання: знайти за хешем токена, перевірити строк, оновити passwordHash, tokenVersion++.
 */
export async function confirmPasswordReset() {
  throw new Error('TODO(@nastia): auth.service.confirmPasswordReset');
}

/**
 * Пара JWT: access (env.jwt.accessTtl) і refresh (env.jwt.refreshTtl), payload { sub, email, tokenVersion }.
 */
export function issueTokens() {
  throw new Error('TODO(@nastia): auth.service.issueTokens');
}
