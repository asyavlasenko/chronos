import request from 'supertest';
import app from '../src/app.js';
import llm from '../src/modules/assistant/assistant.llm.js';
import ApiError from '../src/utils/ApiError.js';
import { clearDb, connectTestDb, disconnectTestDb } from './helpers/db.js';
import { createUser } from './helpers/factories.js';

const original = { isEnabled: llm.isEnabled, request: llm.request };
const calls = [];

const answer = (overrides = {}) => ({
  understood: true,
  title: 'Зустріч з ментором',
  type: 'arrangement',
  date: '2026-11-17',
  startTime: '15:00',
  endTime: null,
  ...overrides,
});

function respondWith(result) {
  llm.request = async (input) => {
    calls.push(input);
    if (result instanceof Error) throw result;
    return result;
  };
}

const postDraft = (account, body = { text: 'завтра о 15 зустріч з ментором' }) =>
  request(app).post('/api/assistant/draft').set(account.headers).send(body);

beforeAll(() => connectTestDb('assistant'));

beforeEach(() => {
  calls.length = 0;
  llm.isEnabled = () => true;
  respondWith(answer());
});

afterEach(() => clearDb());

afterAll(async () => {
  Object.assign(llm, original);
  await disconnectTestDb();
});

describe('GET /api/assistant', () => {
  it('каже, чи налаштований помічник', async () => {
    const me = await createUser();

    const enabled = await request(app).get('/api/assistant').set(me.headers);
    llm.isEnabled = () => false;
    const disabled = await request(app).get('/api/assistant').set(me.headers);
    const anonymous = await request(app).get('/api/assistant');

    expect(enabled.body).toEqual({ enabled: true });
    expect(disabled.body).toEqual({ enabled: false });
    expect(anonymous.status).toBe(401);
  });
});

describe('POST /api/assistant/draft', () => {
  it('повертає чернетку зустрічі з тривалістю за замовчуванням у часовому поясі користувача', async () => {
    const me = await createUser({ timezone: 'Europe/Kyiv' });

    const res = await postDraft(me);

    expect(res.status).toBe(200);
    expect(res.body.draft).toEqual({
      title: 'Зустріч з ментором',
      type: 'arrangement',
      startAt: '2026-11-17T13:00:00.000Z',
      endAt: '2026-11-17T14:00:00.000Z',
      allDay: false,
      isFloating: false,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      text: 'завтра о 15 зустріч з ментором',
      timeZone: 'Europe/Kyiv',
    });
    expect(calls[0].now).toBeInstanceOf(Date);
  });

  it('враховує часовий пояс, явний кінець і перехід через північ', async () => {
    const me = await createUser({ timezone: 'America/New_York' });

    respondWith(answer({ endTime: '16:30' }));
    const withEnd = await postDraft(me);
    respondWith(answer({ startTime: '23:00', endTime: '01:00' }));
    const overnight = await postDraft(me);

    expect(withEnd.body.draft).toMatchObject({
      startAt: '2026-11-17T20:00:00.000Z',
      endAt: '2026-11-17T21:30:00.000Z',
    });
    expect(overnight.body.draft).toMatchObject({
      startAt: '2026-11-18T04:00:00.000Z',
      endAt: '2026-11-18T06:00:00.000Z',
    });
  });

  it('нагадування й задача з часом не мають кінця', async () => {
    const me = await createUser();

    respondWith(answer({ type: 'reminder', title: 'Випити ліки', endTime: '16:00' }));
    const reminder = await postDraft(me);
    respondWith(answer({ type: 'task', title: 'Здати звіт' }));
    const task = await postDraft(me);

    expect(reminder.body.draft).toMatchObject({ type: 'reminder', endAt: null, allDay: false });
    expect(task.body.draft).toMatchObject({ type: 'task', endAt: null, allDay: false });
  });

  it('без часу робить запис на весь день, а зустріч стає нагадуванням', async () => {
    const me = await createUser({ timezone: 'Europe/Kyiv' });

    respondWith(answer({ title: 'День народження мами', startTime: null }));
    const birthday = await postDraft(me);
    respondWith(answer({ type: 'task', title: 'Здати курсову', startTime: null }));
    const deadline = await postDraft(me);

    expect(birthday.body.draft).toEqual({
      title: 'День народження мами',
      type: 'reminder',
      startAt: '2026-11-16T22:00:00.000Z',
      endAt: null,
      allDay: true,
      isFloating: false,
    });
    expect(deadline.body.draft).toMatchObject({ type: 'task', allDay: true, isFloating: false });
  });

  it('без дати повертає плаваючу задачу', async () => {
    const me = await createUser();

    respondWith(answer({ type: 'task', title: 'Розібрати фото', date: null, startTime: null }));
    const task = await postDraft(me);
    respondWith(answer({ title: 'Зустрітись з Олею', date: null, startTime: null }));
    const meeting = await postDraft(me);

    expect(task.body.draft).toEqual({
      title: 'Розібрати фото',
      type: 'task',
      startAt: null,
      endAt: null,
      allDay: true,
      isFloating: true,
    });
    expect(meeting.body.draft).toMatchObject({ type: 'task', isFloating: true });
  });

  it('не довіряє зіпсованим даті, часу й задовгій назві від моделі', async () => {
    const me = await createUser();

    respondWith(answer({ date: '2026-02-31' }));
    const badDate = await postDraft(me);
    respondWith(answer({ startTime: '25:99' }));
    const badTime = await postDraft(me);
    respondWith(answer({ title: `  ${'я'.repeat(300)}  `, endTime: 'пізно' }));
    const longTitle = await postDraft(me);

    expect(badDate.body.draft).toMatchObject({ isFloating: true, startAt: null });
    expect(badTime.body.draft).toMatchObject({ allDay: true, type: 'reminder' });
    expect(longTitle.body.draft.title).toHaveLength(120);
    expect(longTitle.body.draft.endAt).toBe('2026-11-17T14:00:00.000Z');
  });

  it('відповідає 422, якщо текст не схожий на подію або модель нічого не повернула', async () => {
    const me = await createUser();

    respondWith(answer({ understood: false, title: '' }));
    const notAnEvent = await postDraft(me, { text: 'яка сьогодні погода?' });
    respondWith(answer({ title: '   ' }));
    const emptyTitle = await postDraft(me);
    respondWith(null);
    const nothing = await postDraft(me);

    expect(notAnEvent.status).toBe(422);
    expect(notAnEvent.body.message).toContain('Не вдалося розпізнати подію');
    expect(emptyTitle.status).toBe(422);
    expect(nothing.status).toBe(422);
  });

  it('перевіряє текст до звернення до моделі', async () => {
    const me = await createUser();

    const empty = await postDraft(me, {});
    const blank = await postDraft(me, { text: '   ' });
    const tooLong = await postDraft(me, { text: 'я'.repeat(501) });
    const notText = await postDraft(me, { text: { $ne: '' } });
    const anonymous = await request(app).post('/api/assistant/draft').send({ text: 'завтра' });

    expect(empty.status).toBe(400);
    expect(blank.status).toBe(400);
    expect(tooLong.status).toBe(400);
    expect(notText.status).toBe(400);
    expect(anonymous.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('відповідає 503 без ключа і передає помилки сервісу моделі', async () => {
    const me = await createUser();

    respondWith(new ApiError(502, 'Помічник зараз недоступний. Спробуй пізніше'));
    const unavailable = await postDraft(me);
    respondWith(new ApiError(429, 'Помічник перевантажений. Спробуй за хвилину'));
    const overloaded = await postDraft(me);
    llm.isEnabled = () => false;
    const disabled = await postDraft(me);

    expect(unavailable.status).toBe(502);
    expect(overloaded.status).toBe(429);
    expect(disabled.status).toBe(503);
    expect(disabled.body.message).toContain('не налаштований');
    expect(calls).toHaveLength(2);
  });
});
