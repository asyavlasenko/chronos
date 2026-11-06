// Мок-дані у формі відповідей API (docs/api.md). Будуються відносно сьогоднішньої дати,
// щоб подання завжди показували поточний тиждень. Замінити на запити з src/api/* (TODO(@teammate2)).
import { startOfWeek, addDays } from '../utils/dates';

export const currentUser = {
  id: 'u-me',
  name: 'Анастасія Власенко',
  firstName: 'Ася',
  email: 'asia@mail.com',
  avatarUrl: null,
  country: 'UA',
  timezone: 'Europe/Kyiv',
  defaultArrangementDuration: 60,
  weekStartsOn: 1,
  timeFormat: '24h',
  showWeekNumbers: true,
  showHolidays: true,
  notifications: { emailReminders: true, push: false, sharedCalendarEmails: true },
  isEmailVerified: true,
  passwordChangedAt: '2026-09-05T00:00:00.000Z',
  createdAt: '2026-09-01T00:00:00.000Z',
};

export const people = {
  'u-me': {
    id: 'u-me',
    name: 'Ти',
    fullName: 'Анастасія Власенко',
    email: 'asia@mail.com',
    initials: 'ТИ',
    color: 'blue',
  },
  'u-maksym': {
    id: 'u-maksym',
    name: 'Максим',
    email: 'maksym@mail.com',
    initials: 'МК',
    color: 'purple',
  },
  'u-olia': { id: 'u-olia', name: 'Оля', email: 'olia@mail.com', initials: 'ОЛ', color: 'green' },
  'u-iryna': {
    id: 'u-iryna',
    name: 'Ірина',
    email: 'iryna@mail.com',
    initials: 'ІР',
    color: 'pink',
  },
};

export const calendars = [
  {
    id: 'cal-main',
    name: 'Основний',
    description: 'Особисті справи, зустрічі з друзями',
    color: 'graphite',
    owner: 'u-me',
    isMain: true,
    isShared: false,
    myRole: 'owner',
    myColor: null,
    isHidden: false,
    members: [{ user: 'u-me', name: 'Ти', role: 'owner', color: null, isHidden: false }],
    eventsCount: 8,
  },
  {
    id: 'cal-study',
    name: 'Навчання',
    description: 'Лекції, практики, дедлайни',
    color: 'purple',
    owner: 'u-me',
    isMain: false,
    isShared: false,
    myRole: 'owner',
    myColor: null,
    isHidden: false,
    members: [{ user: 'u-me', name: 'Ти', role: 'owner', color: null, isHidden: false }],
    eventsCount: 9,
  },
  {
    id: 'cal-work',
    name: 'Робота',
    description: 'Команда Chronos · стендапи, рев’ю, демо',
    color: 'orange',
    owner: 'u-me',
    isMain: false,
    isShared: true,
    myRole: 'owner',
    myColor: 'blue',
    isHidden: false,
    members: [
      {
        user: 'u-me',
        name: 'Ти',
        email: 'asia@mail.com',
        role: 'owner',
        color: 'blue',
        isHidden: false,
      },
      {
        user: 'u-maksym',
        name: 'Максим',
        email: 'maksym@mail.com',
        role: 'editor',
        color: 'purple',
        isHidden: false,
      },
      {
        user: 'u-olia',
        name: 'Оля',
        email: 'olia@mail.com',
        role: 'viewer',
        color: 'green',
        isHidden: false,
      },
    ],
    eventsCount: 7,
  },
  {
    id: 'cal-sport',
    name: 'Спорт',
    description: 'Зал, пробіжки',
    color: 'green',
    owner: 'u-me',
    isMain: false,
    isShared: false,
    myRole: 'owner',
    myColor: null,
    isHidden: false,
    members: [{ user: 'u-me', name: 'Ти', role: 'owner', color: null, isHidden: false }],
    eventsCount: 3,
  },
  {
    id: 'holidays',
    name: 'Свята України',
    description: 'Автоматично за країною з профілю',
    color: 'holidays',
    owner: null,
    isMain: false,
    isShared: false,
    isReadOnly: true,
    myRole: 'viewer',
    myColor: null,
    isHidden: false,
    members: [],
    eventsCount: 11,
  },
  {
    id: 'cal-volunteer',
    name: 'Волонтерство',
    description: 'Спільний з Іриною · приховано для мене',
    color: 'pink',
    owner: 'u-iryna',
    isMain: false,
    isShared: true,
    myRole: 'editor',
    myColor: 'pink',
    isHidden: true,
    members: [
      {
        user: 'u-iryna',
        name: 'Ірина',
        email: 'iryna@mail.com',
        role: 'owner',
        color: 'pink',
        isHidden: false,
      },
      {
        user: 'u-me',
        name: 'Ти',
        email: 'asia@mail.com',
        role: 'editor',
        color: 'pink',
        isHidden: true,
      },
    ],
    eventsCount: 4,
  },
];

// --- Події поточного тижня (0 = понеділок) ---
const weekStart = startOfWeek(new Date(), 1);
const at = (dayIndex, h, m = 0) => {
  const d = addDays(weekStart, dayIndex);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
};

const arrangement = (id, dayIndex, [sh, sm], [eh, em], calendar, title, extra = {}) => ({
  id,
  type: 'arrangement',
  title,
  calendar,
  creator: 'u-me',
  startAt: at(dayIndex, sh, sm),
  endAt: at(dayIndex, eh, em),
  allDay: false,
  color: null,
  location: '',
  description: '',
  reminderMinutesBefore: 10,
  participants: [],
  ...extra,
});

const reminder = (id, dayIndex, [h, m], calendar, title) => ({
  id,
  type: 'reminder',
  title,
  calendar,
  creator: 'u-me',
  startAt: at(dayIndex, h, m),
  endAt: null,
  allDay: false,
  color: null,
  reminderMinutesBefore: 0,
  participants: [],
});

const task = (id, dayIndex, time, calendar, title, extra = {}) => ({
  id,
  type: 'task',
  title,
  calendar,
  creator: 'u-me',
  startAt: dayIndex === null ? null : at(dayIndex, time ? time[0] : 0, time ? time[1] : 0),
  endAt: null,
  allDay: !time,
  color: null,
  isCompleted: false,
  priority: 'medium',
  participants: [],
  ...extra,
});

export const weekEvents = [
  // Пн
  arrangement('e-lec-1', 0, [9, 0], [10, 30], 'cal-study', 'Лекція: Алгоритми'),
  arrangement('e-standup-1', 0, [12, 0], [13, 0], 'cal-work', 'Стендап команди', {
    creator: 'u-me',
  }),
  arrangement('e-gym-1', 0, [18, 0], [19, 30], 'cal-sport', 'Зал'),
  // Вт
  arrangement('e-db', 1, [10, 0], [11, 30], 'cal-study', 'Практика: бази даних'),
  reminder('r-internet', 1, [14, 0], 'cal-main', 'Сплатити інтернет'),
  arrangement('e-review', 1, [16, 0], [17, 0], 'cal-work', 'Code review', { creator: 'u-maksym' }),
  // Ср
  arrangement('e-lec-2', 2, [9, 0], [10, 30], 'cal-study', 'Лекція: Алгоритми'),
  arrangement('e-sync', 2, [10, 0], [11, 0], 'cal-work', 'Синк з дизайном', { creator: 'u-olia' }),
  arrangement('e-lunch', 2, [13, 0], [14, 0], 'cal-main', 'Обід з Олею'),
  reminder('r-granny', 2, [19, 0], 'cal-main', 'Подзвонити бабусі'),
  // Чт
  arrangement('e-mentor', 3, [11, 0], [12, 0], 'cal-work', 'Дзвінок з ментором', {
    location: 'meet.google.com/abc-defg-hij',
    description:
      'Обговорити архітектуру Chronos і Docker-збірку перед демо. Підготувати схему БД і питання щодо нотифікацій.',
    participants: [
      { user: 'u-me', name: 'Ти', email: 'asia@mail.com', status: 'accepted', role: 'organizer' },
      { user: 'u-maksym', name: 'Максим', email: 'maksym@mail.com', status: 'accepted' },
      { user: 'u-olia', name: 'Оля', email: 'olia@mail.com', status: 'pending' },
    ],
  }),
  arrangement('e-demo', 3, [13, 0], [14, 30], 'cal-work', 'Стендап + демо', {
    creator: 'u-olia',
    location: 'офіс, кімната 3',
    description: 'Показати демо Chronos команді, зібрати фідбек',
    participants: [
      { user: 'u-olia', name: 'Оля', email: 'olia@mail.com', status: 'accepted' },
      { user: 'u-me', name: 'Ти', email: 'asia@mail.com', status: 'accepted' },
      { user: 'u-maksym', name: 'Максим', email: 'maksym@mail.com', status: 'accepted' },
    ],
  }),
  arrangement('e-chronos', 3, [14, 30], [16, 0], 'cal-study', 'Робота над Chronos', {
    description: 'Docker-збірка і README зі скріншотами',
  }),
  task('t-tests', 3, [17, 0], 'cal-study', 'Написати тести для /events', {
    priority: 'high',
    estimateMinutes: 120,
  }),
  arrangement('e-gym-2', 3, [18, 30], [20, 0], 'cal-sport', 'Зал'),
  // Пт
  arrangement('e-run-1', 4, [8, 30], [9, 30], 'cal-sport', 'Пробіжка'),
  arrangement('e-sprint', 4, [15, 0], [16, 0], 'cal-work', 'Планування спринту', {
    creator: 'u-maksym',
  }),
  arrangement('e-docker', 4, [17, 0], [18, 0], 'cal-study', 'Воркшоп: Docker'),
  reminder('r-tickets', 4, [19, 30], 'cal-main', 'Купити квитки'),
  // Сб
  arrangement('e-run-2', 5, [9, 0], [10, 30], 'cal-sport', 'Пробіжка та кава'),
  arrangement('e-cinema', 5, [19, 0], [20, 0], 'cal-main', 'Кіно з друзями'),
  // Нд
  task('t-deadline', 6, null, 'cal-study', 'Дедлайн: здати Chronos', {
    priority: 'high',
    isDeadline: true,
  }),
  arrangement('e-plan', 6, [17, 0], [18, 0], 'cal-main', 'Планування тижня'),
];

// Задачі поза сіткою тижня (сторінка «Задачі»)
export const extraTasks = [
  task('t-demo', 3, [12, 30], 'cal-work', 'Підготувати демо Chronos', {
    priority: 'high',
    note: 'перед стендапом',
  }),
  task('t-tickets', 4, [12, 0], 'cal-main', 'Купити квитки на потяг', { priority: 'medium' }),
  task('t-holidays-api', null, null, 'cal-study', 'Підключити API свят', {
    priority: 'medium',
    estimateMinutes: 120,
  }),
  task('t-email', null, null, 'cal-study', 'Email-запрошення на події', {
    priority: 'medium',
    estimateMinutes: 180,
  }),
  task('t-linkedin', null, null, 'cal-main', 'Пост у LinkedIn про Chronos', {
    priority: 'low',
    estimateMinutes: 60,
  }),
  task('t-readme', 1, [18, 0], 'cal-study', 'Оновити README', {
    isCompleted: true,
    completedAt: at(1, 18, 0),
  }),
  task('t-compose', 0, [20, 0], 'cal-study', 'Налаштувати docker-compose', {
    isCompleted: true,
    completedAt: at(0, 20, 0),
  }),
];

// Повторювані події для місяця/року (лекції Пн/Ср 9:00, практика Вт 10:00, стендап Пн 12:00)
function recurringForMonths(monthsBack = 1, monthsForward = 2) {
  const out = [];
  const from = addDays(weekStart, -7 * 4 * monthsBack);
  const to = addDays(weekStart, 7 * 4 * monthsForward);
  for (let d = new Date(from); d < to; d = addDays(d, 1)) {
    const inCurrentWeek = d >= weekStart && d < addDays(weekStart, 7);
    if (inCurrentWeek) continue; // eslint-disable-line no-continue
    const wd = (d.getDay() + 6) % 7;
    const mk = (suffix, h, m, eh, em, cal, title) => ({
      id: `rec-${suffix}-${d.getTime()}`,
      type: 'arrangement',
      title,
      calendar: cal,
      creator: 'u-me',
      startAt: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m),
      endAt: new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em),
      allDay: false,
      color: null,
      participants: [],
    });
    if (wd === 0 || wd === 2) out.push(mk('lec', 9, 0, 10, 30, 'cal-study', 'Лекція: Алгоритми'));
    if (wd === 1) out.push(mk('db', 10, 0, 11, 30, 'cal-study', 'Практика: БД'));
    if (wd === 0) out.push(mk('standup', 12, 0, 13, 0, 'cal-work', 'Стендап'));
    if (wd === 3 && d.getDate() % 2 === 0)
      out.push(mk('mentor', 11, 0, 12, 0, 'cal-work', 'Дзвінок з ментором'));
    if (wd === 5 && d.getDate() % 2 === 1)
      out.push(mk('run', 9, 0, 10, 30, 'cal-sport', 'Пробіжка та кава'));
    if (wd === 6 && d.getDate() % 3 === 0)
      out.push(mk('plan', 17, 0, 18, 0, 'cal-main', 'Планування'));
  }
  return out;
}

export const events = [...weekEvents, ...extraTasks, ...recurringForMonths(10, 2)];

export const invites = [
  {
    id: 'inv-retro',
    kind: 'event',
    status: 'pending',
    token: 'retro-nov',
    email: 'asia@mail.com',
    invitedBy: { id: 'u-maksym', name: 'Максим', initials: 'МК', color: 'purple' },
    expiresAt: addDays(new Date(), 7),
    event: {
      id: 'e-retro',
      type: 'arrangement',
      title: 'Ретро спринту',
      calendar: 'cal-work',
      creator: 'u-maksym',
      startAt: at(7, 15, 0),
      endAt: at(7, 16, 0),
      location: 'meet.google.com/retro-nov-09',
      description: 'Що пішло добре, що покращити, план на наступний спринт. Підготуй 2–3 пункти.',
      participants: [
        { user: 'u-maksym', name: 'Максим', email: 'maksym@mail.com', status: 'accepted' },
        { user: 'u-olia', name: 'Оля', email: 'olia@mail.com', status: 'accepted' },
        { user: null, name: 'Денис', email: 'denys@mail.com', status: 'pending' },
      ],
    },
    calendar: { id: 'cal-work', name: 'Робота', color: 'orange', isShared: true },
  },
];

// Свята України (формат Nager.Date) для поточного та наступного року
const holidaysFor = (year) => [
  { date: `${year}-01-01`, localName: 'Новий рік', name: "New Year's Day" },
  {
    date: `${year}-03-08`,
    localName: 'Міжнародний жіночий день',
    name: "International Women's Day",
  },
  { date: `${year}-04-12`, localName: 'Великдень', name: 'Easter Sunday' },
  { date: `${year}-05-01`, localName: 'День праці', name: 'Labour Day' },
  { date: `${year}-06-28`, localName: 'День Конституції', name: 'Constitution Day' },
  { date: `${year}-08-24`, localName: 'День Незалежності', name: 'Independence Day' },
  { date: `${year}-12-25`, localName: 'Різдво Христове', name: 'Christmas Day' },
];
const thisYear = new Date().getFullYear();
export const holidays = [...holidaysFor(thisYear), ...holidaysFor(thisYear + 1)];

// Стрічка активності спільного календаря «Робота»
export const activity = [
  {
    id: 'a1',
    user: 'u-olia',
    text: 'прийняла запрошення на «Дзвінок з ментором»',
    when: '20 хв тому',
  },
  { id: 'a2', user: 'u-maksym', text: 'створив «Планування спринту» на Пт 15:00', when: 'вчора' },
  { id: 'a3', user: 'u-olia', text: 'перенесла «Стендап + демо» на 13:00', when: 'вчора' },
  { id: 'a4', user: 'u-me', text: 'запросила Максима як редактора', when: '2 дні тому' },
];
