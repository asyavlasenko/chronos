import express from 'express';
import request from 'supertest';
import errorHandler from '../src/middlewares/errorHandler.js';
import rateLimit from '../src/middlewares/rateLimit.js';

const WINDOW_MS = 300;
const MESSAGE = 'Забагато спроб';

const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function createApp(max) {
  const app = express();
  app.set('trust proxy', 1);
  app.post('/login', rateLimit({ windowMs: WINDOW_MS, max, message: MESSAGE }), (req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

const attempt = (app, ip = '10.0.0.1') => request(app).post('/login').set('X-Forwarded-For', ip);

describe('rateLimit', () => {
  it('пропускає запити в межах ліміту й відповідає 429 після нього', async () => {
    const app = createApp(3);

    const allowed = [await attempt(app), await attempt(app), await attempt(app)];
    const blocked = await attempt(app);

    expect(allowed.map((res) => res.status)).toEqual([200, 200, 200]);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ status: 'error', message: MESSAGE });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  });

  it('рахує кожну адресу окремо', async () => {
    const app = createApp(1);

    const first = await attempt(app, '10.0.0.1');
    const repeated = await attempt(app, '10.0.0.1');
    const other = await attempt(app, '10.0.0.2');

    expect(first.status).toBe(200);
    expect(repeated.status).toBe(429);
    expect(other.status).toBe(200);
  });

  it('знову пропускає після завершення вікна', async () => {
    const app = createApp(1);

    await attempt(app);
    const blocked = await attempt(app);
    await wait(WINDOW_MS + 50);
    const afterWindow = await attempt(app);

    expect(blocked.status).toBe(429);
    expect(afterWindow.status).toBe(200);
  });

  it('вимкнений, якщо ліміт дорівнює нулю', async () => {
    const app = createApp(0);

    const responses = [await attempt(app), await attempt(app), await attempt(app)];

    expect(responses.map((res) => res.status)).toEqual([200, 200, 200]);
  });
});
