import asyncHandler from '../../utils/asyncHandler.js';
import * as telegramService from './telegram.service.js';

export const status = asyncHandler(async (req, res) => {
  res.json(await telegramService.getStatus(req.user));
});

export const createLink = asyncHandler(async (req, res) => {
  res.status(201).json(await telegramService.createLink(req.user));
});

export const disconnect = asyncHandler(async (req, res) => {
  await telegramService.disconnect(req.user);
  res.status(204).end();
});

export const sendTest = asyncHandler(async (req, res) => {
  await telegramService.sendTest(req.user);
  res.status(204).end();
});
