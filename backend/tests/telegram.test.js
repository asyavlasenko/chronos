import zlib from 'node:zlib';
import request from 'supertest';
import app from '../src/app.js';
import Event from '../src/modules/events/event.model.js';
import { sendDueReminders } from '../src/modules/events/reminder.service.js';
import bot from '../src/modules/telegram/telegram.bot.js';
import {
  completeTask,
  connectChat,
  disconnectChat,
  handleWidgetQuery,
  sendSnoozedReminders,
  showAgenda,
  snoozeReminder,
} from '../src/modules/telegram/telegram.service.js';
import TelegramSnooze from '../src/modules/telegram/telegram.snooze.model.js';
import User from '../src/modules/users/user.model.js';
import { AGENDA_WIDGET_HTML } from '../src/modules/telegram/telegram.widget.js';
import { outbox } from '../src/utils/mailer.js';
import { clearDb, connectTestDb, disconnectTestDb } from './helpers/db.js';
import { createUser, getMainCalendar } from './helpers/factories.js';

const MINUTE_MS = 60 * 1000;
const NOW = new Date('2026-11-16T10:00:00.000Z');
const CHAT_ID = 5550001;
const BOT_USERNAME = 'chronos_test_bot';

const original = { ...bot };
const sent = [];
const blocked = new Error('Forbidden: bot was blocked by the user');

const minutesFromNow = (minutes) => new Date(NOW.getTime() + minutes * MINUTE_MS);

const tokenOf = (url) => new URL(url).searchParams.get('start');

const getStatus = (account) => request(app).get('/api/telegram').set(account.headers);

const postLink = (account) => request(app).post('/api/telegram/link').set(account.headers);

async function connect(account, chatId = CHAT_ID, username = 'asia') {
  const link = await postLink(account);
  return connectChat({ chatId, username, args: tokenOf(link.body.url) });
}

async function createEvent(account, overrides = {}) {
  const calendar = await getMainCalendar(account.user._id);
  return Event.create({
    title: 'Стендап',
    type: 'arrangement',
    calendar: calendar.id,
    creator: account.user._id,
    startAt: minutesFromNow(10),
    endAt: minutesFromNow(40),
    ...overrides,
  });
}

beforeAll(() => connectTestDb('telegram'));

beforeEach(() => {
  sent.length = 0;
  outbox.length = 0;
  bot.isEnabled = () => true;
  bot.isBlocked = (err) => err === blocked;
  bot.getUsername = async () => BOT_USERNAME;
  bot.send = async (chatId, text, options = {}) => {
    sent.push({ chatId, text, buttons: options.buttons });
  };
});

afterEach(() => clearDb());

afterAll(async () => {
  Object.assign(bot, original);
  await disconnectTestDb();
});

describe('GET /api/telegram', () => {
  it('показує, чи налаштований бот і чи підключений чат', async () => {
    const me = await createUser();

    const before = await getStatus(me);
    await connect(me);
    const after = await getStatus(me);
    bot.isEnabled = () => false;
    const disabled = await getStatus(me);
    const anonymous = await request(app).get('/api/telegram');

    expect(before.body).toEqual({
      enabled: true,
      botUsername: BOT_USERNAME,
      isConnected: false,
      username: null,
    });
    expect(after.body).toEqual({
      enabled: true,
      botUsername: BOT_USERNAME,
      isConnected: true,
      username: 'asia',
    });
    expect(disabled.body).toEqual({
      enabled: false,
      botUsername: null,
      isConnected: false,
      username: null,
    });
    expect(anonymous.status).toBe(401);
  });

  it('відповідає 502, коли Telegram недоступний', async () => {
    const me = await createUser();
    bot.getUsername = async () => {
      throw new Error('fetch failed');
    };

    const res = await getStatus(me);

    expect(res.status).toBe(502);
    expect(res.body.message).toBe('Telegram зараз недоступний. Спробуй пізніше');
  });
});

describe('POST /api/telegram/link', () => {
  it('видає одноразове посилання на бота і не зберігає код у відкритому вигляді', async () => {
    const me = await createUser();

    const res = await postLink(me);
    const token = tokenOf(res.body.url);
    const saved = await User.findById(me.user._id).select('+telegram.linkToken');

    expect(res.status).toBe(201);
    expect(res.body.url).toBe(`https://t.me/${BOT_USERNAME}?start=${token}`);
    expect(token).toMatch(/^[a-f0-9]{32}$/);
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(saved.telegram.linkToken).not.toBe(token);
    expect(saved.telegram.linkToken).toHaveLength(64);
  });

  it('відповідає 503, якщо бот не налаштований', async () => {
    const me = await createUser();
    bot.isEnabled = () => false;

    const res = await postLink(me);

    expect(res.status).toBe(503);
  });
});

describe('команди бота', () => {
  it('/start з кодом підключає чат, а той самий код удруге не працює', async () => {
    const me = await createUser({ name: 'Анастасія' });
    const link = await postLink(me);
    const args = tokenOf(link.body.url);

    const first = await connectChat({ chatId: CHAT_ID, username: 'asia', args });
    const second = await connectChat({ chatId: 777, username: 'other', args });
    const saved = await User.findById(me.user._id);

    expect(first).toContain('Готово, <b>Анастасія</b>!');
    expect(second).toContain('Посилання застаріло');
    expect(saved.telegram.chatId).toBe(CHAT_ID);
    expect(saved.telegram.username).toBe('asia');
    expect(saved.toJSON().telegram).toBeUndefined();
  });

  it('/start без коду, з чужим або простроченим кодом нічого не підключає', async () => {
    const me = await createUser();
    const link = await postLink(me);
    const args = tokenOf(link.body.url);
    const afterExpiry = new Date(new Date(link.body.expiresAt).getTime() + MINUTE_MS);

    const empty = await connectChat({ chatId: CHAT_ID, username: null, args: '' });
    const unknown = await connectChat({ chatId: CHAT_ID, username: null, args: 'a'.repeat(32) });
    const expired = await connectChat({ chatId: CHAT_ID, username: null, args }, afterExpiry);
    const saved = await User.findById(me.user._id);

    expect(empty).toContain('/today — події на сьогодні');
    expect(unknown).toContain('Посилання застаріло');
    expect(expired).toContain('Посилання застаріло');
    expect(saved.telegram?.chatId).toBeUndefined();
  });

  it('один чат належить лише одному акаунту', async () => {
    const first = await createUser();
    const second = await createUser();

    await connect(first);
    await connect(second);
    const [savedFirst, savedSecond] = await Promise.all([
      User.findById(first.user._id),
      User.findById(second.user._id),
    ]);

    expect(savedFirst.telegram?.chatId).toBeUndefined();
    expect(savedSecond.telegram.chatId).toBe(CHAT_ID);
  });

  it('/stop відключає чат', async () => {
    const me = await createUser();
    await connect(me);

    const first = await disconnectChat({ chatId: CHAT_ID });
    const second = await disconnectChat({ chatId: CHAT_ID });
    const status = await getStatus(me);

    expect(first).toContain('Нагадування вимкнено');
    expect(second).toContain('не підключений');
    expect(status.body.isConnected).toBe(false);
  });
});

describe('DELETE /api/telegram/link', () => {
  it('відключає Telegram від акаунта', async () => {
    const me = await createUser();
    await connect(me);

    const res = await request(app).delete('/api/telegram/link').set(me.headers);
    const status = await getStatus(me);

    expect(res.status).toBe(204);
    expect(status.body.isConnected).toBe(false);
  });
});

describe('POST /api/telegram/test', () => {
  it('надсилає тестове повідомлення в підключений чат', async () => {
    const me = await createUser();
    const stranger = await createUser();
    await connect(me);

    const ok = await request(app).post('/api/telegram/test').set(me.headers);
    const notConnected = await request(app).post('/api/telegram/test').set(stranger.headers);

    expect(ok.status).toBe(204);
    expect(notConnected.status).toBe(409);
    expect(sent).toHaveLength(1);
    expect(sent[0].chatId).toBe(CHAT_ID);
    expect(sent[0].text).toContain('Тестове повідомлення');
  });

  it('відключає чат, якщо користувач заблокував бота', async () => {
    const me = await createUser();
    await connect(me);
    bot.send = async () => {
      throw blocked;
    };

    const res = await request(app).post('/api/telegram/test').set(me.headers);
    const status = await getStatus(me);

    expect(res.status).toBe(409);
    expect(status.body.isConnected).toBe(false);
  });
});

describe('нагадування в Telegram', () => {
  it('приходить разом із листом, коли чат підключений', async () => {
    const me = await createUser();
    await connect(me);
    const event = await createEvent(me, { location: 'Zoom' });

    const count = await sendDueReminders(NOW);
    const repeated = await sendDueReminders(minutesFromNow(1));

    expect(count).toBe(2);
    expect(repeated).toBe(0);
    expect(outbox).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].chatId).toBe(CHAT_ID);
    expect(sent[0].text).toContain('<b>Нагадування: «Стендап»</b> через 10 хв');
    expect(sent[0].text).toContain('Зустріч · понеділок, 16 листопада');
    expect(sent[0].text).toContain('Місце: Zoom');
    expect(sent[0].text).toContain(`/calendar/day?date=2026-11-16&amp;event=${event.id}`);
    expect(sent[0].buttons).toEqual([
      [{ text: 'Відкласти на 10 хв', action: 'snooze', id: event.id }],
    ]);
  });

  it('екранує HTML у назві й місці, а задачі додає кнопку «Виконано»', async () => {
    const me = await createUser();
    await connect(me);
    const task = await createEvent(me, {
      title: '<b>Звіт</b> & план',
      type: 'task',
      endAt: null,
      location: 'каб. <3>',
    });

    await sendDueReminders(NOW);

    expect(sent[0].text).toContain('«&lt;b&gt;Звіт&lt;/b&gt; &amp; план»');
    expect(sent[0].text).toContain('Місце: каб. &lt;3&gt;');
    expect(sent[0].text).toContain('Задача · ');
    expect(sent[0].buttons[0]).toEqual([
      { text: 'Виконано', action: 'done', id: task.id },
      { text: 'Відкласти на 10 хв', action: 'snooze', id: task.id },
    ]);
  });

  it('приходить і тоді, коли листи вимкнені', async () => {
    const me = await createUser();
    await connect(me);
    await User.updateOne({ _id: me.user._id }, { 'notifications.emailReminders': false });
    await createEvent(me);

    const count = await sendDueReminders(NOW);

    expect(count).toBe(1);
    expect(outbox).toHaveLength(0);
    expect(sent).toHaveLength(1);
  });

  it('не надсилається без підключеного чату або без токена бота', async () => {
    const withoutChat = await createUser();
    const withChat = await createUser();
    await connect(withChat);
    await createEvent(withoutChat);
    await createEvent(withChat);
    bot.isEnabled = () => false;

    const count = await sendDueReminders(NOW);

    expect(count).toBe(2);
    expect(outbox).toHaveLength(2);
    expect(sent).toHaveLength(0);
  });

  it('помилка Telegram не заважає листу, а заблокований бот відключається', async () => {
    const me = await createUser();
    await connect(me);
    await createEvent(me);
    bot.send = async () => {
      throw blocked;
    };
    const logged = [];
    const logError = console.error;
    console.error = (message) => logged.push(message);

    const count = await sendDueReminders(NOW);
    console.error = logError;
    const saved = await User.findById(me.user._id);

    expect(count).toBe(1);
    expect(logged).toEqual([
      '[reminders] Не вдалося надіслати нагадування: Forbidden: bot was blocked by the user',
    ]);
    expect(outbox).toHaveLength(1);
    expect(saved.telegram?.chatId).toBeUndefined();
  });
});

describe('кнопки під нагадуванням', () => {
  it('«Відкласти» нагадує ще раз через 10 хвилин і лише один раз', async () => {
    const me = await createUser();
    await connect(me);
    const event = await createEvent(me);

    const pressed = await snoozeReminder({ chatId: CHAT_ID, id: event.id }, NOW);
    await snoozeReminder({ chatId: CHAT_ID, id: event.id }, NOW);
    const early = await sendSnoozedReminders(minutesFromNow(9));
    const onTime = await sendSnoozedReminders(minutesFromNow(10));
    const again = await sendSnoozedReminders(minutesFromNow(11));

    expect(pressed).toEqual({ text: 'Нагадаю ще раз о 12:10', isHandled: true });
    expect(early).toBe(0);
    expect(onTime).toBe(1);
    expect(again).toBe(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain('<b>Нагадування: «Стендап»</b> уже зараз');
    expect(await TelegramSnooze.countDocuments()).toBe(0);
  });

  it('відкладене нагадування не приходить, якщо задачу вже виконано або чат відключено', async () => {
    const me = await createUser();
    const other = await createUser();
    await connect(me);
    await connect(other, 777, 'other');
    const task = await createEvent(me, { type: 'task', endAt: null });
    const meeting = await createEvent(other);

    await snoozeReminder({ chatId: CHAT_ID, id: task.id }, NOW);
    await snoozeReminder({ chatId: 777, id: meeting.id }, NOW);
    await Event.updateOne({ _id: task._id }, { isCompleted: true });
    await disconnectChat({ chatId: 777 });
    const count = await sendSnoozedReminders(minutesFromNow(10));

    expect(count).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('«Виконано» позначає задачу виконаною і знімає відкладене нагадування', async () => {
    const me = await createUser();
    await connect(me);
    const task = await createEvent(me, { type: 'task', endAt: null });
    await snoozeReminder({ chatId: CHAT_ID, id: task.id }, NOW);

    const pressed = await completeTask({ chatId: CHAT_ID, id: task.id });
    const saved = await Event.findById(task.id);

    expect(pressed).toEqual({ text: 'Задачу виконано', isHandled: true });
    expect(saved.isCompleted).toBe(true);
    expect(saved.completedAt).toBeInstanceOf(Date);
    expect(await TelegramSnooze.countDocuments()).toBe(0);
  });

  it('кнопки не діють на чужі, неіснуючі події й на зустрічі', async () => {
    const me = await createUser();
    const stranger = await createUser();
    await connect(me);
    const foreignTask = await createEvent(stranger, { type: 'task', endAt: null });
    const meeting = await createEvent(me);

    const foreign = await completeTask({ chatId: CHAT_ID, id: foreignTask.id });
    const notTask = await completeTask({ chatId: CHAT_ID, id: meeting.id });
    const broken = await snoozeReminder({ chatId: CHAT_ID, id: 'not-an-id' }, NOW);
    const unknownChat = await snoozeReminder({ chatId: 999, id: meeting.id }, NOW);
    const saved = await Event.findById(foreignTask.id);

    expect(foreign.isHandled).toBe(false);
    expect(notTask.text).toBe('Цієї події вже немає або вона недоступна');
    expect(broken.text).toBe('Цієї події вже немає або вона недоступна');
    expect(unknownChat.text).toBe('Цієї події вже немає або вона недоступна');
    expect(saved.isCompleted).toBe(false);
    expect(await TelegramSnooze.countDocuments()).toBe(0);
  });
});

describe('команди /today і /tomorrow', () => {
  it('показують події дня в часовому поясі користувача', async () => {
    const me = await createUser();
    await connect(me);
    await createEvent(me, {
      title: 'Стендап',
      startAt: new Date('2026-11-16T08:00:00.000Z'),
      endAt: new Date('2026-11-16T08:30:00.000Z'),
    });
    await createEvent(me, {
      title: 'Здати <звіт>',
      type: 'task',
      startAt: new Date('2026-11-16T16:00:00.000Z'),
      endAt: null,
      isCompleted: true,
    });
    await createEvent(me, {
      title: 'Пізня зустріч',
      startAt: new Date('2026-11-16T22:30:00.000Z'),
      endAt: new Date('2026-11-16T23:00:00.000Z'),
    });

    const today = await showAgenda({ chatId: CHAT_ID }, 'today', NOW);
    const tomorrow = await showAgenda({ chatId: CHAT_ID }, 'tomorrow', NOW);

    expect(today.text).toBe(
      [
        '<b>Сьогодні · понеділок, 16 листопада</b>',
        '',
        '<b>10:00–10:30</b>  Стендап',
        '<b>до 18:00</b>  <s>Здати &lt;звіт&gt;</s> · задача',
      ].join('\n'),
    );
    expect(tomorrow.text).toBe(
      ['<b>Завтра · вівторок, 17 листопада</b>', '', '<b>00:30–01:00</b>  Пізня зустріч'].join(
        '\n',
      ),
    );
  });

  it('кажуть, що подій немає або що чат не підключено', async () => {
    const me = await createUser();
    await connect(me);

    const empty = await showAgenda({ chatId: CHAT_ID }, 'today', NOW);
    const stranger = await showAgenda({ chatId: 999 }, 'today', NOW);

    expect(empty.text).toBe('<b>Сьогодні · понеділок, 16 листопада</b>\n\nПодій немає.');
    expect(JSON.parse(empty.widget.chatData)).toEqual({
      d: 't',
      h: 'понеділок, 16 листопада',
      e: [],
      m: 0,
    });
    expect(stranger).toContain('Цей чат не підключений');
  });
});

describe('віджет розкладу', () => {
  const stateOf = (text) => JSON.parse(text);

  it('HTML вкладається в обмеження Telegram', () => {
    expect(Buffer.byteLength(AGENDA_WIDGET_HTML)).toBeLessThanOrEqual(32768);
    expect(zlib.deflateSync(AGENDA_WIDGET_HTML, { level: 9 }).length).toBeLessThanOrEqual(4096);
    expect(AGENDA_WIDGET_HTML).not.toContain('\u0000');
  });

  it('/today повертає віджет зі станом дня і текст на випадок, якщо віджет не надішлеться', async () => {
    const me = await createUser();
    await connect(me);
    await createEvent(me, {
      title: 'Стендап',
      startAt: new Date('2026-11-16T08:00:00.000Z'),
      endAt: new Date('2026-11-16T08:30:00.000Z'),
    });
    await createEvent(me, {
      title: 'Подзвонити',
      type: 'reminder',
      startAt: new Date('2026-11-16T12:00:00.000Z'),
      endAt: null,
    });
    const task = await createEvent(me, {
      title: 'Здати "звіт"',
      type: 'task',
      startAt: new Date('2026-11-16T16:00:00.000Z'),
      endAt: null,
    });

    const reply = await showAgenda({ chatId: CHAT_ID }, 'today', NOW);

    expect(reply.text).toContain('<b>10:00–10:30</b>  Стендап');
    expect(reply.widget.html).toBe(AGENDA_WIDGET_HTML);
    expect(reply.widget.caption).toBe('Розклад із Chronos');
    expect(stateOf(reply.widget.chatData)).toEqual({
      d: 't',
      h: 'понеділок, 16 листопада',
      e: [
        ['10:00–10:30', 'Стендап', 'a'],
        ['14:00', 'Подзвонити', 'r'],
        ['до 18:00', 'Здати "звіт"', 't', task.id, 0],
      ],
      m: 0,
    });
  });

  it('стан не перевищує 1024 байти: довгі назви обрізаються, зайві події рахуються в «ще»', async () => {
    const me = await createUser();
    await connect(me);
    const calendar = await getMainCalendar(me.user._id);
    await Event.insertMany(
      Array.from({ length: 30 }, (unused, index) => ({
        title: `Дуже довга назва події номер ${index} з подробицями, які не влізуть у рядок`,
        type: 'arrangement',
        calendar: calendar.id,
        creator: me.user._id,
        startAt: new Date(Date.UTC(2026, 10, 16, 6, index)),
        endAt: new Date(Date.UTC(2026, 10, 16, 7, index)),
      })),
    );

    const reply = await showAgenda({ chatId: CHAT_ID }, 'today', NOW);
    const state = stateOf(reply.widget.chatData);

    expect(Buffer.byteLength(reply.widget.chatData)).toBeLessThanOrEqual(1024);
    expect(state.e.length).toBeGreaterThan(3);
    expect(state.e.length + state.m).toBe(30);
    expect(state.e[0][1]).toHaveLength(40);
    expect(state.e[0][1].endsWith('…')).toBe(true);
  });

  it('запит «done» перемикає задачу туди й назад і повертає новий стан', async () => {
    const me = await createUser();
    await connect(me);
    const task = await createEvent(me, {
      type: 'task',
      startAt: new Date('2026-11-16T16:00:00.000Z'),
      endAt: null,
    });

    const checked = await handleWidgetQuery({ chatId: CHAT_ID, data: `done:t:${task.id}` }, NOW);
    const afterCheck = await Event.findById(task.id);
    const unchecked = await handleWidgetQuery({ chatId: CHAT_ID, data: `done:t:${task.id}` }, NOW);
    const afterUncheck = await Event.findById(task.id);

    expect(stateOf(checked).e[0]).toEqual(['до 18:00', 'Стендап', 't', task.id, 1]);
    expect(afterCheck.isCompleted).toBe(true);
    expect(stateOf(unchecked).e[0][4]).toBe(0);
    expect(afterUncheck.isCompleted).toBe(false);
  });

  it('запити «day» і «ref» показують потрібний день, а чужі задачі не змінюються', async () => {
    const me = await createUser();
    const stranger = await createUser();
    await connect(me);
    await createEvent(me, {
      title: 'Завтрашня',
      startAt: new Date('2026-11-17T08:00:00.000Z'),
      endAt: new Date('2026-11-17T09:00:00.000Z'),
    });
    const foreign = await createEvent(stranger, {
      type: 'task',
      startAt: new Date('2026-11-16T16:00:00.000Z'),
      endAt: null,
    });

    const tomorrow = await handleWidgetQuery({ chatId: CHAT_ID, data: 'day:m' }, NOW);
    const refreshed = await handleWidgetQuery({ chatId: CHAT_ID, data: 'ref:t' }, NOW);
    const hacked = await handleWidgetQuery({ chatId: CHAT_ID, data: `done:t:${foreign.id}` }, NOW);
    const saved = await Event.findById(foreign.id);

    expect(stateOf(tomorrow)).toEqual({
      d: 'm',
      h: 'вівторок, 17 листопада',
      e: [['10:00–11:00', 'Завтрашня', 'a']],
      m: 0,
    });
    expect(stateOf(refreshed).e).toEqual([]);
    expect(stateOf(hacked).e).toEqual([]);
    expect(saved.isCompleted).toBe(false);
  });

  it('запит із непідключеного чату або з невідомим днем лишається без відповіді', async () => {
    const me = await createUser();
    await connect(me);

    const stranger = await handleWidgetQuery({ chatId: 999, data: 'ref:t' }, NOW);
    const badDay = await handleWidgetQuery({ chatId: CHAT_ID, data: 'ref:x' }, NOW);
    const garbage = await handleWidgetQuery({ chatId: CHAT_ID, data: 'whatever' }, NOW);

    expect(stranger).toBeNull();
    expect(badDay).toBeNull();
    expect(garbage).toBeNull();
  });
});
