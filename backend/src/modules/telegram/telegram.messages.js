import { EVENT_TYPES } from '../../constants/index.js';

export const ACTIONS = Object.freeze({ DONE: 'done', SNOOZE: 'snooze' });
export const SNOOZE_MINUTES = 10;

const PUBLIC_SCHEME = 'https://';

const TYPE_LABELS = {
  [EVENT_TYPES.ARRANGEMENT]: 'Зустріч',
  [EVENT_TYPES.REMINDER]: 'Нагадування',
  [EVENT_TYPES.TASK]: 'Задача',
};

export const PROFILE = Object.freeze({
  description: [
    'Chronos нагадує про зустрічі, задачі й нагадування з твого календаря.',
    '',
    'Щоб почати, відкрий у Chronos «Профіль», розділ «Сповіщення», і натисни «Підключити». Після цього бот писатиме сюди перед кожною подією.',
  ].join('\n'),
  shortDescription: 'Нагадування про події з календаря Chronos.',
  commands: [
    { command: 'today', description: 'Події на сьогодні' },
    { command: 'tomorrow', description: 'Події на завтра' },
    { command: 'help', description: 'Що вміє бот' },
    { command: 'stop', description: 'Вимкнути нагадування' },
  ],
});

export const escapeHtml = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const REPLIES = Object.freeze({
  help: [
    '<b>Chronos</b> нагадує про події з твого календаря.',
    '',
    '/today — події на сьогодні',
    '/tomorrow — події на завтра',
    '/stop — вимкнути нагадування',
    '/help — ця підказка',
    '',
    'Під кожним нагадуванням є кнопка «Відкласти», а під задачами ще й «Виконано».',
    '',
    'Щоб підключити бота, відкрий у Chronos «Профіль» і натисни «Підключити» в розділі «Сповіщення».',
  ].join('\n'),
  expired:
    'Посилання застаріло або вже використане. Відкрий у Chronos «Профіль» і натисни «Підключити» ще раз.',
  connected: (name) =>
    `Готово, <b>${escapeHtml(name)}</b>! Сюди приходитимуть нагадування про події з Chronos.\n\nСпробуй /today, щоб побачити події на сьогодні.`,
  disconnected: 'Нагадування вимкнено. Підключити бота знову можна в профілі Chronos.',
  notConnected:
    'Цей чат не підключений до акаунта Chronos. Відкрий у Chronos «Профіль» і натисни «Підключити» в розділі «Сповіщення».',
  test: '<b>Тестове повідомлення від Chronos.</b>\nНагадування про події приходитимуть сюди.',
  snoozed: (time) => `Нагадаю ще раз о ${time}`,
  done: 'Задачу виконано',
  unavailable: 'Цієї події вже немає або вона недоступна',
});

const timeOf = (date, timeZone) =>
  new Intl.DateTimeFormat('uk-UA', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

export const dayOf = (date, timeZone) =>
  new Intl.DateTimeFormat('uk-UA', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);

export const formatTime = timeOf;

export function reminderMessage({ eventId, type, title, when, lead, location, eventUrl }) {
  const lines = [
    `<b>Нагадування: «${escapeHtml(title)}»</b> ${lead}`,
    `${TYPE_LABELS[type]} · ${escapeHtml(when)}`,
  ];
  if (location) lines.push(`Місце: ${escapeHtml(location)}`);

  const actions = [
    { text: `Відкласти на ${SNOOZE_MINUTES} хв`, action: ACTIONS.SNOOZE, id: eventId },
  ];
  if (type === EVENT_TYPES.TASK) {
    actions.unshift({ text: 'Виконано', action: ACTIONS.DONE, id: eventId });
  }

  const buttons = [actions];
  if (eventUrl.startsWith(PUBLIC_SCHEME)) {
    buttons.push([{ text: 'Відкрити подію', url: eventUrl }]);
  } else {
    lines.push(`Відкрити подію: ${escapeHtml(eventUrl)}`);
  }

  return { text: lines.join('\n'), buttons };
}

export function agendaTime(event, timeZone) {
  if (event.allDay) return 'весь день';
  const start = timeOf(event.startAt, timeZone);
  if (event.type === EVENT_TYPES.TASK) return `до ${start}`;
  return event.endAt ? `${start}–${timeOf(event.endAt, timeZone)}` : start;
}

function agendaLine(event, timeZone) {
  const title = escapeHtml(event.title);
  const name = event.isCompleted ? `<s>${title}</s>` : title;
  const suffix =
    event.type === EVENT_TYPES.ARRANGEMENT ? '' : ` · ${TYPE_LABELS[event.type].toLowerCase()}`;
  return `<b>${agendaTime(event, timeZone)}</b>  ${name}${suffix}`;
}

export function agendaMessage({ label, date, events, timeZone }) {
  const heading = `<b>${label} · ${dayOf(date, timeZone)}</b>`;
  if (events.length === 0) return `${heading}\n\nПодій немає.`;
  return [heading, '', ...events.map((event) => agendaLine(event, timeZone))].join('\n');
}
