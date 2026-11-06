// Утиліти дат. Усе в UTC; локальний час — справа фронту.
// Номери тижнів — ISO 8601: тиждень починається з понеділка, перший тиждень року містить 4 січня.

/**
 * Номер ISO-тижня для дати.
 * @param {Date} date
 * @returns {{ year: number, week: number }} ISO-рік може відрізнятись від календарного (напр., 1 січня → тиждень 53 минулого року)
 */
export function getIsoWeek() {
  // TODO(@teammate1): алгоритм через «четвер цього тижня» (date + 4 − isoDay)
  throw new Error('TODO(@teammate1): dates.getIsoWeek');
}

/**
 * Початок ISO-тижня (понеділок 00:00 UTC) для дати.
 * @param {Date} date
 * @returns {Date}
 */
export function startOfIsoWeek() {
  throw new Error('TODO(@teammate1): dates.startOfIsoWeek');
}

/**
 * Межі періоду для запиту подій.
 * @param {'day'|'week'|'month'|'year'} view
 * @param {Date} anchor
 * @returns {{ from: Date, to: Date }}
 */
export function getRangeForView() {
  throw new Error('TODO(@teammate1): dates.getRangeForView');
}

/**
 * Чи перетинаються два інтервали [aStart, aEnd) і [bStart, bEnd).
 */
export function intervalsOverlap() {
  throw new Error('TODO(@teammate1): dates.intervalsOverlap');
}

/**
 * Кількість повних днів між двома датами (завдання з Investigate у ТЗ).
 */
export function daysBetween() {
  throw new Error('TODO(@teammate1): dates.daysBetween');
}
