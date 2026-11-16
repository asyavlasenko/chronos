import mongoose from 'mongoose';
import env from '../config/env.js';
import { connectDb, disconnectDb } from '../config/db.js';
import * as authService from '../modules/auth/auth.service.js';
import Calendar from '../modules/calendars/calendar.model.js';
import Event from '../modules/events/event.model.js';
import Invite from '../modules/invites/invite.model.js';
import User from '../modules/users/user.model.js';
import { randomToken } from '../utils/tokens.js';

const TIME_ZONE = 'Europe/Kyiv';
const PASSWORD = process.env.SEED_PASSWORD || 'chronos-demo';
const DAY_MS = 24 * 60 * 60 * 1000;

const DEMO_USERS = [
  { key: 'asia', email: 'asia@chronos.demo', name: 'Анастасія Власенко' },
  { key: 'maksym', email: 'maksym@chronos.demo', name: 'Максим Коваль' },
  { key: 'olia', email: 'olia@chronos.demo', name: 'Оля Шевченко' },
];

function zoneOffsetMs(instant) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant);
  const get = (type) => Number(parts.find((part) => part.type === type).value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - instant.getTime();
}

function zonedTime(year, monthIndex, day, hour = 0, minute = 0) {
  const guess = new Date(Date.UTC(year, monthIndex, day, hour, minute));
  return new Date(guess.getTime() - zoneOffsetMs(guess));
}

function currentMonday() {
  const now = new Date(Date.now() + zoneOffsetMs(new Date()));
  const weekday = (now.getUTCDay() + 6) % 7;
  return {
    year: now.getUTCFullYear(),
    monthIndex: now.getUTCMonth(),
    day: now.getUTCDate() - weekday,
  };
}

const monday = currentMonday();

const at = (dayOffset, hour = 0, minute = 0) =>
  zonedTime(monday.year, monday.monthIndex, monday.day + dayOffset, hour, minute);

async function removeDemoData() {
  const emails = DEMO_USERS.map((user) => user.email);
  const users = await User.find({ email: { $in: emails } }).select('_id');
  const userIds = users.map((user) => user._id);
  const calendars = await Calendar.find({ owner: { $in: userIds } }).select('_id');
  const calendarIds = calendars.map((calendar) => calendar._id);
  const events = await Event.find({ calendar: { $in: calendarIds } }).select('_id');
  const eventIds = events.map((event) => event._id);

  await Invite.deleteMany({
    $or: [
      { calendar: { $in: calendarIds } },
      { event: { $in: eventIds } },
      { invitedBy: { $in: userIds } },
      { email: { $in: emails } },
    ],
  });
  await Event.deleteMany({ calendar: { $in: calendarIds } });
  await Calendar.deleteMany({ _id: { $in: calendarIds } });
  await Calendar.updateMany({}, { $pull: { members: { user: { $in: userIds } } } });
  await User.deleteMany({ _id: { $in: userIds } });
}

async function createUsers() {
  const created = {};
  await DEMO_USERS.reduce(async (previous, demo) => {
    await previous;
    const { user } = await authService.register({
      email: demo.email,
      password: PASSWORD,
      name: demo.name,
    });
    created[demo.key] = user;
  }, Promise.resolve());
  return created;
}

const arrangement = (calendar, creator, title, day, start, end, extra = {}) => ({
  type: 'arrangement',
  calendar: calendar._id,
  creator: creator._id,
  title,
  startAt: at(day, start[0], start[1]),
  endAt: at(day, end[0], end[1]),
  ...extra,
});

const reminder = (calendar, creator, title, day, time) => ({
  type: 'reminder',
  calendar: calendar._id,
  creator: creator._id,
  title,
  startAt: at(day, time[0], time[1]),
  reminderMinutesBefore: 0,
});

const task = (calendar, creator, title, extra = {}) => ({
  type: 'task',
  calendar: calendar._id,
  creator: creator._id,
  title,
  ...extra,
});

const participant = (user, status) => ({
  user: user._id,
  email: user.email,
  status,
  respondedAt: status === 'pending' ? null : new Date(),
});

function recurring(calendar, creator, weeks) {
  return weeks.flatMap((week) => {
    const shift = week * 7;
    return [
      arrangement(calendar.study, creator, 'Лекція: Алгоритми', shift, [9, 0], [10, 30]),
      arrangement(calendar.study, creator, 'Лекція: Алгоритми', shift + 2, [9, 0], [10, 30]),
      arrangement(calendar.study, creator, 'Практика: бази даних', shift + 1, [10, 0], [11, 30]),
      arrangement(calendar.work, creator, 'Стендап команди', shift, [12, 0], [13, 0]),
      arrangement(calendar.sport, creator, 'Зал', shift, [18, 0], [19, 30]),
      arrangement(calendar.sport, creator, 'Пробіжка та кава', shift + 5, [9, 0], [10, 30]),
    ];
  });
}

async function seed() {
  await removeDemoData();
  const { asia, maksym, olia } = await createUsers();

  const main = await Calendar.findOne({ owner: asia._id, isMain: true });
  const [study, work, sport] = await Calendar.create([
    {
      name: 'Навчання',
      description: 'Лекції, практики, дедлайни',
      color: 'purple',
      owner: asia._id,
      members: [{ user: asia._id, role: 'owner' }],
    },
    {
      name: 'Робота',
      description: 'Команда Chronos: стендапи, рев’ю, демо',
      color: 'orange',
      owner: asia._id,
      members: [
        { user: asia._id, role: 'owner', color: 'blue' },
        { user: maksym._id, role: 'editor', color: 'purple' },
        { user: olia._id, role: 'viewer', color: 'green' },
      ],
    },
    {
      name: 'Спорт',
      description: 'Зал, пробіжки',
      color: 'green',
      owner: asia._id,
      members: [{ user: asia._id, role: 'owner' }],
    },
  ]);
  const calendars = { main, study, work, sport };

  const team = [participant(maksym, 'accepted'), participant(olia, 'pending')];

  const events = await Event.create([
    ...recurring(calendars, asia, [-4, -3, -2, -1, 0, 1, 2, 3, 4]),

    reminder(main, asia, 'Сплатити інтернет', 1, [14, 0]),
    arrangement(work, maksym, 'Code review', 1, [16, 0], [17, 0]),

    arrangement(work, maksym, 'Синк з дизайном', 2, [10, 0], [11, 0]),
    arrangement(main, asia, 'Обід з Олею', 2, [13, 0], [14, 0]),
    reminder(main, asia, 'Подзвонити бабусі', 2, [19, 0]),

    arrangement(work, asia, 'Дзвінок з ментором', 3, [11, 0], [12, 0], {
      location: 'meet.google.com/abc-defg-hij',
      description:
        'Обговорити архітектуру Chronos і Docker-збірку перед демо. Підготувати схему БД і питання щодо нотифікацій.',
      participants: team,
    }),
    arrangement(work, asia, 'Стендап + демо', 3, [13, 0], [14, 30], {
      location: 'офіс, кімната 3',
      description: 'Показати демо Chronos команді, зібрати фідбек',
      participants: team,
    }),
    arrangement(study, asia, 'Робота над Chronos', 3, [14, 30], [16, 0], {
      description: 'Docker-збірка і README зі скріншотами',
    }),
    task(study, asia, 'Написати тести для /events', { startAt: at(3, 17, 0), priority: 'high' }),
    arrangement(sport, asia, 'Зал', 3, [18, 30], [20, 0]),

    arrangement(sport, asia, 'Пробіжка', 4, [8, 30], [9, 30]),
    task(main, asia, 'Купити квитки на потяг', { startAt: at(4, 12, 0) }),
    arrangement(work, maksym, 'Планування спринту', 4, [15, 0], [16, 0]),
    arrangement(study, asia, 'Воркшоп: Docker', 4, [17, 0], [18, 0]),
    reminder(main, asia, 'Купити квитки', 4, [19, 30]),

    arrangement(main, asia, 'Кіно з друзями', 5, [19, 0], [20, 0]),

    task(study, asia, 'Дедлайн: здати Chronos', { startAt: at(6), allDay: true, priority: 'high' }),
    arrangement(main, asia, 'Планування тижня', 6, [17, 0], [18, 0]),

    task(work, asia, 'Підготувати демо Chronos', { startAt: at(3, 12, 30), priority: 'high' }),
    task(study, asia, 'Підключити API свят'),
    task(study, asia, 'Email-запрошення на події'),
    task(main, asia, 'Пост у LinkedIn про Chronos', { priority: 'low' }),
    task(study, asia, 'Оновити README', {
      startAt: at(1, 18, 0),
      isCompleted: true,
      completedAt: at(1, 18, 0),
    }),
    task(study, asia, 'Налаштувати docker-compose', {
      startAt: at(0, 20, 0),
      isCompleted: true,
      completedAt: at(0, 20, 0),
    }),
  ]);

  const retro = await Event.create(
    arrangement(work, maksym, 'Ретро спринту', 7, [15, 0], [16, 0], {
      location: 'meet.google.com/retro-chronos',
      description: 'Що пішло добре, що покращити, план на наступний спринт. Підготуй 2–3 пункти.',
      participants: [participant(asia, 'pending'), participant(olia, 'accepted')],
    }),
  );

  await Invite.create([
    {
      kind: 'event',
      email: asia.email,
      token: randomToken(),
      invitedBy: maksym._id,
      event: retro._id,
    },
    {
      kind: 'calendar',
      email: 'denys@chronos.demo',
      token: randomToken(),
      invitedBy: asia._id,
      calendar: work._id,
      role: 'viewer',
      expiresAt: new Date(Date.now() + 7 * DAY_MS),
    },
  ]);

  return { users: DEMO_USERS.length, calendars: 4, events: events.length + 1 };
}

async function run() {
  if (env.isProduction && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error(
      'Seed у production вимкнено. Задай SEED_ALLOW_PRODUCTION=true, якщо це демо-стенд.',
    );
  }

  await connectDb();
  const summary = await seed();
  console.log(
    `Демо-дані створено: ${summary.users} користувачі, ${summary.calendars} календарі, ${summary.events} подій.`,
  );
  console.log(`Вхід: ${DEMO_USERS.map((user) => user.email).join(', ')}`);
  console.log('Пароль: значення SEED_PASSWORD або типовий із README.');
}

run()
  .catch((err) => {
    console.error('Не вдалося створити демо-дані:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await disconnectDb();
  });
