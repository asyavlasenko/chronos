import request from 'supertest';
import app from '../src/app.js';
import env from '../src/config/env.js';
import HolidayCache from '../src/modules/holidays/holidayCache.model.js';
import { fetchFromNager } from '../src/modules/holidays/holidays.service.js';
import { clearDb, connectTestDb, disconnectTestDb } from './helpers/db.js';
import { createUser } from './helpers/factories.js';

const { jest } = import.meta;

const DAY_MS = 24 * 60 * 60 * 1000;
const realFetch = global.fetch;

const nagerPayload = [
  {
    date: '2026-01-01',
    localName: 'Новий Рік',
    name: "New Year's Day",
    countryCode: 'UA',
    fixed: false,
    global: true,
    counties: null,
    launchYear: null,
    types: ['Public'],
  },
  {
    date: '2026-08-24',
    localName: 'День Незалежності',
    name: 'Independence Day',
    countryCode: 'UA',
    fixed: false,
    global: true,
    counties: null,
    launchYear: null,
    types: ['Public'],
  },
];

const expectedHolidays = [
  { date: '2026-01-01', localName: 'Новий Рік', name: "New Year's Day" },
  { date: '2026-08-24', localName: 'День Незалежності', name: 'Independence Day' },
];

const oldHolidays = [{ date: '2026-01-07', localName: 'Старе свято', name: 'Old Holiday' }];

const respondWith = (body, status = 200) =>
  global.fetch.mockImplementation(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));

const seedCache = (ageDays, overrides = {}) =>
  HolidayCache.create({
    country: 'UA',
    year: 2026,
    holidays: oldHolidays,
    fetchedAt: new Date(Date.now() - ageDays * DAY_MS),
    ...overrides,
  });

const getHolidays = (headers, query = {}) =>
  request(app).get('/api/holidays').query(query).set(headers);

let me;

beforeAll(() => connectTestDb('holidays'));

beforeEach(async () => {
  global.fetch = jest.fn();
  respondWith(nagerPayload);
  me = await createUser();
});

afterEach(() => clearDb());

afterAll(async () => {
  global.fetch = realFetch;
  await disconnectTestDb();
});

describe('GET /api/holidays', () => {
  it('перший запит іде в Nager.Date і зберігає кеш', async () => {
    const before = Date.now();
    const res = await getHolidays(me.headers, { year: 2026, country: 'UA' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      country: 'UA',
      year: 2026,
      holidays: expectedHolidays,
      fetchedAt: expect.any(String),
      isStale: false,
    });
    expect(new Date(res.body.fetchedAt).getTime()).toBeGreaterThanOrEqual(before);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe(`${env.holidays.apiUrl}/PublicHolidays/2026/UA`);

    const cached = await HolidayCache.find({ country: 'UA', year: 2026 });
    expect(cached).toHaveLength(1);
    expect(cached[0].holidays.map((h) => h.date)).toEqual(['2026-01-01', '2026-08-24']);
    expect(cached[0].holidays[0].types).toEqual(['Public']);
  });

  it('другий запит віддає кеш і не звертається до API', async () => {
    const first = await getHolidays(me.headers, { year: 2026, country: 'UA' });
    const second = await getHolidays(me.headers, { year: 2026, country: 'UA' });

    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('кеш окремий для кожної пари країна + рік', async () => {
    await getHolidays(me.headers, { year: 2026, country: 'UA' });
    await getHolidays(me.headers, { year: 2027, country: 'UA' });
    await getHolidays(me.headers, { year: 2026, country: 'PL' });
    await getHolidays(me.headers, { year: 2026, country: 'PL' });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(await HolidayCache.countDocuments()).toBe(3);
  });

  it('свіжий кеш у межах TTL не оновлюється', async () => {
    await seedCache(env.holidays.cacheTtlDays - 1);

    const res = await getHolidays(me.headers, { year: 2026, country: 'UA' });

    expect(res.status).toBe(200);
    expect(res.body.holidays).toEqual(oldHolidays);
    expect(res.body.isStale).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('застарілий кеш оновлюється з API', async () => {
    const stale = await seedCache(env.holidays.cacheTtlDays + 1);

    const res = await getHolidays(me.headers, { year: 2026, country: 'UA' });

    expect(res.status).toBe(200);
    expect(res.body.holidays).toEqual(expectedHolidays);
    expect(res.body.isStale).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const caches = await HolidayCache.find({ country: 'UA', year: 2026 });
    expect(caches).toHaveLength(1);
    expect(caches[0].id).toBe(stale.id);
    expect(caches[0].fetchedAt.getTime()).toBeGreaterThan(stale.fetchedAt.getTime());
    expect(caches[0].holidays).toHaveLength(2);
  });

  it('при мережевій помилці віддає застарілий кеш з isStale', async () => {
    const stale = await seedCache(env.holidays.cacheTtlDays + 5);
    global.fetch.mockRejectedValue(new TypeError('fetch failed'));

    const res = await getHolidays(me.headers, { year: 2026, country: 'UA' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      country: 'UA',
      year: 2026,
      holidays: oldHolidays,
      fetchedAt: stale.fetchedAt.toISOString(),
      isStale: true,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const untouched = await HolidayCache.findById(stale.id);
    expect(untouched.fetchedAt.getTime()).toBe(stale.fetchedAt.getTime());
  });

  it('при відповіді 5xx або зіпсованому тілі віддає застарілий кеш з isStale', async () => {
    await seedCache(env.holidays.cacheTtlDays + 5);

    respondWith({ title: 'Service Unavailable' }, 503);
    const serverError = await getHolidays(me.headers, { year: 2026, country: 'UA' });

    respondWith({ unexpected: true });
    const brokenBody = await getHolidays(me.headers, { year: 2026, country: 'UA' });

    expect(serverError.status).toBe(200);
    expect(serverError.body.isStale).toBe(true);
    expect(serverError.body.holidays).toEqual(oldHolidays);
    expect(brokenBody.status).toBe(200);
    expect(brokenBody.body.isStale).toBe(true);
  });

  it('без кешу при падінні API відповідає 502', async () => {
    global.fetch.mockRejectedValue(new TypeError('fetch failed'));
    const network = await getHolidays(me.headers, { year: 2026, country: 'UA' });

    respondWith({ title: 'Internal Server Error' }, 500);
    const serverError = await getHolidays(me.headers, { year: 2026, country: 'UA' });

    expect(network.status).toBe(502);
    expect(network.body).toEqual({
      status: 'error',
      message: 'Сервіс свят тимчасово недоступний',
    });
    expect(serverError.status).toBe(502);
    expect(await HolidayCache.countDocuments()).toBe(0);
  });

  it('після відновлення API знову кешує', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    const failed = await getHolidays(me.headers, { year: 2026, country: 'UA' });
    const recovered = await getHolidays(me.headers, { year: 2026, country: 'UA' });

    expect(failed.status).toBe(502);
    expect(recovered.status).toBe(200);
    expect(recovered.body.holidays).toEqual(expectedHolidays);
  });

  it('невідома країна дає 400 і не потрапляє в кеш', async () => {
    respondWith({ title: 'Not Found' }, 404);
    const notFound = await getHolidays(me.headers, { year: 2026, country: 'ZZ' });

    respondWith(null, 204);
    const noContent = await getHolidays(me.headers, { year: 2026, country: 'ZZ' });

    expect(notFound.status).toBe(400);
    expect(notFound.body.message).toBe('Свята для цієї країни недоступні');
    expect(noContent.status).toBe(400);
    expect(noContent.body.message).toBe('Свята для цієї країни недоступні');
    expect(await HolidayCache.countDocuments()).toBe(0);
  });

  it('невідома країна дає 400 навіть за наявності застарілого кешу', async () => {
    await seedCache(env.holidays.cacheTtlDays + 1);
    respondWith({ title: 'Not Found' }, 404);

    const res = await getHolidays(me.headers, { year: 2026, country: 'UA' });

    expect(res.status).toBe(400);
  });

  it('рік, який не підтримує Nager.Date, дає 400', async () => {
    respondWith({ title: 'One or more validation errors occurred.', status: 400 }, 400);

    const res = await getHolidays(me.headers, { year: 1970, country: 'UA' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Свята для цього року недоступні');
  });

  it('відкидає записи без дати чи назви і підставляє name замість порожнього localName', async () => {
    respondWith([
      { date: '2026-05-01', localName: '', name: 'Labour Day' },
      { date: 'not-a-date', localName: 'Зіпсоване', name: 'Broken' },
      { date: '2026-06-28', localName: 'Без назви' },
      null,
    ]);

    const res = await getHolidays(me.headers, { year: 2026, country: 'UA' });

    expect(res.status).toBe(200);
    expect(res.body.holidays).toEqual([
      { date: '2026-05-01', localName: 'Labour Day', name: 'Labour Day' },
    ]);
  });

  it('одночасні запити для однієї пари не падають на унікальному індексі', async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => getHolidays(me.headers, { year: 2026, country: 'UA' })),
    );

    expect(responses.map((res) => res.status)).toEqual(Array(8).fill(200));
    expect(await HolidayCache.countDocuments({ country: 'UA', year: 2026 })).toBe(1);
  });

  it('country за замовчуванням береться з профілю', async () => {
    const polish = await createUser({ country: 'PL' });

    const res = await getHolidays(polish.headers, { year: 2026 });

    expect(res.status).toBe(200);
    expect(res.body.country).toBe('PL');
    expect(global.fetch.mock.calls[0][0]).toBe(`${env.holidays.apiUrl}/PublicHolidays/2026/PL`);
  });

  it('year за замовчуванням дорівнює поточному', async () => {
    const res = await getHolidays(me.headers);
    const currentYear = new Date().getUTCFullYear();

    expect(res.status).toBe(200);
    expect(res.body.year).toBe(currentYear);
    expect(res.body.country).toBe('UA');
    expect(global.fetch.mock.calls[0][0]).toBe(
      `${env.holidays.apiUrl}/PublicHolidays/${currentYear}/UA`,
    );
  });

  it('приводить country до верхнього регістру', async () => {
    const res = await getHolidays(me.headers, { year: 2026, country: 'pl' });

    expect(res.status).toBe(200);
    expect(res.body.country).toBe('PL');
    expect(global.fetch.mock.calls[0][0]).toBe(`${env.holidays.apiUrl}/PublicHolidays/2026/PL`);
  });

  it.each([['1969'], ['2101'], ['abc'], ['2026.5']])('відхиляє year = %s з 400', async (year) => {
    const res = await getHolidays(me.headers, { year, country: 'UA' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Помилка валідації');
    expect(res.body.details.map((d) => d.field)).toEqual(['year']);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([['UKR'], ['U'], ['12'], ['U1'], ['..']])(
    'відхиляє country = %s з 400',
    async (country) => {
      const res = await getHolidays(me.headers, { year: 2026, country });

      expect(res.status).toBe(400);
      expect(res.body.details).toEqual([
        { field: 'country', message: 'Поле «Країна» має складатися з двох латинських літер' },
      ]);
      expect(global.fetch).not.toHaveBeenCalled();
    },
  );

  it('приймає граничні роки 1970 і 2100', async () => {
    const min = await getHolidays(me.headers, { year: 1970, country: 'UA' });
    const max = await getHolidays(me.headers, { year: 2100, country: 'UA' });

    expect(min.status).toBe(200);
    expect(min.body.year).toBe(1970);
    expect(max.status).toBe(200);
    expect(max.body.year).toBe(2100);
  });

  it('відповідає 401 без токена', async () => {
    const res = await request(app).get('/api/holidays').query({ year: 2026 });

    expect(res.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('fetchFromNager', () => {
  it('обриває завислий запит за таймаутом і повідомляє про недоступність', async () => {
    global.fetch.mockImplementation(
      (url, { signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      const outcome = expect(fetchFromNager({ country: 'UA', year: 2026 })).rejects.toMatchObject({
        statusCode: 502,
        message: 'Сервіс свят тимчасово недоступний',
      });
      const { signal } = global.fetch.mock.calls[0][1];

      jest.advanceTimersByTime(7999);
      expect(signal.aborted).toBe(false);
      jest.advanceTimersByTime(1);
      expect(signal.aborted).toBe(true);

      await outcome;
    } finally {
      jest.useRealTimers();
    }
  });

  it('повертає нормалізовані свята без звернення до кешу', async () => {
    const holidays = await fetchFromNager({ country: 'UA', year: 2026 });

    expect(holidays).toEqual([
      {
        date: '2026-01-01',
        localName: 'Новий Рік',
        name: "New Year's Day",
        global: true,
        types: ['Public'],
      },
      {
        date: '2026-08-24',
        localName: 'День Незалежності',
        name: 'Independence Day',
        global: true,
        types: ['Public'],
      },
    ]);
    expect(await HolidayCache.countDocuments()).toBe(0);
  });
});
