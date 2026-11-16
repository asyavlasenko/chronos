import {
  daysBetween,
  getIsoWeek,
  getRangeForView,
  intervalsOverlap,
  startOfIsoWeek,
} from '../src/utils/dates.js';

const utc = (value) => new Date(`${value}Z`);

describe('getIsoWeek', () => {
  it.each([
    ['2026-01-01', { year: 2026, week: 1 }],
    ['2027-01-01', { year: 2026, week: 53 }],
    ['2024-12-30', { year: 2025, week: 1 }],
    ['2026-11-16', { year: 2026, week: 47 }],
    ['2026-12-31', { year: 2026, week: 53 }],
    ['2025-12-28', { year: 2025, week: 52 }],
    ['2025-12-29', { year: 2026, week: 1 }],
    ['2021-01-03', { year: 2020, week: 53 }],
    ['2021-01-04', { year: 2021, week: 1 }],
    ['2024-02-29', { year: 2024, week: 9 }],
  ])('%s → %o', (date, expected) => {
    expect(getIsoWeek(utc(`${date}T00:00:00`))).toEqual(expected);
  });

  it('тиждень триває з понеділка 00:00 до неділі 23:59:59.999 UTC', () => {
    expect(getIsoWeek(utc('2026-11-15T23:59:59.999'))).toEqual({ year: 2026, week: 46 });
    expect(getIsoWeek(utc('2026-11-16T00:00:00'))).toEqual({ year: 2026, week: 47 });
    expect(getIsoWeek(utc('2026-11-22T23:59:59.999'))).toEqual({ year: 2026, week: 47 });
    expect(getIsoWeek(utc('2026-11-23T00:00:00'))).toEqual({ year: 2026, week: 48 });
  });

  it('тиждень 1 завжди містить 4 січня', () => {
    for (let year = 2000; year <= 2040; year += 1) {
      expect(getIsoWeek(new Date(Date.UTC(year, 0, 4)))).toEqual({ year, week: 1 });
    }
  });

  it('приймає ISO-рядок і не змінює передану дату', () => {
    const date = utc('2026-01-01T15:30:00');
    const snapshot = date.getTime();

    expect(getIsoWeek('2026-01-01T15:30:00Z')).toEqual({ year: 2026, week: 1 });
    expect(getIsoWeek(date)).toEqual({ year: 2026, week: 1 });
    expect(date.getTime()).toBe(snapshot);
  });
});

describe('startOfIsoWeek', () => {
  it('повертає понеділок 00:00 UTC для будь-якого дня тижня', () => {
    const monday = '2026-11-16T00:00:00.000Z';

    expect(startOfIsoWeek(utc('2026-11-16T00:00:00')).toISOString()).toBe(monday);
    expect(startOfIsoWeek(utc('2026-11-18T13:45:10')).toISOString()).toBe(monday);
    expect(startOfIsoWeek(utc('2026-11-22T23:59:59.999')).toISOString()).toBe(monday);
  });

  it('переходить через межу місяця і року', () => {
    expect(startOfIsoWeek(utc('2026-01-01T10:00:00')).toISOString()).toBe(
      '2025-12-29T00:00:00.000Z',
    );
    expect(startOfIsoWeek(utc('2026-03-01T10:00:00')).toISOString()).toBe(
      '2026-02-23T00:00:00.000Z',
    );
  });

  it('не змінює передану дату', () => {
    const date = utc('2026-11-18T13:45:10');
    startOfIsoWeek(date);
    expect(date.toISOString()).toBe('2026-11-18T13:45:10.000Z');
  });
});

describe('getRangeForView', () => {
  const anchor = utc('2026-11-18T13:45:10');
  const iso = ({ from, to }) => ({ from: from.toISOString(), to: to.toISOString() });

  it('day: від 00:00 цього дня до 00:00 наступного', () => {
    expect(iso(getRangeForView('day', anchor))).toEqual({
      from: '2026-11-18T00:00:00.000Z',
      to: '2026-11-19T00:00:00.000Z',
    });
  });

  it('week: від понеділка до наступного понеділка', () => {
    expect(iso(getRangeForView('week', anchor))).toEqual({
      from: '2026-11-16T00:00:00.000Z',
      to: '2026-11-23T00:00:00.000Z',
    });
  });

  it('month: від першого числа до першого числа наступного місяця', () => {
    expect(iso(getRangeForView('month', anchor))).toEqual({
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-12-01T00:00:00.000Z',
    });
  });

  it('month: грудень закінчується 1 січня, лютий високосного року має 29 днів', () => {
    expect(iso(getRangeForView('month', utc('2026-12-31T23:59:59')))).toEqual({
      from: '2026-12-01T00:00:00.000Z',
      to: '2027-01-01T00:00:00.000Z',
    });

    const february = getRangeForView('month', utc('2024-02-10T00:00:00'));
    expect(daysBetween(february.from, february.to)).toBe(29);
  });

  it('year: від 1 січня до 1 січня наступного року', () => {
    expect(iso(getRangeForView('year', anchor))).toEqual({
      from: '2026-01-01T00:00:00.000Z',
      to: '2027-01-01T00:00:00.000Z',
    });
  });

  it('межа to не входить у період: сусідні періоди не перетинаються', () => {
    const current = getRangeForView('week', anchor);
    const next = getRangeForView('week', current.to);

    expect(next.from.getTime()).toBe(current.to.getTime());
    expect(intervalsOverlap(current.from, current.to, next.from, next.to)).toBe(false);
  });

  it('приймає ISO-рядок', () => {
    expect(iso(getRangeForView('day', '2026-11-18T13:45:10Z'))).toEqual({
      from: '2026-11-18T00:00:00.000Z',
      to: '2026-11-19T00:00:00.000Z',
    });
  });

  it('кидає RangeError для невідомого подання', () => {
    expect(() => getRangeForView('decade', anchor)).toThrow(RangeError);
    expect(() => getRangeForView('toString', anchor)).toThrow(RangeError);
  });
});

describe('intervalsOverlap', () => {
  const at = (time) => utc(`2026-11-16T${time}:00`);

  it('бачить частковий перетин з обох боків', () => {
    expect(intervalsOverlap(at('10:00'), at('12:00'), at('11:00'), at('13:00'))).toBe(true);
    expect(intervalsOverlap(at('11:00'), at('13:00'), at('10:00'), at('12:00'))).toBe(true);
  });

  it('бачить вкладений і однаковий інтервали', () => {
    expect(intervalsOverlap(at('10:00'), at('14:00'), at('11:00'), at('12:00'))).toBe(true);
    expect(intervalsOverlap(at('11:00'), at('12:00'), at('10:00'), at('14:00'))).toBe(true);
    expect(intervalsOverlap(at('10:00'), at('12:00'), at('10:00'), at('12:00'))).toBe(true);
  });

  it('дотик меж не є перетином', () => {
    expect(intervalsOverlap(at('10:00'), at('11:00'), at('11:00'), at('12:00'))).toBe(false);
    expect(intervalsOverlap(at('11:00'), at('12:00'), at('10:00'), at('11:00'))).toBe(false);
  });

  it('окремі інтервали не перетинаються', () => {
    expect(intervalsOverlap(at('08:00'), at('09:00'), at('10:00'), at('11:00'))).toBe(false);
    expect(intervalsOverlap(at('10:00'), at('11:00'), at('08:00'), at('09:00'))).toBe(false);
  });

  it('перетину достатньо в одну мілісекунду', () => {
    const end = new Date(at('11:00').getTime() + 1);
    expect(intervalsOverlap(at('10:00'), end, at('11:00'), at('12:00'))).toBe(true);
  });

  it('приймає ISO-рядки', () => {
    expect(
      intervalsOverlap(
        '2026-11-16T10:00:00Z',
        '2026-11-16T12:00:00Z',
        '2026-11-16T11:00:00Z',
        '2026-11-16T13:00:00Z',
      ),
    ).toBe(true);
  });
});

describe('daysBetween', () => {
  it('рахує цілі дні між датами', () => {
    expect(daysBetween(utc('2026-11-16T00:00:00'), utc('2026-11-16T00:00:00'))).toBe(0);
    expect(daysBetween(utc('2026-11-16T00:00:00'), utc('2026-11-17T00:00:00'))).toBe(1);
    expect(daysBetween(utc('2026-11-16T00:00:00'), utc('2026-12-25T00:00:00'))).toBe(39);
    expect(daysBetween(utc('2026-01-01T00:00:00'), utc('2027-01-01T00:00:00'))).toBe(365);
    expect(daysBetween(utc('2024-01-01T00:00:00'), utc('2025-01-01T00:00:00'))).toBe(366);
  });

  it('неповну добу відкидає', () => {
    expect(daysBetween(utc('2026-11-16T10:00:00'), utc('2026-11-17T09:59:59'))).toBe(0);
    expect(daysBetween(utc('2026-11-16T10:00:00'), utc('2026-11-17T10:00:00'))).toBe(1);
    expect(daysBetween(utc('2026-11-16T10:00:00'), utc('2026-11-18T22:00:00'))).toBe(2);
  });

  it('повертає від’ємне число, якщо друга дата раніша', () => {
    expect(daysBetween(utc('2026-11-17T00:00:00'), utc('2026-11-16T00:00:00'))).toBe(-1);
    expect(daysBetween(utc('2026-12-25T00:00:00'), utc('2026-11-16T00:00:00'))).toBe(-39);
    expect(daysBetween(utc('2026-11-18T22:00:00'), utc('2026-11-16T10:00:00'))).toBe(-2);
    expect(daysBetween(utc('2026-11-17T09:00:00'), utc('2026-11-16T10:00:00'))).toBe(0);
  });

  it('приймає ISO-рядки', () => {
    expect(daysBetween('2026-11-16T00:00:00Z', '2026-11-20T00:00:00Z')).toBe(4);
  });
});
