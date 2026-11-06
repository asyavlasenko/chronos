// Робота з датами на фронті. Бекенд віддає ISO 8601 в UTC; тут усе рахується в локальному часі браузера.
// Без сторонніх бібліотек. Рядки — українською, у форматах з мокапів (design/screens).

export const LOCALE = 'uk-UA';

export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']; // індекс 0 = понеділок
export const WEEKDAYS_LONG = [
  'Понеділок',
  'Вівторок',
  'Середа',
  'Четвер',
  "П'ятниця",
  'Субота',
  'Неділя',
];
export const MONTHS_NOMINATIVE = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
];
export const MONTHS_GENITIVE = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня',
];
export const MONTHS_SHORT = [
  'січ.',
  'лют.',
  'бер.',
  'квіт.',
  'трав.',
  'черв.',
  'лип.',
  'серп.',
  'вер.',
  'жовт.',
  'лист.',
  'груд.',
];
export const MONTHS_ABBR_UPPER = [
  'СІЧ',
  'ЛЮТ',
  'БЕР',
  'КВІ',
  'ТРА',
  'ЧЕР',
  'ЛИП',
  'СЕР',
  'ВЕР',
  'ЖОВ',
  'ЛИС',
  'ГРУ',
];

const MS_DAY = 24 * 60 * 60 * 1000;

export const toDate = (value) => (value instanceof Date ? value : new Date(value));

export function startOfDay(value) {
  const d = toDate(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(value, n) {
  const d = toDate(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

export function addMonths(value, n) {
  const d = toDate(value);
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function addYears(value, n) {
  const d = toDate(value);
  return new Date(d.getFullYear() + n, d.getMonth(), 1);
}

export function isSameDay(a, b) {
  const x = toDate(a);
  const y = toDate(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

export const isToday = (value) => isSameDay(value, new Date());

/** Індекс дня тижня, де 0 = понеділок … 6 = неділя. */
export const weekdayIndex = (value) => (toDate(value).getDay() + 6) % 7;

/** Початок тижня (00:00) з урахуванням налаштування weekStartsOn: 1 = Пн, 0 = Нд. */
export function startOfWeek(value, weekStartsOn = 1) {
  const d = startOfDay(value);
  const shift = weekStartsOn === 1 ? weekdayIndex(d) : d.getDay();
  return addDays(d, -shift);
}

/** Номер ISO-тижня (ISO 8601: тиждень з понеділка, тиждень 1 містить 4 січня). */
export function getIsoWeek(value) {
  const d = startOfDay(value);
  const thursday = addDays(d, 3 - weekdayIndex(d));
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const firstWeekStart = addDays(firstThursday, -weekdayIndex(firstThursday));
  return Math.round((startOfDay(thursday) - firstWeekStart) / (7 * MS_DAY)) + 1;
}

export function startOfMonth(value) {
  const d = toDate(value);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(value) {
  const d = toDate(value);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function daysInMonth(value) {
  return endOfMonth(value).getDate();
}

/** Межі подання у локальному часі: [from, to). */
export function getViewRange(view, anchor, weekStartsOn = 1) {
  const d = startOfDay(anchor);
  switch (view) {
    case 'day':
      return { from: d, to: addDays(d, 1) };
    case 'week': {
      const from = startOfWeek(d, weekStartsOn);
      return { from, to: addDays(from, 7) };
    }
    case 'month':
      return { from: startOfMonth(d), to: addMonths(d, 1) };
    case 'year':
      return { from: new Date(d.getFullYear(), 0, 1), to: new Date(d.getFullYear() + 1, 0, 1) };
    default:
      return { from: d, to: addDays(d, 1) };
  }
}

/** Сітка 6×7 для місяця (42 дні) починаючи з першого дня тижня. */
export function getMonthGridDays(monthDate, weekStartsOn = 1) {
  const first = startOfWeek(startOfMonth(monthDate), weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

/** 7 днів тижня, у якому лежить дата. */
export function getWeekDays(value, weekStartsOn = 1) {
  const first = startOfWeek(value, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / MS_DAY);
}

export function durationMinutes(start, end) {
  if (!start || !end) return 0;
  return Math.round((toDate(end) - toDate(start)) / 60000);
}

export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return toDate(aStart) < toDate(bEnd) && toDate(bStart) < toDate(aEnd);
}

const pad = (n) => String(n).padStart(2, '0');

/** '11:00' або '11:00 AM' */
export function formatTime(value, timeFormat = '24h') {
  const d = toDate(value);
  if (timeFormat === '12h') {
    const h = d.getHours() % 12 || 12;
    return `${h}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
  }
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** '11:00 – 12:00' */
export function formatTimeRange(start, end, timeFormat = '24h') {
  if (!end) return formatTime(start, timeFormat);
  return `${formatTime(start, timeFormat)} – ${formatTime(end, timeFormat)}`;
}

/** '1 год', '1,5 год', '45 хв', '2 год 10 хв' */
export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} хв`;
  const h = minutes / 60;
  if (Number.isInteger(h)) return `${h} год`;
  if (minutes % 30 === 0) return `${String(h).replace('.', ',')} год`;
  return `${Math.floor(h)} год ${minutes % 60} хв`;
}

/** '3,5 год' для підсумків зайнятості (години з комою) */
export function formatHours(minutes) {
  const h = Math.round((minutes / 60) * 2) / 2;
  return `${String(h).replace('.', ',')} год`;
}

/**
 * Дати у форматах мокапів:
 *   'weekday-long' → 'Четвер, 5 листопада'
 *   'weekday-short' → 'Чт, 5 листопада'
 *   'short' → 'Чт, 5 лист.'
 *   'day-month' → '5 листопада'
 *   'day-month-short' → '5 лист.'
 *   'month-year' → 'Листопад 2026'
 *   'weekday-day' → 'Чт 5'
 *   'iso' → '2026-11-05'
 */
export function formatDate(value, pattern = 'weekday-long') {
  const d = toDate(value);
  const day = d.getDate();
  const wd = weekdayIndex(d);
  const m = d.getMonth();
  switch (pattern) {
    case 'weekday-long':
      return `${WEEKDAYS_LONG[wd]}, ${day} ${MONTHS_GENITIVE[m]}`;
    case 'weekday-short':
      return `${WEEKDAYS_SHORT[wd]}, ${day} ${MONTHS_GENITIVE[m]}`;
    case 'short':
      return `${WEEKDAYS_SHORT[wd]}, ${day} ${MONTHS_SHORT[m]}`;
    case 'day-month':
      return `${day} ${MONTHS_GENITIVE[m]}`;
    case 'day-month-short':
      return `${day} ${MONTHS_SHORT[m]}`;
    case 'month-year':
      return `${MONTHS_NOMINATIVE[m]} ${d.getFullYear()}`;
    case 'weekday-day':
      return `${WEEKDAYS_SHORT[wd]} ${day}`;
    case 'iso':
      return `${d.getFullYear()}-${pad(m + 1)}-${pad(day)}`;
    default:
      return d.toLocaleDateString(LOCALE);
  }
}

/** '2 – 8 листопада 2026' або '30 листопада – 6 грудня 2026' */
export function formatWeekRange(value, weekStartsOn = 1) {
  const from = startOfWeek(value, weekStartsOn);
  const to = addDays(from, 6);
  if (from.getMonth() === to.getMonth()) {
    return `${from.getDate()} – ${to.getDate()} ${MONTHS_GENITIVE[to.getMonth()]} ${to.getFullYear()}`;
  }
  return `${from.getDate()} ${MONTHS_GENITIVE[from.getMonth()]} – ${to.getDate()} ${MONTHS_GENITIVE[to.getMonth()]} ${to.getFullYear()}`;
}

export function pluralDays(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дні';
  return 'днів';
}

/** 'через 48 хв', 'через 2 год', 'через 3 дні', 'зараз', 'минула' */
export function formatRelative(value, now = new Date()) {
  const diffMin = Math.round((toDate(value) - now) / 60000);
  if (diffMin <= 0 && diffMin > -60) return 'зараз';
  if (diffMin < 0) return 'минула';
  if (diffMin < 60) return `через ${diffMin} хв`;
  if (diffMin < 24 * 60) return `через ${Math.round(diffMin / 60)} год`;
  const days = Math.round(diffMin / (24 * 60));
  return `через ${days} ${pluralDays(days)}`;
}

/** Позиція блоку в годинній сітці: top = (start − gridStart) × hourHeight, height = duration × hourHeight. */
export function eventToGridPosition(
  start,
  end,
  { gridStartHour = 8, hourHeight = 36, minHeight = 22 } = {},
) {
  const s = toDate(start);
  const startMin = s.getHours() * 60 + s.getMinutes() - gridStartHour * 60;
  const top = (startMin / 60) * hourHeight;
  const minutes = end ? durationMinutes(s, end) : 0;
  const height = Math.max(minHeight, (minutes / 60) * hourHeight);
  return { top, height };
}

/** Зворотне: піксель у сітці → час (крок 30 хв). */
export function gridOffsetToTime(
  day,
  offsetPx,
  { gridStartHour = 8, hourHeight = 36, stepMinutes = 30 } = {},
) {
  const minutes = Math.floor(((offsetPx / hourHeight) * 60) / stepMinutes) * stepMinutes;
  const d = startOfDay(day);
  d.setMinutes(gridStartHour * 60 + minutes);
  return d;
}

export const toDateParam = (value) => formatDate(value, 'iso');

export function parseDateParam(str) {
  if (!str) return startOfDay(new Date());
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!m) return startOfDay(new Date());
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Час «зараз» у хвилинах від початку сітки (для лінії NowLine). null, якщо поза сіткою. */
export function nowOffsetMinutes(now = new Date(), gridStartHour = 8, gridEndHour = 20) {
  const minutes = now.getHours() * 60 + now.getMinutes() - gridStartHour * 60;
  if (minutes < 0 || minutes > (gridEndHour - gridStartHour) * 60) return null;
  return minutes;
}
