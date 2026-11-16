import env from '../../config/env.js';
import ApiError from '../../utils/ApiError.js';
import HolidayCache from './holidayCache.model.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DUPLICATE_KEY = 11000;

const unknownCountry = () => new ApiError(400, 'Свята для цієї країни недоступні');
const unsupportedYear = () => new ApiError(400, 'Свята для цього року недоступні');
const unavailable = () => new ApiError(502, 'Сервіс свят тимчасово недоступний');

const isHoliday = (item) =>
  Boolean(item) &&
  DATE_PATTERN.test(item.date) &&
  typeof item.name === 'string' &&
  item.name !== '';

const toHoliday = (item) => ({
  date: item.date,
  localName: item.localName || item.name,
  name: item.name,
  global: item.global !== false,
  types: Array.isArray(item.types) ? item.types.map(String) : [],
});

const isFresh = (cache) =>
  Date.now() - cache.fetchedAt.getTime() < env.holidays.cacheTtlDays * DAY_MS;

const toResult = (cache, isStale = false) => ({
  country: cache.country,
  year: cache.year,
  holidays: cache.holidays.map(({ date, localName, name }) => ({ date, localName, name })),
  fetchedAt: cache.fetchedAt,
  isStale,
});

export async function fetchFromNager({ country, year }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.holidays.apiUrl}/PublicHolidays/${year}/${country}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (response.status === 404 || response.status === 204) throw unknownCountry();
    if (response.status === 400) throw unsupportedYear();
    if (!response.ok) throw unavailable();

    const payload = await response.json();
    if (!Array.isArray(payload)) throw unavailable();

    return payload.filter(isHoliday).map(toHoliday);
  } catch (err) {
    throw err instanceof ApiError ? err : unavailable();
  } finally {
    clearTimeout(timer);
  }
}

async function saveCache({ country, year }, holidays) {
  const write = () =>
    HolidayCache.findOneAndUpdate(
      { country, year },
      { $set: { holidays, fetchedAt: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

  try {
    return await write();
  } catch (err) {
    if (err?.code !== DUPLICATE_KEY) throw err;
    return write();
  }
}

export async function getHolidays({ country, year }) {
  const cached = await HolidayCache.findOne({ country, year });
  if (cached && isFresh(cached)) return toResult(cached);

  let holidays;
  try {
    holidays = await fetchFromNager({ country, year });
  } catch (err) {
    if (cached && err.statusCode === 502) return toResult(cached, true);
    throw err;
  }

  return toResult(await saveCache({ country, year }, holidays));
}
