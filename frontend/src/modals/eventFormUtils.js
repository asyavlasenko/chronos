import { formatDuration, parseDateParam, toDate } from '../utils/dates';

export const TYPE_OPTIONS = [
  { value: 'arrangement', label: 'Зустріч', hint: 'має початок і кінець' },
  { value: 'reminder', label: 'Нагадування', hint: 'один момент часу' },
  { value: 'task', label: 'Задача', hint: 'дедлайн і чекбокс' },
];
export const TYPE_VALUES = TYPE_OPTIONS.map((t) => t.value);
export const TYPE_LABELS = {
  arrangement: 'зустріч',
  reminder: 'нагадування',
  task: 'задача',
  holiday: 'свято',
};

export const DEFAULT_REMINDER = '10';
export const REMINDER_OPTIONS = [
  { value: '10', label: 'За 10 хвилин' },
  { value: '30', label: 'За 30 хвилин' },
  { value: '60', label: 'За 1 годину' },
  { value: '1440', label: 'За день' },
];
export const reminderToValue = (minutes) =>
  minutes === null || minutes === undefined ? DEFAULT_REMINDER : String(minutes);
export const valueToReminder = (value) => Number(value);

export function reminderOptions(current) {
  if (REMINDER_OPTIONS.some((option) => option.value === current)) return REMINDER_OPTIONS;
  const minutes = Number(current);
  const label = minutes === 0 ? 'У момент події' : `За ${formatDuration(minutes)}`;
  return [...REMINDER_OPTIONS, { value: current, label }];
}

export function reminderLabel(minutes) {
  if (minutes === null || minutes === undefined) return 'Не нагадувати';
  if (minutes === 0) return 'Нагадати в момент події';
  if (minutes === 1440) return 'Нагадати за день';
  return `Нагадати за ${formatDuration(minutes)}`;
}

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Низький' },
  { value: 'medium', label: 'Середній' },
  { value: 'high', label: 'Високий' },
];

export const isWritableCalendar = (c) =>
  !c.isReadOnly && (c.myRole === 'owner' || c.myRole === 'editor');

export function pickWritableCalendarId(calendars, preferredId = '') {
  const writable = calendars.filter(isWritableCalendar);
  if (preferredId && writable.some((c) => c.id === preferredId)) return preferredId;
  return (writable.find((c) => c.isMain) || writable[0])?.id || '';
}

export function canModifyEvent(event, calendar, userId) {
  if (!event || !calendar || event.isInvited || event.type === 'holiday') return false;
  if (calendar.isReadOnly) return false;
  if (calendar.myRole === 'owner') return true;
  return calendar.myRole === 'editor' && Boolean(userId) && event.creator === userId;
}

export const calendarOptions = (calendars) =>
  calendars.map((c) => ({ value: c.id, label: c.isShared ? `${c.name} · спільний` : c.name }));

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^\d{2}:\d{2}$/;

const pad = (n) => String(n).padStart(2, '0');

export function toTimeParam(value) {
  const d = toDate(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function combineDateTime(dateStr, timeStr = '') {
  if (!DATE_RE.test(dateStr || '')) return null;
  const d = parseDateParam(dateStr);
  if (TIME_RE.test(timeStr || '')) {
    const [h, m] = timeStr.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

export function endOfDay(value) {
  const d = toDate(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59);
}

export function roundUpToStep(value, step = 30) {
  const d = toDate(value);
  const minutes = Math.ceil((d.getHours() * 60 + d.getMinutes()) / step) * step;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minutes);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isValidEmail = (value) => EMAIL_RE.test((value || '').trim());
export const normalizeEmail = (value) => (value || '').trim().toLowerCase();

export function participantFromEmail(email, people = {}) {
  const normalized = normalizeEmail(email);
  const person = Object.values(people).find((p) => p.email === normalized);
  return {
    user: person ? person.id : null,
    name: person ? person.fullName || person.name : normalized.split('@')[0],
    email: normalized,
    status: 'pending',
  };
}

export function splitApiErrors({ message, fields }, fieldMap) {
  const known = {};
  const other = [];
  Object.entries(fields).forEach(([path, text]) => {
    const key = fieldMap[path.split('.')[0]];
    if (!key) other.push(text);
    else if (!known[key]) known[key] = text;
  });
  if (other.length > 0) return { fields: known, form: other.join(' · ') };
  return { fields: known, form: Object.keys(known).length > 0 ? null : message };
}

const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i;
export const looksLikeUrl = (text) => URL_RE.test((text || '').trim());
export const withProtocol = (text) => (/^https?:\/\//i.test(text) ? text : `https://${text}`);
