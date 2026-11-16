import mongoose from 'mongoose';
import Calendar from '../modules/calendars/calendar.model.js';
import ApiError from '../utils/ApiError.js';
import { ROLE_RANK } from '../constants/index.js';

export function findMember(calendar, userId) {
  return calendar.members.find((m) => String(m.user?._id ?? m.user) === String(userId)) || null;
}

export function hasRole(membership, minRole) {
  return Boolean(membership) && ROLE_RANK[membership.role] >= ROLE_RANK[minRole];
}

export async function assertCalendarRole(userId, calendarId, minRole) {
  if (!mongoose.isValidObjectId(calendarId)) throw new ApiError(404, 'Календар не знайдено');

  const calendar = await Calendar.findById(calendarId);
  if (!calendar) throw new ApiError(404, 'Календар не знайдено');

  const membership = findMember(calendar, userId);
  if (!membership) throw new ApiError(403, 'У тебе немає доступу до цього календаря');
  if (!hasRole(membership, minRole)) throw new ApiError(403, 'Недостатньо прав для цієї дії');

  return { calendar, membership };
}

export default function calendarAccess(minRole) {
  return async (req, res, next) => {
    try {
      const { calendar, membership } = await assertCalendarRole(
        req.user.id,
        req.params.id,
        minRole,
      );
      req.calendar = calendar;
      req.membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}
