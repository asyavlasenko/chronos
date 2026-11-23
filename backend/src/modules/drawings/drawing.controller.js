import asyncHandler from '../../utils/asyncHandler.js';
import * as drawingService from './drawing.service.js';

export const list = asyncHandler(async (req, res) => {
  const drawings = await drawingService.list(req.user, req.query);
  res.json({ drawings });
});

export const create = asyncHandler(async (req, res) => {
  const drawing = await drawingService.create(req.user, req.body);
  res.status(201).json({ drawing });
});

export const remove = asyncHandler(async (req, res) => {
  await drawingService.remove(req.user, req.params.id);
  res.status(204).end();
});

export const clear = asyncHandler(async (req, res) => {
  await drawingService.clear(req.user, req.query);
  res.status(204).end();
});
