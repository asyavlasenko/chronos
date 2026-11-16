import asyncHandler from '../../utils/asyncHandler.js';
import * as eventService from './event.service.js';

export const list = asyncHandler(async (req, res) => {
  const events = await eventService.list(req.user, req.query);
  res.json({ events });
});

export const create = asyncHandler(async (req, res) => {
  const event = await eventService.create(req.user, req.body);
  res.status(201).json({ event });
});

export const getOne = asyncHandler(async (req, res) => {
  const event = await eventService.getById(req.user, req.params.id);
  res.json({ event });
});

export const update = asyncHandler(async (req, res) => {
  const event = await eventService.update(req.user, req.params.id, req.body);
  res.json({ event });
});

export const remove = asyncHandler(async (req, res) => {
  await eventService.remove(req.user, req.params.id);
  res.status(204).end();
});

export const invite = asyncHandler(async (req, res) => {
  const event = await eventService.invite(req.user, req.params.id, req.body.emails);
  res.json({ event });
});
