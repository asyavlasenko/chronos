import request from 'supertest';
import app from '../src/app.js';
import Event from '../src/modules/events/event.model.js';
import { sendDueReminders } from '../src/modules/events/reminder.service.js';
import { outbox } from '../src/utils/mailer.js';
import { clearDb, connectTestDb, disconnectTestDb } from './helpers/db.js';
import { createUser, getMainCalendar } from './helpers/factories.js';

const at = (time, day = '2026-11-16') => `${day}T${time}:00.000Z`;

const postEvent = (account, body) =>
  request(app).post('/api/events').set(account.headers).send(body);

const patchEvent = (account, id, body) =>
  request(app).patch(`/api/events/${id}`).set(account.headers).send(body);

const listEvents = (account, query = {}) =>
  request(app).get('/api/events').set(account.headers).query(query);

const fields = (res) => res.body.details.map((detail) => detail.field);

async function createOwner() {
  const owner = await createUser();
  const main = await getMainCalendar(owner.user._id);
  return { owner, calendar: main.id };
}

const floatingTask = (calendar, overrides = {}) => ({
  title: 'Розібрати фото',
  type: 'task',
  calendar,
  isFloating: true,
  ...overrides,
});

beforeAll(() => connectTestDb('floating'));

afterEach(async () => {
  await clearDb();
  outbox.length = 0;
});

afterAll(() => disconnectTestDb());

describe('плаваючі задачі', () => {
  it('створюється без дедлайну, але з датою створення в базі', async () => {
    const { owner, calendar } = await createOwner();
    const before = Date.now();

    const res = await postEvent(owner, floatingTask(calendar, { reminderMinutesBefore: 30 }));
    const saved = await Event.findById(res.body.event.id);

    expect(res.status).toBe(201);
    expect(res.body.event).toMatchObject({
      isFloating: true,
      allDay: true,
      endAt: null,
      reminderMinutesBefore: null,
      isCompleted: false,
    });
    expect(saved.startAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(saved.startAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('плаваючою може бути лише задача', async () => {
    const { owner, calendar } = await createOwner();
    const dated = await postEvent(owner, {
      title: 'Зустріч',
      type: 'arrangement',
      calendar,
      startAt: at('10:00'),
      endAt: at('11:00'),
    });

    const reminder = await postEvent(owner, floatingTask(calendar, { type: 'reminder' }));
    const viaPatch = await patchEvent(owner, dated.body.event.id, { isFloating: true });
    const typeChange = await postEvent(owner, floatingTask(calendar));
    const toMeeting = await patchEvent(owner, typeChange.body.event.id, { type: 'arrangement' });

    expect(reminder.status).toBe(400);
    expect(reminder.body.details).toContainEqual({
      field: 'isFloating',
      message: 'Без дати може бути лише задача',
    });
    expect(fields(viaPatch)).toEqual(['isFloating']);
    expect(fields(toMeeting)).toEqual(['isFloating']);
  });

  it('звичайна задача без дати, як і раніше, відхиляється', async () => {
    const { owner, calendar } = await createOwner();

    const res = await postEvent(owner, floatingTask(calendar, { isFloating: false }));

    expect(res.status).toBe(400);
    expect(fields(res)).toEqual(['startAt']);
  });

  it('є у повному списку й відсутня у вибірці за діапазоном', async () => {
    const { owner, calendar } = await createOwner();
    await postEvent(owner, floatingTask(calendar));
    await postEvent(owner, { title: 'З дедлайном', type: 'task', calendar, startAt: at('10:00') });
    const wide = { from: '2026-01-01T00:00:00.000Z', to: '2027-01-01T00:00:00.000Z' };

    const all = await listEvents(owner);
    const ranged = await listEvents(owner, wide);

    expect(all.body.events.map((event) => event.title).sort()).toEqual([
      'З дедлайном',
      'Розібрати фото',
    ]);
    expect(ranged.body.events.map((event) => event.title)).toEqual(['З дедлайном']);
  });

  it('отримує час після перетягування на дошку і може знову стати плаваючою', async () => {
    const { owner, calendar } = await createOwner();
    const created = await postEvent(owner, floatingTask(calendar));
    const { id } = created.body.event;

    const withoutDate = await patchEvent(owner, id, { isFloating: false });
    const scheduled = await patchEvent(owner, id, {
      isFloating: false,
      allDay: false,
      startAt: at('15:00'),
      reminderMinutesBefore: 10,
    });
    const floatingAgain = await patchEvent(owner, id, { isFloating: true });

    expect(withoutDate.status).toBe(400);
    expect(withoutDate.body.details).toEqual([
      { field: 'startAt', message: 'Щоб призначити час, вкажи дату' },
    ]);
    expect(scheduled.body.event).toMatchObject({
      isFloating: false,
      allDay: false,
      startAt: at('15:00'),
      reminderMinutesBefore: 10,
    });
    expect(floatingAgain.body.event).toMatchObject({
      isFloating: true,
      allDay: true,
      reminderMinutesBefore: null,
    });
  });

  it('можна позначити виконаною, і про неї не надходять нагадування', async () => {
    const { owner, calendar } = await createOwner();
    const created = await postEvent(owner, floatingTask(calendar));
    await Event.updateOne(
      { _id: created.body.event.id },
      { $set: { reminderMinutesBefore: 0, startAt: new Date() } },
    );

    const sent = await sendDueReminders(new Date());
    const done = await patchEvent(owner, created.body.event.id, { isCompleted: true });

    expect(sent).toBe(0);
    expect(outbox).toHaveLength(0);
    expect(done.body.event).toMatchObject({ isCompleted: true, isFloating: true });
  });
});

describe('приховані блоки головного екрана', () => {
  const patchMe = (account, body) =>
    request(app).patch('/api/users/me').set(account.headers).send(body);

  it('зберігає список прихованих блоків у профілі', async () => {
    const me = await createUser();

    const initial = await request(app).get('/api/users/me').set(me.headers);
    const saved = await patchMe(me, { hiddenModules: ['holidays', 'load'] });
    const cleared = await patchMe(me, { hiddenModules: [] });

    expect(initial.body.user.hiddenModules).toEqual([]);
    expect(saved.status).toBe(200);
    expect(saved.body.user.hiddenModules).toEqual(['holidays', 'load']);
    expect(cleared.body.user.hiddenModules).toEqual([]);
  });

  it('відхиляє невідомі блоки, дублікати й не масив', async () => {
    const me = await createUser();

    const unknown = await patchMe(me, { hiddenModules: ['board'] });
    const duplicate = await patchMe(me, { hiddenModules: ['tasks', 'tasks'] });
    const notArray = await patchMe(me, { hiddenModules: 'tasks' });

    expect(unknown.status).toBe(400);
    expect(duplicate.status).toBe(400);
    expect(notArray.status).toBe(400);
  });
});
