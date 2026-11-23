import asyncHandler from '../../utils/asyncHandler.js';
import { REFRESH_COOKIE, clearRefreshCookie, setRefreshCookie } from './auth.cookies.js';
import * as authService from './auth.service.js';

const withPreview = (body, previewUrl) => (previewUrl ? { ...body, previewUrl } : body);

export const register = asyncHandler(async (req, res) => {
  const { user, previewUrl } = await authService.register(req.body);
  res
    .status(201)
    .json(
      withPreview(
        { message: 'Ми надіслали лист із посиланням для підтвердження', email: user.email },
        previewUrl,
      ),
    );
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.verifyEmail(req.body.token);
  setRefreshCookie(res, refreshToken, true);
  res.json({ user, accessToken });
});

export const resendVerification = asyncHandler(async (req, res) => {
  const previewUrl = await authService.resendVerification(req.body.email);
  res
    .status(202)
    .json(
      withPreview({ message: 'Якщо цей email чекає підтвердження, лист уже в дорозі' }, previewUrl),
    );
});

export const login = asyncHandler(async (req, res) => {
  const { remember, ...credentials } = req.body;
  const { user, accessToken, refreshToken } = await authService.login(credentials, { remember });
  setRefreshCookie(res, refreshToken, remember);
  res.json({ user, accessToken });
});

export const refresh = asyncHandler(async (req, res) => {
  try {
    const result = await authService.refresh(req.cookies[REFRESH_COOKIE]);
    setRefreshCookie(res, result.refreshToken, result.remember);
    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
});

export const logout = (req, res) => {
  clearRefreshCookie(res);
  res.status(204).end();
};

export const requestPasswordReset = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.body.email);
  res.status(202).json({ message: 'Якщо такий email існує, лист уже в дорозі' });
});

export const confirmPasswordReset = asyncHandler(async (req, res) => {
  await authService.confirmPasswordReset(req.body);
  clearRefreshCookie(res);
  res.status(204).end();
});
