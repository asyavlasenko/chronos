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

const verifyTokenFrom = (mail) => /verify-email\/([0-9a-f]{64})/.exec(mail.text)[1];

const register = (body = valid, client = request(app)) =>
  client.post('/api/auth/register').send(body);

const verify = (token, client = request(app)) =>
  client.post('/api/auth/verify-email').send({ token });

const login = (body = { email: valid.email, password: valid.password }) =>
  request(app).post('/api/auth/login').send(body);

async function signUp(client = request(app)) {
  await register(valid, client);
  const res = await verify(verifyTokenFrom(outbox[0]), client);
  outbox.length = 0;
  return res;
}

beforeAll(() => connectTestDb('auth'));

afterEach(async () => {
  await clearDb();
  outbox.length = 0;
});

afterAll(() => disconnectTestDb());

describe('POST /api/auth/register', () => {
  it('створює користувача й головний календар, надсилає лист і не видає сесію', async () => {
    const res = await register();
    const user = await User.findOne({ email: valid.email });
    const calendars = await Calendar.find({ owner: user._id });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      message: 'Ми надіслали лист із посиланням для підтвердження',
      email: valid.email,
    });
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(user.isEmailVerified).toBe(false);
    expect(user.country).toBe('UA');
    expect(calendars).toHaveLength(1);
    expect(calendars[0].isMain).toBe(true);
    expect(calendars[0].members[0].role).toBe('owner');
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(valid.email);
    expect(outbox[0].subject).toBe('Підтверди email у Chronos');
    expect(outbox[0].html).toMatch(/\/verify-email\/[0-9a-f]{64}"/);
  });

  it('додає до посилання адресу повернення і відхиляє зовнішні адреси', async () => {
    const withNext = await register({ ...valid, next: '/invite/abc' });
    const external = await register({ ...valid, email: 'b@mail.com', next: '//evil.com' });
    const absolute = await register({ ...valid, email: 'c@mail.com', next: 'https://evil.com' });

    expect(withNext.status).toBe(201);
    expect(outbox[0].text).toContain('?next=%2Finvite%2Fabc');
    expect(external.status).toBe(400);
    expect(absolute.status).toBe(400);
  });

  it('не зберігає пароль у відкритому вигляді', async () => {
    await register();
    const user = await User.findOne({ email: valid.email }).select('+passwordHash');
    expect(user.passwordHash).not.toBe(valid.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('повертає 409 для зайнятого email', async () => {
    await register();
    const res = await register({ ...valid, email: 'ASIA@mail.com' });

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

describe('підтвердження email', () => {
  it('не впускає до підтвердження, навіть із правильним паролем', async () => {
    await register();

    const res = await login();
    const wrongPassword = await login({ email: valid.email, password: 'wrong-password' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(res.body.accessToken).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.code).toBeUndefined();
  });

  it('за посиланням із листа підтверджує email і одразу відкриває сесію', async () => {
    await register();

    const res = await verify(verifyTokenFrom(outbox[0]));
    const user = await User.findOne({ email: valid.email }).select('+emailVerificationToken');
    const afterwards = await login();

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: valid.email, isEmailVerified: true });
    expect(res.body.user.emailVerificationToken).toBeUndefined();
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.headers['set-cookie'][0]).toMatch(/^refreshToken=.+HttpOnly/);
    expect(user.emailVerificationToken).toBeUndefined();
    expect(afterwards.status).toBe(200);
  });

  it('відхиляє невідомий, використаний і прострочений токен', async () => {
    await register();
    const token = verifyTokenFrom(outbox[0]);

    const unknown = await verify('a'.repeat(64));
    const malformed = await verify('не-токен');
    await User.updateOne({ email: valid.email }, { emailVerificationExpiresAt: new Date(0) });
    const expired = await verify(token);
    await User.updateOne(
      { email: valid.email },
      { emailVerificationExpiresAt: new Date(Date.now() + 60000) },
    );
    const first = await verify(token);
    const reused = await verify(token);

    expect(unknown.status).toBe(400);
    expect(malformed.status).toBe(400);
    expect(expired.status).toBe(400);
    expect(first.status).toBe(200);
    expect(reused.status).toBe(400);
  });

  it('надсилає новий лист, старе посилання перестає діяти', async () => {
    await register();
    const oldToken = verifyTokenFrom(outbox[0]);

    const resend = await request(app)
      .post('/api/auth/verify-email/resend')
      .send({ email: valid.email });
    const newToken = verifyTokenFrom(outbox[1]);
    const withOld = await verify(oldToken);
    const withNew = await verify(newToken);

    expect(resend.status).toBe(202);
    expect(outbox).toHaveLength(2);
    expect(newToken).not.toBe(oldToken);
    expect(withOld.status).toBe(400);
    expect(withNew.status).toBe(200);
  });

  it('на повторний запит відповідає однаково і не пише підтвердженим чи невідомим', async () => {
    await signUp();

    const verified = await request(app)
      .post('/api/auth/verify-email/resend')
      .send({ email: valid.email });
    const unknown = await request(app)
      .post('/api/auth/verify-email/resend')
      .send({ email: 'nobody@mail.com' });
    const invalid = await request(app).post('/api/auth/verify-email/resend').send({ email: 'x' });

    expect(verified.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(unknown.body).toEqual(verified.body);
    expect(invalid.status).toBe(400);
    expect(outbox).toHaveLength(0);
  });

  it('скидання пароля теж підтверджує email', async () => {
    await register();
    outbox.length = 0;
    await request(app).post('/api/auth/password-reset').send({ email: valid.email });

    await request(app)
      .post('/api/auth/password-reset/confirm')
      .send({ token: resetTokenFromOutbox(), password: 'new-secret-456' });
    const res = await login({ email: valid.email, password: 'new-secret-456' });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => signUp());

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
    await signUp(agent);

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
    await signUp(agent);

    const logout = await agent.post('/api/auth/logout');
    const res = await agent.post('/api/auth/refresh');

    expect(logout.status).toBe(204);
    expect(res.status).toBe(401);
  });
});

describe('middleware auth', () => {
  it('пропускає з дійсним токеном і кладе користувача в req.user', async () => {
    const { body } = await signUp();
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
    const { body } = await signUp();
    await User.updateOne({ email: valid.email }, { $inc: { tokenVersion: 1 } });

    const res = await request(protectedApp)
      .get('/protected')
      .set('Authorization', `Bearer ${body.accessToken}`);

    expect(res.status).toBe(401);
  });
});

describe('скидання пароля', () => {
  it('надсилає лист лише для існуючого email, але завжди відповідає 202', async () => {
    await signUp();

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
    await signUp(agent);
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
    await signUp();
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
