import asyncHandler from '../../utils/asyncHandler.js';
import { clearRefreshCookie, setRefreshCookie } from '../auth/auth.cookies.js';
import * as userService from './user.service.js';

export const getMe = (req, res) => {
  res.json({ user: req.user });
};

export const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user, req.body);
  res.json({ user });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken } = await userService.changePassword(req.user, req.body);
  setRefreshCookie(res, refreshToken, true);
  res.json({ accessToken });
});

export const logoutEverywhere = asyncHandler(async (req, res) => {
  await userService.logoutEverywhere(req.user);
  clearRefreshCookie(res);
  res.status(204).end();
});
