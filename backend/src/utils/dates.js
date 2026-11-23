const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const toTime = (value) => new Date(value).getTime();

const startOfUtcDay = (date) => new Date(Math.floor(toTime(date) / DAY_MS) * DAY_MS);

export function startOfIsoWeek(date) {
  const dayStart = startOfUtcDay(date);
  const isoDay = dayStart.getUTCDay() || 7;
  return new Date(dayStart.getTime() - (isoDay - 1) * DAY_MS);
}

export function getIsoWeek(date) {
  const thursday = new Date(startOfIsoWeek(date).getTime() + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / WEEK_MS) + 1;
  return { year, week };
}

export function getRangeForView(view, anchor) {
  const date = new Date(anchor);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  switch (view) {
    case 'day': {
      const from = startOfUtcDay(date);
      return { from, to: new Date(from.getTime() + DAY_MS) };
    }
    case 'week': {
      const from = startOfIsoWeek(date);
      return { from, to: new Date(from.getTime() + WEEK_MS) };
    }
    case 'month':
      return {
        from: new Date(Date.UTC(year, month, 1)),
        to: new Date(Date.UTC(year, month + 1, 1)),
      };
    case 'year':
      return {
        from: new Date(Date.UTC(year, 0, 1)),
        to: new Date(Date.UTC(year + 1, 0, 1)),
      };
    default:
      throw new RangeError(`Невідоме подання календаря: ${view}`);
  }
}

export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return toTime(aStart) < toTime(bEnd) && toTime(bStart) < toTime(aEnd);
}

export function daysBetween(a, b) {
  return Math.trunc((toTime(b) - toTime(a)) / DAY_MS) || 0;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;

export function formatEventWhen(event, timeZone = 'UTC') {
  const time = event.allDay ? {} : { hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...time,
  }).format(event.startAt);
}

export function toDateParam(date, timeZone = 'UTC') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatLead(startAt, now = new Date()) {
  const minutes = Math.round((toTime(startAt) - toTime(now)) / MINUTE_MS);
  if (minutes < 1) return 'уже зараз';
  if (minutes < HOUR_MINUTES) return `через ${minutes} хв`;
  if (minutes < DAY_MINUTES) return `через ${Math.round(minutes / HOUR_MINUTES)} год`;
  return `через ${Math.round(minutes / DAY_MINUTES)} дн`;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function zoneOffsetMs(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const value = (type) => Number(parts.find((part) => part.type === type).value);
  const wallAsUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );

  return wallAsUtc - Math.floor(utcMs / 1000) * 1000;
}

export function isCalendarDate(value) {
  const match = DATE_PATTERN.exec(value ?? '');
  if (!match) return false;

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const isClockTime = (value) => TIME_PATTERN.test(value ?? '');

export function zonedTimeToUtc(date, time, timeZone = 'UTC') {
  const [year, month, day] = DATE_PATTERN.exec(date).slice(1).map(Number);
  const [hours, minutes] = TIME_PATTERN.exec(time).slice(1).map(Number);
  const wall = Date.UTC(year, month - 1, day, hours, minutes);
  const guess = wall - zoneOffsetMs(wall, timeZone);

  return new Date(wall - zoneOffsetMs(guess, timeZone));
}

const MIDNIGHT = '00:00';

function shiftDateParam(date, days) {
  const [year, month, day] = DATE_PATTERN.exec(date).slice(1).map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function localDayRange(now, timeZone = 'UTC', offsetDays = 0) {
  const day = shiftDateParam(toDateParam(now, timeZone), offsetDays);
  return {
    from: zonedTimeToUtc(day, MIDNIGHT, timeZone),
    to: zonedTimeToUtc(shiftDateParam(day, 1), MIDNIGHT, timeZone),
  };
}

export function describeLocalNow(now, timeZone = 'UTC') {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
  const weekday = new Intl.DateTimeFormat('uk-UA', { timeZone, weekday: 'long' }).format(now);

  return { date: toDateParam(now, timeZone), time, weekday };
}
