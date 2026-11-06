// Дизайн: design/screens/01-overview.html, 16-mobile.html
// Допоміжні обчислення для «Огляду»: вільні вікна між подіями, підписи місця, учасників і ролей.
import PropTypes from 'prop-types';
import { startOfDay, toDate } from '../../utils/dates';
import { addMinutes } from '../../utils/eventStats';

const STEP_MIN = 30;
/** Скільки хвилин «займає» подія без кінця: задача — блок у 1 год, нагадування — пілюля ~30 хв. */
const TASK_MIN = 60;
const REMINDER_MIN = 30;

export const peopleShape = PropTypes.objectOf(
  PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    initials: PropTypes.string,
    color: PropTypes.string,
  }),
);

const ceilToStep = (date) =>
  new Date(Math.ceil(toDate(date).getTime() / (STEP_MIN * 60000)) * STEP_MIN * 60000);

/** Зайняті інтервали дня: зустрічі — [start, end], задачі й нагадування — мінімальний блок. */
export function busyIntervals(events) {
  return events
    .filter((e) => e.startAt && !e.allDay)
    .map((e) => {
      const start = toDate(e.startAt);
      let end = e.endAt ? toDate(e.endAt) : start;
      if (e.type === 'task') end = addMinutes(start, TASK_MIN);
      else if (e.type === 'reminder') end = addMinutes(start, REMINDER_MIN);
      return { start, end: end > start ? end : start };
    })
    .sort((a, b) => a.start - b.start);
}

/**
 * Вільні вікна ≥ minMinutes між зайнятими інтервалами: від «зараз» (округлено до 30 хв),
 * або від startHour, якщо день у майбутньому, до endHour. Минулий день — порожньо.
 * Вікно, що починається «зараз», має fromNow: true («Вільно до 11:00»).
 */
export function findFreeSlots(
  day,
  intervals,
  { startHour = 8, endHour = 20, now = new Date(), minMinutes = 60 } = {},
) {
  const d = startOfDay(day);
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startHour);
  const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), endHour);
  const fromNow = now > dayStart;
  let cursor = fromNow ? ceilToStep(now) : dayStart;
  if (cursor >= dayEnd) return [];
  const origin = cursor;
  const slots = [];
  const push = (start, end) => {
    if (end - start < minMinutes * 60000) return;
    slots.push({
      start: new Date(start),
      end: new Date(end),
      fromNow: fromNow && start.getTime() === origin.getTime(),
    });
  };
  intervals.forEach(({ start, end }) => {
    if (start > cursor) push(cursor, start < dayEnd ? start : dayEnd);
    if (end > cursor) cursor = end;
  });
  if (cursor < dayEnd) push(cursor, dayEnd);
  return slots;
}

/** Імена учасників без себе: «Максим, Оля». */
export function participantNames(participants = [], meId = null) {
  return (participants || [])
    .filter((p) => !meId || p.user !== meId)
    .map((p) => p.name || p.email)
    .filter(Boolean)
    .join(', ');
}

/** «Google Meet» для посилань meet.google.com, інакше — текст місця як є. */
export function locationLabel(location = '') {
  if (!location) return '';
  if (/meet\.google\.com/i.test(location)) return 'Google Meet';
  return location;
}

const LINK_RE = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i;

/** href для «Приєднатись», якщо місце події — посилання; інакше null. */
export function locationHref(location = '') {
  const value = (location || '').trim();
  if (!LINK_RE.test(value)) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

const ROLE_LABELS = {
  owner: ['власник', 'власники'],
  editor: ['редактор', 'редактори'],
  viewer: ['глядач', 'глядачі'],
};

/** «Ти — власник · Максим, Оля — редактори» */
export function membersSummary(members = []) {
  return Object.keys(ROLE_LABELS)
    .map((role) => {
      const names = members
        .filter((m) => m.role === role)
        .map((m) => m.name || m.email)
        .filter(Boolean);
      if (!names.length) return null;
      return `${names.join(', ')} — ${ROLE_LABELS[role][names.length > 1 ? 1 : 0]}`;
    })
    .filter(Boolean)
    .join(' · ');
}
