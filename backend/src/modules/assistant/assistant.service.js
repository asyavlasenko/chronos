import { EVENT_TYPES } from '../../constants/index.js';
import ApiError from '../../utils/ApiError.js';
import { isCalendarDate, isClockTime, zonedTimeToUtc } from '../../utils/dates.js';
import llm from './assistant.llm.js';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MAX_TITLE_LENGTH = 120;
const MIDNIGHT = '00:00';
const NOT_CONFIGURED = 'Помічник не налаштований: на сервері немає ключа Claude API';
const NOT_UNDERSTOOD =
  'Не вдалося розпізнати подію. Спробуй написати інакше, наприклад: «завтра о 15 зустріч з ментором»';

export const getStatus = () => ({ enabled: llm.isEnabled() });

const floatingTask = (title) => ({
  title,
  type: EVENT_TYPES.TASK,
  startAt: null,
  endAt: null,
  allDay: true,
  isFloating: true,
});

function allDayEntry(title, type, date, timeZone) {
  return {
    title,
    type: type === EVENT_TYPES.ARRANGEMENT ? EVENT_TYPES.REMINDER : type,
    startAt: zonedTimeToUtc(date, MIDNIGHT, timeZone),
    endAt: null,
    allDay: true,
    isFloating: false,
  };
}

function arrangementEnd(startAt, date, endTime, user) {
  if (!isClockTime(endTime)) {
    return new Date(startAt.getTime() + user.defaultArrangementDuration * MINUTE_MS);
  }

  const endAt = zonedTimeToUtc(date, endTime, user.timezone);
  return endAt > startAt ? endAt : new Date(endAt.getTime() + DAY_MS);
}

function toDraft(raw, user) {
  const title = raw.title.trim().slice(0, MAX_TITLE_LENGTH);
  const { type, date, startTime, endTime } = raw;

  if (!isCalendarDate(date)) return floatingTask(title);
  if (!isClockTime(startTime)) return allDayEntry(title, type, date, user.timezone);

  const startAt = zonedTimeToUtc(date, startTime, user.timezone);
  const isArrangement = type === EVENT_TYPES.ARRANGEMENT;

  return {
    title,
    type,
    startAt,
    endAt: isArrangement ? arrangementEnd(startAt, date, endTime, user) : null,
    allDay: false,
    isFloating: false,
  };
}

export async function draftFromText(user, text, now = new Date()) {
  if (!llm.isEnabled()) throw new ApiError(503, NOT_CONFIGURED);

  const raw = await llm.request({ text, now, timeZone: user.timezone });
  if (!raw?.understood || !raw.title?.trim()) throw new ApiError(422, NOT_UNDERSTOOD);

  return toDraft(raw, user);
}
