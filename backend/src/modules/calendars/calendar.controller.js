import asyncHandler from '../../utils/asyncHandler.js';
import * as calendarService from './calendar.service.js';

export const list = asyncHandler(async (req, res) => {
  const calendars = await calendarService.listForUser(req.user.id);
  res.json({ calendars });
});

export const create = asyncHandler(async (req, res) => {
  const calendar = await calendarService.create(req.user.id, req.body);
  res.status(201).json({ calendar });
});

export const getOne = asyncHandler(async (req, res) => {
  const calendar = await calendarService.getById(req.calendar, req.user.id);
  res.json({ calendar });
});

export const update = asyncHandler(async (req, res) => {
  const calendar = await calendarService.update(req.calendar, req.user.id, req.body);
  res.json({ calendar });
});

export const remove = asyncHandler(async (req, res) => {
  await calendarService.remove(req.calendar);
  res.status(204).end();
});

export const updateVisibility = asyncHandler(async (req, res) => {
  const calendar = await calendarService.updateMembership(req.calendar, req.user.id, req.body);
  res.json({ calendar });
});

export const share = asyncHandler(async (req, res) => {
  const invite = await calendarService.share(req.calendar, req.user, req.body);
  res.status(201).json({ invite });
});

export const updateMember = asyncHandler(async (req, res) => {
  const calendar = await calendarService.updateMemberRole(
    req.calendar,
    req.user.id,
    req.params.userId,
    req.body.role,
  );
  res.json({ calendar });
});

export const removeMember = asyncHandler(async (req, res) => {
  await calendarService.removeMember(req.calendar, req.user.id, req.params.userId);
  res.status(204).end();
});

export const cancelInvite = asyncHandler(async (req, res) => {
  await calendarService.cancelInvite(req.calendar, req.params.inviteId);
  res.status(204).end();
});
