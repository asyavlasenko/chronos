// Спільне для форм події (10-event-create, 11-event-quick-modal, 12-event-details):
// довідники типів/нагадувань/пріоритетів, склейка дати й часу з полів форми,
// учасники за email, розпізнавання посилання в полі «Місце».
import { people } from '../mocks/data';
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

export const REMINDER_OPTIONS = [
  { value: 'none', label: 'Не нагадувати' },
  { value: '10', label: 'За 10 хвилин' },
  { value: '30', label: 'За 30 хвилин' },
  { value: '60', label: 'За 1 годину' },
  { value: '1440', label: 'За день' },
];
export const reminderToValue = (minutes) =>
  minutes === null || minutes === undefined ? 'none' : String(minutes);
export const valueToReminder = (value) => (value === 'none' ? null : Number(value));

/** 'Нагадати за 10 хв' · 'Нагадати за 1 год' · 'Нагадати за день' · 'Не нагадувати' */
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

/** Календарі, у які можна додавати події: owner або editor, не «Свята». */
export const isWritableCalendar = (c) =>
  !c.isReadOnly && (c.myRole === 'owner' || c.myRole === 'editor');

/** Опції Select календаря: «Робота · спільний». */
export const calendarOptions = (calendars) =>
  calendars.map((c) => ({ value: c.id, label: c.isShared ? `${c.name} · спільний` : c.name }));

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^\d{2}:\d{2}$/;

const pad = (n) => String(n).padStart(2, '0');

/** Date → 'HH:MM' для input[type=time] і query-параметрів. */
export function toTimeParam(value) {
  const d = toDate(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 'YYYY-MM-DD' (+ 'HH:MM') → Date у локальному часі; без часу — 00:00. null, якщо дата невалідна. */
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

/** Найближчий наступний крок (за замовчуванням 30 хв): 16:07 → 16:30. */
export function roundUpToStep(value, step = 30) {
  const d = toDate(value);
  const minutes = Math.ceil((d.getHours() * 60 + d.getMinutes()) / step) * step;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minutes);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isValidEmail = (value) => EMAIL_RE.test((value || '').trim());

/** Учасник за email: якщо людина є в довіднику — з user і name, інакше name = частина до @. */
export function participantFromEmail(email) {
  const normalized = email.trim().toLowerCase();
  const person = Object.values(people).find((p) => p.email === normalized);
  return {
    user: person ? person.id : null,
    name: person ? person.name : normalized.split('@')[0],
    email: normalized,
    status: 'pending',
  };
}

const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i;
export const looksLikeUrl = (text) => URL_RE.test((text || '').trim());
export const withProtocol = (text) => (/^https?:\/\//i.test(text) ? text : `https://${text}`);
