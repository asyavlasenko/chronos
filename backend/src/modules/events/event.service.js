// Сервіс подій. Права: owner календаря — будь-яка подія; editor — лише свої; viewer — читання.
// Перевірка через assertCalendarRole() з middlewares/calendarAccess.js.

/**
 * Події в діапазоні для видимих календарів користувача.
 * Перетин з діапазоном: startAt < to && (endAt > from || (endAt == null && startAt >= from)).
 * Фільтри: calendars (ids), types, q (text search). Приховані календарі (members[].isHidden) не включати.
 */
export async function list() {
  throw new Error('TODO(@teammate1): event.service.list');
}

/**
 * Створення. Для arrangement без endAt → startAt + user.defaultArrangementDuration хв.
 * Для participants — створити Invite(kind 'event') на кожен email і надіслати лист.
 */
export async function create() {
  throw new Error('TODO(@teammate1): event.service.create');
}

export async function getById() {
  throw new Error('TODO(@teammate1): event.service.getById');
}

export async function update() {
  throw new Error('TODO(@teammate1): event.service.update');
}

export async function remove() {
  throw new Error('TODO(@teammate1): event.service.remove');
}

/** Додати учасників до наявної події (design/screens/12-event-details.html, «Запросити ще по email»). */
export async function invite() {
  throw new Error('TODO(@teammate1): event.service.invite');
}
