import request from 'supertest';
import app from '../src/app.js';

describe('GET /api/health', () => {
  it('відповідає 200 і { status: "ok" }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('невідомий маршрут повертає 404 у форматі помилки', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
  });
});
