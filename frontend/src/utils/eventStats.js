// Підрахунки для підсумків: групування по днях, зайнятість, наступна подія, задачі тижня.
import { durationMinutes, isToday, toDate } from './dates';

export const addMinutes = (date, minutes) => new Date(toDate(date).getTime() + minutes * 60000);

/** Map<dateString, event[]> за локальним днем startAt (події без дати пропускаються). */
export function groupEventsByDay(events) {
  const map = new Map();
  events.forEach((e) => {
    if (!e.startAt) return;
    const key = toDate(e.startAt).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  });
  return map;
}

export function busyMinutes(events) {
  return events
    .filter((e) => e.type === 'arrangement')
    .reduce((sum, e) => sum + durationMinutes(e.startAt, e.endAt), 0);
}

/** Найближча майбутня зустріч/нагадування відносно now. */
export function nextUpcoming(events, now = new Date()) {
  return (
    events
      .filter(
        (e) => e.startAt && e.type !== 'task' && e.type !== 'holiday' && toDate(e.startAt) > now,
      )
      .sort((a, b) => toDate(a.startAt) - toDate(b.startAt))[0] || null
  );
}

/** Поточна подія (now усередині [startAt, endAt)). */
export function currentEvent(events, now = new Date()) {
  return (
    events.find(
      (e) => e.type === 'arrangement' && toDate(e.startAt) <= now && toDate(e.endAt) > now,
    ) || null
  );
}

export function weekSummary(events) {
  const tasks = events.filter((e) => e.type === 'task');
  const todays = events.filter((e) => e.startAt && isToday(e.startAt));
  return {
    busyMinutes: busyMinutes(events),
    tasksTotal: tasks.length,
    tasksDone: tasks.filter((t) => t.isCompleted).length,
    todayEvents: todays.filter((e) => e.type === 'arrangement' || e.type === 'reminder').length,
    todayTasks: todays.filter((e) => e.type === 'task').length,
    arrangements: events.filter((e) => e.type === 'arrangement').length,
    reminders: events.filter((e) => e.type === 'reminder').length,
    deadlines: tasks.filter((t) => t.isDeadline).length,
  };
}

/** Учасники події → елементи для AvatarStack, використовуючи довідник людей. */
export function participantsToAvatars(participants = [], people = {}) {
  return participants.map((p) => {
    const person = p.user ? people[p.user] : null;
    const name = p.name || person?.name || p.email;
    return {
      id: p.user || p.email,
      initials: person?.initials || name.slice(0, 2).toUpperCase(),
      color: person?.color || 'graphite',
      name,
    };
  });
}

/**
 * Вільні вікна ≥ minMinutes між подіями дня в межах [startHour, endHour); для сьогодні — від «зараз».
 * @returns {Array<{ start: Date, end: Date }>}
 */
export function findFreeSlots(
  day,
  events,
  { startHour = 8, endHour = 20, minMinutes = 60, now = new Date() } = {},
) {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour);
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endHour);
  if (dayEnd <= now && !isToday(day)) return [];
  let cursor =
    now > dayStart && isToday(day)
      ? new Date(Math.ceil(now.getTime() / (30 * 60000)) * 30 * 60000)
      : dayStart;
  const slots = [];
  [...events]
    .filter((e) => e.startAt && !e.allDay)
    .sort((a, b) => toDate(a.startAt) - toDate(b.startAt))
    .forEach((e) => {
      const s = toDate(e.startAt);
      const en = e.endAt ? toDate(e.endAt) : s;
      if (s - cursor >= minMinutes * 60000)
        slots.push({ start: new Date(cursor), end: new Date(s) });
      if (en > cursor) cursor = en;
    });
  if (dayEnd - cursor >= minMinutes * 60000) slots.push({ start: new Date(cursor), end: dayEnd });
  return slots;
}
