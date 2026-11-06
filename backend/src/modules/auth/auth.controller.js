// TODO(@nastia): контролери auth. Кожен — заглушка 501; замінюй по одному, логіка — в auth.service.js.
// Refresh-токен кладеться в httpOnly cookie (SameSite=Lax, secure у production), access — у тілі відповіді.

export const register = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@nastia): POST /api/auth/register' });

export const login = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@nastia): POST /api/auth/login' });

export const logout = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@nastia): POST /api/auth/logout' });

export const refresh = (req, res) =>
  res.status(501).json({ status: 'error', message: 'TODO(@nastia): POST /api/auth/refresh' });

export const requestPasswordReset = (req, res) =>
  res
    .status(501)
    .json({ status: 'error', message: 'TODO(@nastia): POST /api/auth/password-reset' });

export const confirmPasswordReset = (req, res) =>
  res
    .status(501)
    .json({ status: 'error', message: 'TODO(@nastia): POST /api/auth/password-reset/confirm' });
