// Запити модуля auth. Усі функції — заглушки з TODO; реалізація через client з './client'.

/** POST /auth/register { email, password, name, country?, timezone? } → { user, accessToken } */
export async function register() {
  throw new Error('TODO(@teammate2): auth.api.register');
}

/** POST /auth/login { email, password, remember? } → { user, accessToken } */
export async function login() {
  throw new Error('TODO(@teammate2): auth.api.login');
}

/** POST /auth/logout → 204 */
export async function logout() {
  throw new Error('TODO(@teammate2): auth.api.logout');
}

/** POST /auth/refresh (cookie) → { accessToken } */
export async function refresh() {
  throw new Error('TODO(@teammate2): auth.api.refresh');
}

/** POST /auth/password-reset { email } → 202 */
export async function requestPasswordReset() {
  throw new Error('TODO(@teammate2): auth.api.requestPasswordReset');
}

/** POST /auth/password-reset/confirm { token, password } → 204 */
export async function confirmPasswordReset() {
  throw new Error('TODO(@teammate2): auth.api.confirmPasswordReset');
}
