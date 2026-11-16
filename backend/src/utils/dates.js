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
