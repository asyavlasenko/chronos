import request from 'supertest';
import app from '../src/app.js';
import Drawing from '../src/modules/drawings/drawing.model.js';
import { clearDb, connectTestDb, disconnectTestDb } from './helpers/db.js';
import { createUser } from './helpers/factories.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY = Date.UTC(2026, 10, 16);

const at = (hours) => DAY + hours * HOUR_MS;

const iso = (hours) => new Date(at(hours)).toISOString();

const stroke = (fromHour, toHour, overrides = {}) => ({
  color: 'blue',
  width: 4,
  points: [
    [at(fromHour), 10],
    [at((fromHour + toHour) / 2), 40.5],
    [at(toHour), 20],
  ],
  ...overrides,
});

const post = (account, body) => request(app).post('/api/drawings').set(account.headers).send(body);

const list = (account, query) =>
  request(app).get('/api/drawings').set(account.headers).query(query);

const fields = (res) => res.body.details.map((detail) => detail.field);

beforeAll(() => connectTestDb('drawings'));

afterEach(() => clearDb());

afterAll(() => disconnectTestDb());

describe('POST /api/drawings', () => {
  it('зберігає штрих і повертає його без службових полів', async () => {
    const me = await createUser();

    const res = await post(me, stroke(10, 11));
    const saved = await Drawing.findById(res.body.drawing.id);

    expect(res.status).toBe(201);
    expect(res.body.drawing).toEqual({
      id: expect.any(String),
      color: 'blue',
      width: 4,
      points: stroke(10, 11).points,
      createdAt: expect.any(String),
    });
    expect(String(saved.owner)).toBe(me.user.id);
    expect(saved.startAt).toEqual(new Date(at(10)));
    expect(saved.endAt).toEqual(new Date(at(11)));
  });

  it('відхиляє некоректні колір, товщину й точки', async () => {
    const me = await createUser();

    const badColor = await post(me, stroke(10, 11, { color: 'rainbow' }));
    const badWidth = await post(me, stroke(10, 11, { width: 40 }));
    const onePoint = await post(me, stroke(10, 11, { points: [[at(10), 5]] }));
    const brokenPoint = await post(me, stroke(10, 11, { points: [[at(10)], ['a', 'b']] }));
    const outOfCanvas = await post(
      me,
      stroke(10, 11, {
        points: [
          [at(10), -5],
          [5, 10],
        ],
      }),
    );
    const tooLong = await post(
      me,
      stroke(10, 11, { points: Array.from({ length: 2001 }, (unused, index) => [at(10), index]) }),
    );
    const empty = await post(me, {});

    expect(fields(badColor)).toEqual(['color']);
    expect(fields(badWidth)).toEqual(['width']);
    expect(onePoint.status).toBe(400);
    expect(brokenPoint.status).toBe(400);
    expect(outOfCanvas.status).toBe(400);
    expect(tooLong.status).toBe(400);
    expect(fields(empty).sort()).toEqual(['color', 'points', 'width']);
    expect(await Drawing.countDocuments()).toBe(0);
  });

  it('відповідає 401 без токена', async () => {
    const res = await request(app).post('/api/drawings').send(stroke(10, 11));

    expect(res.status).toBe(401);
  });
});

describe('GET /api/drawings', () => {
  it('повертає лише мої штрихи, що перетинають діапазон, у порядку створення', async () => {
    const me = await createUser();
    const other = await createUser();
    const before = await post(me, stroke(1, 2));
    const crossing = await post(me, stroke(9, 10.5));
    const inside = await post(me, stroke(11, 12));
    await post(me, stroke(14, 15));
    await post(other, stroke(11, 12));

    const res = await list(me, { from: iso(10), to: iso(13) });

    expect(res.status).toBe(200);
    expect(res.body.drawings.map((drawing) => drawing.id)).toEqual([
      crossing.body.drawing.id,
      inside.body.drawing.id,
    ]);
    expect(res.body.drawings.map((drawing) => drawing.id)).not.toContain(before.body.drawing.id);
  });

  it('вимагає коректний діапазон не довший за 62 дні', async () => {
    const me = await createUser();

    const missing = await list(me, {});
    const reversed = await list(me, { from: iso(10), to: iso(9) });
    const tooWide = await list(me, { from: iso(0), to: iso(24 * 63) });

    expect(fields(missing).sort()).toEqual(['from', 'to']);
    expect(fields(reversed)).toEqual(['to']);
    expect(fields(tooWide)).toEqual(['to']);
  });
});

describe('DELETE /api/drawings', () => {
  it('видаляє один штрих і не дає видалити чужий', async () => {
    const me = await createUser();
    const other = await createUser();
    const mine = await post(me, stroke(10, 11));
    const foreign = await post(other, stroke(10, 11));

    const removed = await request(app)
      .delete(`/api/drawings/${mine.body.drawing.id}`)
      .set(me.headers);
    const again = await request(app)
      .delete(`/api/drawings/${mine.body.drawing.id}`)
      .set(me.headers);
    const notMine = await request(app)
      .delete(`/api/drawings/${foreign.body.drawing.id}`)
      .set(me.headers);
    const badId = await request(app).delete('/api/drawings/not-an-id').set(me.headers);

    expect(removed.status).toBe(204);
    expect(again.status).toBe(404);
    expect(notMine.status).toBe(404);
    expect(badId.status).toBe(400);
    expect(await Drawing.countDocuments()).toBe(1);
  });

  it('очищає мої штрихи в діапазоні й не чіпає решту', async () => {
    const me = await createUser();
    const other = await createUser();
    await post(me, stroke(10, 11));
    await post(me, stroke(11, 12));
    const later = await post(me, stroke(20, 21));
    await post(other, stroke(10, 11));

    const res = await request(app)
      .delete('/api/drawings')
      .set(me.headers)
      .query({ from: iso(9), to: iso(13) });
    const withoutRange = await request(app).delete('/api/drawings').set(me.headers);
    const left = await Drawing.find({ owner: me.user._id });

    expect(res.status).toBe(204);
    expect(withoutRange.status).toBe(400);
    expect(left.map((drawing) => drawing.id)).toEqual([later.body.drawing.id]);
    expect(await Drawing.countDocuments({ owner: other.user._id })).toBe(1);
  });
});
