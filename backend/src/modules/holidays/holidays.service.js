// Державні свята через Nager.Date з кешем у MongoDB по country+year.

/**
 * Повертає свята для країни й року. Алгоритм:
 *   1. HolidayCache.findOne({ country, year }); якщо є і fetchedAt свіжіший за cacheTtlDays — віддати.
 *   2. Інакше fetch(`${env.holidays.apiUrl}/PublicHolidays/${year}/${country}`) (Node 20 має fetch).
 *   3. Успіх → upsert у кеш і віддати. Помилка API → віддати застарілий кеш, якщо є; інакше 502.
 * @param {{ country: string, year: number }} params
 * @returns {Promise<Array<{ date: string, localName: string, name: string }>>}
 */
export async function getHolidays() {
  throw new Error('TODO(@teammate1): holidays.service.getHolidays');
}

/** Прямий запит до Nager.Date без кешу (для тестів і першого заповнення). */
export async function fetchFromNager() {
  throw new Error('TODO(@teammate1): holidays.service.fetchFromNager');
}
