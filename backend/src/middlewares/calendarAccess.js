import { ROLE_RANK } from '../constants/index.js';

/**
 * Перевірка ролі користувача в календарі.
 *
 *   router.delete('/:id', auth, calendarAccess(ROLES.OWNER), controller.remove);
 *
 * Правила (див. design/screens/08-calendars.html):
 *   owner  — усе, включно з видаленням будь-яких подій і керуванням учасниками
 *   editor — створює події; редагує/видаляє ЛИШЕ свої
 *   viewer — тільки читає
 * Власник теж є записом у calendar.members[] з role = 'owner', тому пошук один для всіх.
 *
 * TODO(@nastia):
 *   1. Знайти Calendar за req.params.id (404, якщо немає).
 *   2. member = calendar.members.find(m => m.user.equals(req.user.id)) (403, якщо немає).
 *   3. ROLE_RANK[member.role] >= ROLE_RANK[minRole] інакше 403.
 *   4. req.calendar = calendar; req.membership = member; next().
 *
 * ЗАГЛУШКА: лише зберігає необхідну роль у req і пропускає далі.
 */
export default function calendarAccess(minRole) {
  return (req, res, next) => {
    req.requiredRole = minRole;
    req.requiredRoleRank = ROLE_RANK[minRole];
    next();
  };
}

/**
 * Та сама перевірка для сервісів подій, де id календаря береться з події або тіла запиту.
 * @param {string} userId
 * @param {string} calendarId
 * @param {'owner'|'editor'|'viewer'} minRole
 * @returns {Promise<{ calendar: object, membership: object }>}
 */
export async function assertCalendarRole() {
  throw new Error('TODO(@nastia): calendarAccess.assertCalendarRole');
}
