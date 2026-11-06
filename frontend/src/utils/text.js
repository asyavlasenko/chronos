// Відмінювання для підписів українською: '4 події', '1 задача', '21 година зайнято'.

export function plural(n, [one, few, many]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export const pluralEvents = (n) => `${n} ${plural(n, ['подія', 'події', 'подій'])}`;
export const pluralTasks = (n) => `${n} ${plural(n, ['задача', 'задачі', 'задач'])}`;
export const pluralReminders = (n) =>
  `${n} ${plural(n, ['нагадування', 'нагадування', 'нагадувань'])}`;
export const pluralHoursLong = (n) => `${n} ${plural(n, ['година', 'години', 'годин'])}`;
export const pluralMembers = (n) => `${n} ${plural(n, ['учасник', 'учасники', 'учасників'])}`;
export const pluralCalendars = (n) => `${n} ${plural(n, ['календар', 'календарі', 'календарів'])}`;
export const pluralDeadlines = (n) => `${n} ${plural(n, ['дедлайн', 'дедлайни', 'дедлайнів'])}`;
export const pluralInvites = (n) => `${n} ${plural(n, ['запрошення', 'запрошення', 'запрошень'])}`;

/** 'Добрий ранок' / 'Добрий день' / 'Добрий вечір' за годиною */
export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'Добрий ранок';
  if (h < 18) return 'Добрий день';
  return 'Добрий вечір';
}

/** Ініціали: 'Анастасія Власенко' → 'АВ' */
export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}
