import request from 'supertest';
import app from '../src/app.js';
import Event from '../src/modules/events/event.model.js';
import User from '../src/modules/users/user.model.js';
import { outbox } from '../src/utils/mailer.js';
import { connectTestDb, disconnectTestDb } from './helpers/db.js';
import { createUser, getMainCalendar } from './helpers/factories.js';

const MISSING_ID = '000000000000000000000000';
const START = '2026-11-16T10:00:00.000Z';
const HUGE = 'я'.repeat(200000);
const PARALLEL = 10;

const ctx = {};

const json = (req, raw) => req.set('Content-Type', 'application/json').send(raw);

const asOwner = (req) => req.set(ctx.owner.headers);

const times = (count, makeRequest) => Promise.all(Array.from({ length: count }, makeRequest));

const statuses = (responses) => responses.map((res) => res.status).sort();

const anonymous = [
  ['зіпсований JSON', () => json(request(app).post('/api/auth/login'), '{"email":'), 400],
  ['масив замість обʼєкта', () => request(app).post('/api/auth/login').send([1, 2, 3]), 400],
  ['рядок замість обʼєкта', () => json(request(app).post('/api/auth/login'), '"рядок"'), 400],
  [
    'тіло не у форматі JSON',
    () => request(app).post('/api/auth/login').set('Content-Type', 'text/plain').send('email=a'),
    400,
  ],
  [
    'оператори Mongo замість логіна й пароля',
    () =>
      request(app)
        .post('/api/auth/login')
        .send({ email: { $gt: '' }, password: { $ne: null } }),
    400,
  ],
  [
    'оператори Mongo в реєстрації',
    () =>
      request(app)
        .post('/api/auth/register')
        .send({ email: { $ne: 1 }, password: ['secret123'], name: { $regex: '.*' } }),
    400,
  ],
  [
    'імʼя на 200 тисяч символів',
    () =>
      request(app)
        .post('/api/auth/register')
        .send({ email: 'big@mail.com', password: 'secret123', name: HUGE }),
    400,
  ],
  [
    'тіло понад 1 МБ',
    () =>
      request(app)
        .post('/api/auth/login')
        .send({ email: 'a@mail.com', password: 'x'.repeat(1100000) }),
    413,
  ],
  [
    'сміття в refresh cookie',
    () => request(app).post('/api/auth/refresh').set('Cookie', 'refreshToken=not-a-token'),
    401,
  ],
  [
    'обʼєкт замість токена скидання пароля',
    () =>
      request(app)
        .post('/api/auth/password-reset/confirm')
        .send({ token: { $ne: '' }, password: 'secret123' }),
    400,
  ],
  [
    'підроблений токен доступу',
    () => request(app).get('/api/events').set('Authorization', 'Bearer a.b.c'),
    401,
  ],
  [
    'заголовок Authorization без Bearer',
    () => request(app).get('/api/users/me').set('Authorization', 'Basic YWRtaW46YWRtaW4='),
    401,
  ],
  ['зламане кодування в адресі', () => request(app).get('/api/invites/%E0%A4%A'), 400],
  ['неіснуючий маршрут', () => request(app).get('/api/nothing-here'), 404],
  ['непідтримуваний метод', () => request(app).put('/api/auth/login'), 404],
  ['вигаданий токен запрошення', () => request(app).get(`/api/invites/${'a'.repeat(64)}`), 404],
];

const authorized = [
  [
    'оператори в параметрах діапазону',
    () => asOwner(request(app).get('/api/events')).query('from[$gt]=1&to[$lt]=2'),
    400,
  ],
  [
    'повторені параметри запиту',
    () => asOwner(request(app).get('/api/events')).query('q=a&q=b&types=task&types=xxx'),
    400,
  ],
  [
    'діапазон у двісті років',
    () =>
      asOwner(request(app).get('/api/events')).query({
        from: '1900-01-01T00:00:00.000Z',
        to: '2100-01-01T00:00:00.000Z',
      }),
    400,
  ],
  [
    'спецсимволи регулярного виразу в пошуку',
    () => asOwner(request(app).get('/api/events')).query({ q: '((((.*+?^$[' }),
    200,
  ],
  ['некоректний id події', () => asOwner(request(app).get('/api/events/not-an-id')), 400],
  ['неіснуюча подія', () => asOwner(request(app).get(`/api/events/${MISSING_ID}`)), 404],
  [
    'оператор замість календаря',
    () =>
      asOwner(request(app).post('/api/events')).send({
        title: 'Подія',
        type: 'task',
        calendar: { $ne: null },
        startAt: START,
      }),
    400,
  ],
  [
    'неправильні типи полів події',
    () =>
      asOwner(request(app).post('/api/events')).send({
        title: 42,
        type: ['task'],
        calendar: ctx.calendar,
        startAt: 'завтра',
        participants: 'усі',
      }),
    400,
  ],
  [
    '__proto__ і constructor у тілі',
    () =>
      json(
        asOwner(request(app).post('/api/events')),
        '{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"isAdmin":true}}}',
      ),
    400,
  ],
  [
    '$set в оновленні події',
    () =>
      asOwner(request(app).patch(`/api/events/${ctx.eventId}`)).send({
        $set: { creator: MISSING_ID },
      }),
    400,
  ],
  [
    'масив в оновленні події',
    () => asOwner(request(app).patch(`/api/events/${ctx.eventId}`)).send([{ title: 'Нова' }]),
    400,
  ],
  [
    'рядок замість налаштувань сповіщень',
    () => asOwner(request(app).patch('/api/users/me')).send({ notifications: 'так' }),
    400,
  ],
  [
    'неіснуючий часовий пояс',
    () => asOwner(request(app).patch('/api/users/me')).send({ timezone: 'Mars/Phobos' }),
    400,
  ],
  [
    'оператор замість поточного пароля',
    () =>
      asOwner(request(app).post('/api/users/me/password')).send({
        currentPassword: { $ne: '' },
        newPassword: 'secret1234',
      }),
    400,
  ],
  [
    'масив замість назви календаря',
    () => asOwner(request(app).post('/api/calendars')).send({ name: ['a'], color: 'rainbow' }),
    400,
  ],
  [
    'масив у запрошенні в календар',
    () =>
      asOwner(request(app).post(`/api/calendars/${ctx.calendar}/share`)).send({
        email: ['a@mail.com'],
        role: 'god',
      }),
    400,
  ],
  [
    'некоректний id учасника',
    () =>
      asOwner(request(app).patch(`/api/calendars/${ctx.calendar}/members/1`)).send({
        role: 'editor',
      }),
    400,
  ],
  [
    'свята неіснуючої країни й року',
    () => asOwner(request(app).get('/api/holidays')).query({ country: '../etc', year: 99999 }),
    400,
  ],
  [
    'прийняття вигаданого запрошення',
    () => asOwner(request(app).post('/api/invites/zzz/accept')),
    404,
  ],
];

beforeAll(async () => {
  await connectTestDb('robustness');
  ctx.owner = await createUser();
  ctx.calendar = (await getMainCalendar(ctx.owner.user._id)).id;
  const event = await Event.create({
    title: 'Стендап',
    type: 'reminder',
    calendar: ctx.calendar,
    creator: ctx.owner.user._id,
    startAt: new Date(START),
  });
  ctx.eventId = event.id;
});

afterAll(() => disconnectTestDb());

describe('некоректні запити', () => {
  it.each(anonymous)('без входу: %s', async (name, send, expected) => {
    const res = await send();

    expect(res.status).toBe(expected);
    expect(res.body).toMatchObject({ status: 'error', message: expect.any(String) });
  });

  it.each(authorized)('після входу: %s', async (name, send, expected) => {
    const res = await send();

    expect(res.status).toBe(expected);
    if (expected >= 400) {
      expect(res.body).toMatchObject({ status: 'error', message: expect.any(String) });
    }
  });

  it('не дає видалити головний календар', async () => {
    const res = await asOwner(request(app).delete(`/api/calendars/${ctx.calendar}`));

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('ігнорує службові поля в тілі запиту', async () => {
    const res = await asOwner(request(app).patch(`/api/events/${ctx.eventId}`)).send({
      title: 'Стендап команди',
      creator: MISSING_ID,
      reminderSentAt: START,
      createdAt: '2000-01-01T00:00:00.000Z',
    });
    const saved = await Event.findById(ctx.eventId);

    expect(res.status).toBe(200);
    expect(saved.title).toBe('Стендап команди');
    expect(String(saved.creator)).toBe(ctx.owner.user.id);
    expect(saved.reminderSentAt).toBeNull();
    expect(saved.createdAt.getUTCFullYear()).not.toBe(2000);
  });
});

describe('одночасні запити', () => {
  it('реєструє лише один акаунт на email', async () => {
    const responses = await times(PARALLEL, () =>
      request(app)
        .post('/api/auth/register')
        .send({ email: 'race@mail.com', password: 'secret123', name: 'Гонка' }),
    );

    expect(statuses(responses)).toEqual([201, ...Array(PARALLEL - 1).fill(409)]);
    expect(await User.countDocuments({ email: 'race@mail.com' })).toBe(1);
  });

  it('витримує паралельні зміни однієї події', async () => {
    const lists = Array.from({ length: PARALLEL }, (unused, index) => [
      `guest${index}@mail.com`,
      `guest${index + 1}@mail.com`,
    ]);

    const responses = await Promise.all(
      lists.map((participants) =>
        asOwner(request(app).patch(`/api/events/${ctx.eventId}`)).send({ participants }),
      ),
    );
    const saved = await Event.findById(ctx.eventId);

    responses.forEach((res) => expect([200, 409]).toContain(res.status));
    expect(statuses(responses)).toContain(200);
    expect(saved.participants.length).toBeLessThanOrEqual(2);
    expect(new Set(saved.participants.map((item) => item.email)).size).toBe(
      saved.participants.length,
    );
    outbox.length = 0;
  });

  it('видаляє подію рівно один раз', async () => {
    const event = await Event.create({
      title: 'На видалення',
      type: 'reminder',
      calendar: ctx.calendar,
      creator: ctx.owner.user._id,
      startAt: new Date(START),
    });

    const responses = await times(PARALLEL, () =>
      asOwner(request(app).delete(`/api/events/${event.id}`)),
    );

    responses.forEach((res) => expect([204, 404]).toContain(res.status));
    expect(statuses(responses)).toContain(204);
    expect(await Event.findById(event.id)).toBeNull();
  });

  it('після всього відповідає на перевірку стану', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
