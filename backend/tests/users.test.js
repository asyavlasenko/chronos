import request from 'supertest';
import app from '../src/app.js';
import User from '../src/modules/users/user.model.js';
import { clearDb, connectTestDb, disconnectTestDb } from './helpers/db.js';
import { createUser } from './helpers/factories.js';

const NEW_PASSWORD = 'new-secret-456';

const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

const refreshCookieOf = (res) =>
  (res.headers['set-cookie'] || []).find((cookie) => cookie.startsWith('refreshToken='));

const refreshWith = (cookie) =>
  request(app).post('/api/auth/refresh').set('Cookie', cookie.split(';')[0]);

beforeAll(() => connectTestDb('users'));

afterEach(() => clearDb());

afterAll(() => disconnectTestDb());

describe('GET /api/users/me', () => {
  it('повертає профіль поточного користувача без секретних полів', async () => {
    const { user, headers } = await createUser({ name: 'Анастасія' });

    const res = await request(app).get('/api/users/me').set(headers);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: user.id,
      email: user.email,
      name: 'Анастасія',
      country: 'UA',
      timezone: 'Europe/Kyiv',
      defaultArrangementDuration: 60,
      weekStartsOn: 1,
      timeFormat: '24h',
      showWeekNumbers: true,
      showHolidays: true,
      notifications: { emailReminders: true, push: false, sharedCalendarEmails: true },
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.passwordResetToken).toBeUndefined();
  });

  it('відповідає 401 без токена', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/users/me', () => {
  it('оновлює налаштування профілю', async () => {
    const { user, headers } = await createUser();
    const changes = {
      name: '  Ася Власенко  ',
      avatarUrl: 'https://cdn.example.com/avatars/asia.png',
      country: 'pl',
      timezone: 'Europe/Warsaw',
      defaultArrangementDuration: 45,
      weekStartsOn: 0,
      timeFormat: '12h',
      showWeekNumbers: false,
      showHolidays: false,
    };

    const res = await request(app).patch('/api/users/me').set(headers).send(changes);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      ...changes,
      name: 'Ася Власенко',
      country: 'PL',
      email: user.email,
    });

    const saved = await User.findById(user.id);
    expect(saved.country).toBe('PL');
    expect(saved.defaultArrangementDuration).toBe(45);
    expect(saved.weekStartsOn).toBe(0);
  });

  it('оновлює notifications частково і не затирає невказані ключі', async () => {
    const { headers } = await createUser();

    const first = await request(app)
      .patch('/api/users/me')
      .set(headers)
      .send({ notifications: { push: true } });
    const second = await request(app)
      .patch('/api/users/me')
      .set(headers)
      .send({ notifications: { emailReminders: false } });

    expect(first.status).toBe(200);
    expect(first.body.user.notifications).toEqual({
      emailReminders: true,
      push: true,
      sharedCalendarEmails: true,
    });
    expect(second.body.user.notifications).toEqual({
      emailReminders: false,
      push: true,
      sharedCalendarEmails: true,
    });
  });

  it('дозволяє скинути аватар у null', async () => {
    const { headers } = await createUser();
    await request(app)
      .patch('/api/users/me')
      .set(headers)
      .send({ avatarUrl: 'https://cdn.example.com/a.png' });

    const res = await request(app).patch('/api/users/me').set(headers).send({ avatarUrl: null });

    expect(res.status).toBe(200);
    expect(res.body.user.avatarUrl).toBeNull();
  });

  it('не дає змінити email, пароль і службові поля', async () => {
    const { user, headers, password } = await createUser();

    const mixed = await request(app).patch('/api/users/me').set(headers).send({
      name: 'Нове імʼя',
      email: 'hacker@mail.com',
      password: 'another-secret',
      passwordHash: 'plain',
      tokenVersion: 99,
      isEmailVerified: true,
    });
    const onlyForbidden = await request(app)
      .patch('/api/users/me')
      .set(headers)
      .send({ email: 'hacker@mail.com' });

    expect(mixed.status).toBe(200);
    expect(mixed.body.user.email).toBe(user.email);
    expect(mixed.body.user.isEmailVerified).toBe(false);
    expect(onlyForbidden.status).toBe(400);

    const saved = await User.findById(user.id);
    expect(saved.email).toBe(user.email);
    expect(saved.tokenVersion).toBe(0);
    expect((await login(user.email, password)).status).toBe(200);
  });

  it('повертає 400 з помилками по полях українською', async () => {
    const { headers } = await createUser();

    const res = await request(app)
      .patch('/api/users/me')
      .set(headers)
      .send({
        name: 'A',
        avatarUrl: 'not a link',
        country: 'UKR',
        timezone: 'Mars/Olympus',
        defaultArrangementDuration: 3,
        weekStartsOn: 5,
        timeFormat: '36h',
        showWeekNumbers: 'так',
        notifications: { push: 'так' },
      });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field).sort()).toEqual([
      'avatarUrl',
      'country',
      'defaultArrangementDuration',
      'name',
      'notifications.push',
      'showWeekNumbers',
      'timeFormat',
      'timezone',
      'weekStartsOn',
    ]);
    res.body.details.forEach((d) => expect(d.message).toMatch(/[а-яіїєґ]/i));
    res.body.details.forEach((d) => expect(d.message).not.toMatch(/must|valid|required/));
  });

  it('відхиляє дробову тривалість і значення поза межами 5..480', async () => {
    const { headers } = await createUser();
    const send = (value) =>
      request(app).patch('/api/users/me').set(headers).send({ defaultArrangementDuration: value });

    expect((await send(30.5)).status).toBe(400);
    expect((await send(481)).status).toBe(400);
    expect((await send(5)).status).toBe(200);
    expect((await send(480)).status).toBe(200);
  });

  it('повертає 400 для порожнього тіла', async () => {
    const { headers } = await createUser();
    const res = await request(app).patch('/api/users/me').set(headers).send({});
    expect(res.status).toBe(400);
  });

  it('відповідає 401 без токена', async () => {
    const res = await request(app).patch('/api/users/me').send({ name: 'Хтось' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/users/me/password', () => {
  it('змінює пароль, видає нову пару токенів і ставить нову cookie', async () => {
    const { user, headers, password } = await createUser();

    const res = await request(app)
      .post('/api/users/me/password')
      .set(headers)
      .send({ currentPassword: password, newPassword: NEW_PASSWORD });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['accessToken']);
    expect(typeof res.body.accessToken).toBe('string');
    expect(refreshCookieOf(res)).toMatch(/^refreshToken=.+HttpOnly/);
    expect(refreshCookieOf(res)).toMatch(/Path=\/api\/auth/);

    const saved = await User.findById(user.id).select('+passwordHash');
    expect(saved.tokenVersion).toBe(1);
    expect(saved.passwordHash).not.toBe(NEW_PASSWORD);
    expect(saved.passwordHash).toMatch(/^\$2[aby]\$/);

    expect((await login(user.email, password)).status).toBe(401);
    expect((await login(user.email, NEW_PASSWORD)).status).toBe(200);
  });

  it('старі токени перестають діяти, а нові працюють', async () => {
    const { user, headers, password } = await createUser();
    const otherDevice = await login(user.email, password);
    const otherDeviceCookie = refreshCookieOf(otherDevice);

    const res = await request(app)
      .post('/api/users/me/password')
      .set(headers)
      .send({ currentPassword: password, newPassword: NEW_PASSWORD });

    const oldAccess = await request(app).get('/api/users/me').set(headers);
    const otherDeviceAccess = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${otherDevice.body.accessToken}`);
    const otherDeviceRefresh = await refreshWith(otherDeviceCookie);
    const newAccess = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`);
    const newRefresh = await refreshWith(refreshCookieOf(res));

    expect(oldAccess.status).toBe(401);
    expect(otherDeviceAccess.status).toBe(401);
    expect(otherDeviceRefresh.status).toBe(401);
    expect(newAccess.status).toBe(200);
    expect(newAccess.body.user.id).toBe(user.id);
    expect(newRefresh.status).toBe(200);
  });

  it('повертає 400 по полю currentPassword, якщо поточний пароль невірний', async () => {
    const { user, headers, password } = await createUser();

    const res = await request(app)
      .post('/api/users/me/password')
      .set(headers)
      .send({ currentPassword: 'wrong-password', newPassword: NEW_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { field: 'currentPassword', message: expect.stringMatching(/пароль/i) },
    ]);
    expect(refreshCookieOf(res)).toBeUndefined();

    expect((await login(user.email, password)).status).toBe(200);
    expect((await login(user.email, NEW_PASSWORD)).status).toBe(401);
    expect((await request(app).get('/api/users/me').set(headers)).status).toBe(200);
  });

  it('повертає 400 для закороткого нового пароля і відсутніх полів', async () => {
    const { headers, password } = await createUser();

    const short = await request(app)
      .post('/api/users/me/password')
      .set(headers)
      .send({ currentPassword: password, newPassword: '1234567' });
    const long = await request(app)
      .post('/api/users/me/password')
      .set(headers)
      .send({ currentPassword: password, newPassword: 'x'.repeat(129) });
    const empty = await request(app).post('/api/users/me/password').set(headers).send({});

    expect(short.status).toBe(400);
    expect(short.body.details.map((d) => d.field)).toEqual(['newPassword']);
    expect(long.status).toBe(400);
    expect(empty.status).toBe(400);
    expect(empty.body.details.map((d) => d.field).sort()).toEqual([
      'currentPassword',
      'newPassword',
    ]);
  });

  it('відповідає 401 без токена', async () => {
    const res = await request(app)
      .post('/api/users/me/password')
      .send({ currentPassword: 'secret123', newPassword: NEW_PASSWORD });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/users/me/logout-everywhere', () => {
  it('завершує всі сесії та очищає cookie', async () => {
    const { user, headers, password } = await createUser();
    const otherDevice = await login(user.email, password);
    const otherDeviceCookie = refreshCookieOf(otherDevice);

    const res = await request(app).post('/api/users/me/logout-everywhere').set(headers);

    expect(res.status).toBe(204);
    expect(refreshCookieOf(res)).toMatch(/^refreshToken=;/);
    expect((await User.findById(user.id)).tokenVersion).toBe(1);

    const oldAccess = await request(app).get('/api/users/me').set(headers);
    const otherDeviceAccess = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${otherDevice.body.accessToken}`);
    const otherDeviceRefresh = await refreshWith(otherDeviceCookie);

    expect(oldAccess.status).toBe(401);
    expect(otherDeviceAccess.status).toBe(401);
    expect(otherDeviceRefresh.status).toBe(401);
    expect((await login(user.email, password)).status).toBe(200);
  });

  it('не чіпає сесії інших користувачів', async () => {
    const me = await createUser();
    const other = await createUser();

    await request(app).post('/api/users/me/logout-everywhere').set(me.headers);

    const res = await request(app).get('/api/users/me').set(other.headers);
    expect(res.status).toBe(200);
  });

  it('відповідає 401 без токена', async () => {
    const res = await request(app).post('/api/users/me/logout-everywhere');
    expect(res.status).toBe(401);
  });
});
