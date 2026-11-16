import express from 'express';
import request from 'supertest';
import app from '../src/app.js';
import auth from '../src/middlewares/auth.js';
import errorHandler from '../src/middlewares/errorHandler.js';
import Calendar from '../src/modules/calendars/calendar.model.js';
import User from '../src/modules/users/user.model.js';
import { outbox } from '../src/utils/mailer.js';
import { clearDb, connectTestDb, disconnectTestDb } from './helpers/db.js';

const valid = { email: 'asia@mail.com', password: 'secret123', name: 'Анастасія' };

const protectedApp = express();
protectedApp.get('/protected', auth, (req, res) => res.json({ id: req.user.id }));
protectedApp.use(errorHandler);

const resetTokenFromOutbox = () => /token=([0-9a-f]{64})/.exec(outbox[0].text)[1];

beforeAll(() => connectTestDb('auth'));

afterEach(async () => {
  await clearDb();
  outbox.length = 0;
});

afterAll(() => disconnectTestDb());

describe('POST /api/auth/register', () => {
  it('створює користувача, головний календар і видає токени', async () => {
    const res = await request(app).post('/api/auth/register').send(valid);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: valid.email, name: valid.name, country: 'UA' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.headers['set-cookie'][0]).toMatch(/^refreshToken=.+HttpOnly/);

    const calendars = await Calendar.find({ owner: res.body.user.id });
    expect(calendars).toHaveLength(1);
    expect(calendars[0].isMain).toBe(true);
    expect(calendars[0].members[0].role).toBe('owner');
  });

  it('не зберігає пароль у відкритому вигляді', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const user = await User.findOne({ email: valid.email }).select('+passwordHash');
    expect(user.passwordHash).not.toBe(valid.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('повертає 409 для зайнятого email', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...valid, email: 'ASIA@mail.com' });

    expect(res.status).toBe(409);
    expect(res.body.details[0].field).toBe('email');
  });

  it('повертає 400 з помилками по полях', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: '123', name: 'A' });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field).sort()).toEqual(['email', 'name', 'password']);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => request(app).post('/api/auth/register').send(valid));

  it('впускає з правильним паролем', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: valid.email, password: valid.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(valid.email);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.headers['set-cookie'][0]).toMatch(/Max-Age=/);
  });

  it('ставить сесійну cookie, якщо remember = false', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: valid.email, password: valid.password, remember: false });

    expect(res.headers['set-cookie'][0]).not.toMatch(/Max-Age=/);
  });

  it('відповідає 401 на неправильний пароль і на невідомий email однаково', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: valid.email, password: 'wrong-password' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@mail.com', password: valid.password });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
  });
});

describe('refresh і logout', () => {
  it('оновлює access-токен за cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(valid);

    const res = await agent.post('/api/auth/refresh');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(valid.email);
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('відповідає 401 без cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('після logout refresh більше не працює', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(valid);

    const logout = await agent.post('/api/auth/logout');
    const res = await agent.post('/api/auth/refresh');

    expect(logout.status).toBe(204);
    expect(res.status).toBe(401);
  });
});

describe('middleware auth', () => {
  it('пропускає з дійсним токеном і кладе користувача в req.user', async () => {
    const { body } = await request(app).post('/api/auth/register').send(valid);
    const res = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(body.user.id);
  });

  it('відповідає 401 без токена і з пошкодженим токеном', async () => {
    const missing = await request(protectedApp).get('/protected');
    const broken = await request(protectedApp)
      .get('/protected')
      .set('Authorization', 'Bearer not.a.token');

    expect(missing.status).toBe(401);
    expect(broken.status).toBe(401);
  });

  it('відхиляє токен після зміни tokenVersion', async () => {
    const { body } = await request(app).post('/api/auth/register').send(valid);
    await User.updateOne({ email: valid.email }, { $inc: { tokenVersion: 1 } });

    const res = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${body.accessToken}`);

    expect(res.status).toBe(401);
  });
});

describe('скидання пароля', () => {
  it('надсилає лист лише для існуючого email, але завжди відповідає 202', async () => {
    await request(app).post('/api/auth/register').send(valid);

    const known = await request(app).post('/api/auth/password-reset').send({ email: valid.email });
    const unknown = await request(app)
      .post('/api/auth/password-reset')
      .send({ email: 'nobody@mail.com' });

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(valid.email);
  });

  it('задає новий пароль за токеном і скасовує старі сесії', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(valid);
    await request(app).post('/api/auth/password-reset').send({ email: valid.email });

    const confirm = await request(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token: resetTokenFromOutbox(), password: 'new-secret-456' });
    const oldPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: valid.email, password: valid.password });
    const newPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: valid.email, password: 'new-secret-456' });
    const oldSession = await agent.post('/api/auth/refresh');

    expect(confirm.status).toBe(204);
    expect(oldPassword.status).toBe(401);
    expect(newPassword.status).toBe(200);
    expect(oldSession.status).toBe(401);
  });

  it('відхиляє невідомий і вже використаний токен', async () => {
    await request(app).post('/api/auth/register').send(valid);
    await request(app).post('/api/auth/password-reset').send({ email: valid.email });
    const token = resetTokenFromOutbox();

    const unknown = await request(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token: 'a'.repeat(64), password: 'new-secret-456' });
    await request(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, password: 'new-secret-456' });
    const reused = await request(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token, password: 'another-secret-789' });

    expect(unknown.status).toBe(400);
    expect(reused.status).toBe(400);
  });
});
