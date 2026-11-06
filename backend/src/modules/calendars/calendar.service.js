// Сервіс календарів. Правила: головний календар не видаляється й не ховається;
// приховування — поле members[].isHidden поточного користувача, а не самого календаря.

/** Усі календарі, де користувач є учасником (+ віртуальний «holidays» додає фронт). */
export async function listForUser() {
  throw new Error('TODO(@nastia): calendar.service.listForUser');
}

/** Створити календар; автор стає members[0] з role 'owner'. */
export async function create() {
  throw new Error('TODO(@nastia): calendar.service.create');
}

export async function getById() {
  throw new Error('TODO(@nastia): calendar.service.getById');
}

/** Назва/опис/колір. Лише owner. */
export async function update() {
  throw new Error('TODO(@nastia): calendar.service.update');
}

/** Видалити календар разом з його подіями та запрошеннями. Лише owner, не isMain. */
export async function remove() {
  throw new Error('TODO(@nastia): calendar.service.remove');
}

/** Оновити isHidden/color у записі поточного учасника. isMain не можна сховати. */
export async function updateMembership() {
  throw new Error('TODO(@nastia): calendar.service.updateMembership');
}

/** Поділитися: створити Invite(kind 'calendar') і надіслати лист. Якщо email уже зареєстрований — теж через запрошення. */
export async function share() {
  throw new Error('TODO(@nastia): calendar.service.share');
}

/** Змінити роль учасника (editor|viewer). Власника змінити не можна. */
export async function updateMemberRole() {
  throw new Error('TODO(@nastia): calendar.service.updateMemberRole');
}

/** Прибрати учасника. Власника прибрати не можна. */
export async function removeMember() {
  throw new Error('TODO(@nastia): calendar.service.removeMember');
}
