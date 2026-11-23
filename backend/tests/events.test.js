import request from 'supertest';
import app from '../src/app.js';
import Calendar from '../src/modules/calendars/calendar.model.js';
import Event from '../src/modules/events/event.model.js';
import Invite from '../src/modules/invites/invite.model.js';
import User from '../src/modules/users/user.model.js';
import { outbox } from '../src/utils/mailer.js';
import { clearDb, connectTestDb, disconnectTestDb } from './helpers/db.js';
import { createUser, getMainCalendar } from './helpers/factories.js';

const at = (time, day = '2026-11-16') => `${day}T${time}:00.000Z`;

const createCalendar = (owner, members = [], name = 'Команда') =>
  Calendar.create({
    name,
    color: 'blue',
    owner: owner.user._id,
    members: [
      { user: owner.user._id, role: 'owner' },
      ...members.map(({ account, ...rest }) => ({ user: account.user._id, ...rest })),
    ],
  });

const postEvent = (account, body) =>
  request(app).post('/api/events').set(account.headers).send(body);

const listEvents = (account, query = {}) =>
  request(app).get('/api/events').set(account.headers).query(query);

const getEvent = (account, id) => request(app).get(`/api/events/${id}`).set(account.headers);

const patchEvent = (account, id, body) =>
  request(app).patch(`/api/events/${id}`).set(account.headers).send(body);

const deleteEvent = (account, id) => request(app).delete(`/api/events/${id}`).set(account.headers);

const inviteToEvent = (account, id, emails) =>
  request(app).post(`/api/events/${id}/invite`).set(account.headers).send({ emails });

const acceptInvite = (eventId, email) =>
  Event.updateOne(
    { _id: eventId, 'participants.email': email },
    { $set: { 'participants.$.status': 'accepted', 'participants.$.respondedAt': new Date() } },
  );

const TASK = { type: 'task', startAt: at('09:00') };

const titles = (res) => res.body.events.map((event) => event.title);

const fields = (res) => res.body.details.map((detail) => detail.field);

async function createOwner() {
  const owner = await createUser();
  const main = await getMainCalendar(owner.user._id);
  return { owner, main, calendar: main.id };
}

async function createTeam() {
  const owner = await createUser();
  const editor = await createUser();
  const viewer = await createUser();
  const team = await createCalendar(owner, [
    { account: editor, role: 'editor' },
    { account: viewer, role: 'viewer' },
  ]);
  return { owner, editor, viewer, team, calendar: team.id };
}

beforeAll(() => connectTestDb('events'));

afterEach(async () => {
  await clearDb();
  outbox.length = 0;
});

afterAll(() => disconnectTestDb());

describe('POST /api/events', () => {
  it('створює зустріч і ставить кінець за тривалістю з профілю', async () => {
    const { owner, calendar } = await createOwner();

    const byDefault = await postEvent(owner, {
      title: 'Синк команди',
      type: 'arrangement',
      calendar,
      startAt: at('10:00'),
    });
    await User.updateOne({ _id: owner.user._id }, { defaultArrangementDuration: 45 });
    const custom = await postEvent(owner, {
      title: 'Коротка зустріч',
      type: 'arrangement',
      calendar,
      startAt: at('12:00'),
    });

    expect(byDefault.status).toBe(201);
    expect(byDefault.body.event).toMatchObject({
      title: 'Синк команди',
      type: 'arrangement',
      calendar,
      creator: owner.user.id,
      startAt: at('10:00'),
      endAt: at('11:00'),
      allDay: false,
      color: null,
      isInvited: false,
      sourceCalendar: null,
      participants: [],
    });
    expect(custom.body.event.endAt).toBe(at('12:45'));
  });

  it('зберігає переданий кінець зустрічі та додаткові поля', async () => {
    const { owner, calendar } = await createOwner();

    const res = await postEvent(owner, {
      title: '  Демо  ',
      type: 'arrangement',
      calendar,
      startAt: at('14:00'),
      endAt: at('16:30'),
      color: 'purple',
      location: 'Кімната 204',
      description: 'Показуємо тиждень',
      reminderMinutesBefore: 30,
    });

    expect(res.status).toBe(201);
    expect(res.body.event).toMatchObject({
      title: 'Демо',
      endAt: at('16:30'),
      color: 'purple',
      location: 'Кімната 204',
      description: 'Показуємо тиждень',
      reminderMinutesBefore: 30,
    });
  });

  it('створює нагадування без кінця, навіть якщо його передали', async () => {
    const { owner, calendar } = await createOwner();

    const res = await postEvent(owner, {
      title: 'Випити воду',
      type: 'reminder',
      calendar,
      startAt: at('09:00'),
      endAt: at('09:30'),
    });

    expect(res.status).toBe(201);
    expect(res.body.event).toMatchObject({ type: 'reminder', startAt: at('09:00'), endAt: null });
  });

  it('створює задачу з дедлайном і відхиляє задачу без дати', async () => {
    const { owner, calendar } = await createOwner();

    const dated = await postEvent(owner, {
      title: 'Здати звіт',
      type: 'task',
      calendar,
      startAt: at('18:00'),
      priority: 'high',
    });
    const undated = await postEvent(owner, { title: 'Колись потім', type: 'task', calendar });

    expect(dated.status).toBe(201);
    expect(dated.body.event).toMatchObject({
      startAt: at('18:00'),
      endAt: null,
      priority: 'high',
      isCompleted: false,
      completedAt: null,
    });
    expect(dated.body.event.priority).toBe('high');
    expect(undated.status).toBe(400);
    expect(undated.body.details).toEqual([
      { field: 'startAt', message: 'У кожної події має бути дата' },
    ]);
    expect(await Event.countDocuments()).toBe(1);
  });

  it('повертає 400, якщо кінець не пізніше за початок', async () => {
    const { owner, calendar } = await createOwner();
    const base = { title: 'Зустріч', type: 'arrangement', calendar, startAt: at('10:00') };

    const earlier = await postEvent(owner, { ...base, endAt: at('09:00') });
    const same = await postEvent(owner, { ...base, endAt: at('10:00') });

    expect(earlier.status).toBe(400);
    expect(earlier.body.details).toEqual([
      { field: 'endAt', message: 'Кінець має бути пізніше за початок' },
    ]);
    expect(same.status).toBe(400);
    expect(await Event.countDocuments()).toBe(0);
  });

  it('повертає 400 без назви, типу, календаря та початку', async () => {
    const { owner, calendar } = await createOwner();

    const empty = await postEvent(owner, {});
    const blankTitle = await postEvent(owner, {
      title: '   ',
      type: 'task',
      calendar,
      startAt: at('09:00'),
    });
    const reminderWithoutStart = await postEvent(owner, {
      title: 'Нагадування',
      type: 'reminder',
      calendar,
    });
    const longTitle = await postEvent(owner, {
      title: 'я'.repeat(121),
      type: 'task',
      calendar,
      startAt: at('09:00'),
    });

    expect(empty.status).toBe(400);
    expect(fields(empty).sort()).toEqual(['calendar', 'startAt', 'title', 'type']);
    expect(fields(blankTitle)).toEqual(['title']);
    expect(fields(reminderWithoutStart)).toEqual(['startAt']);
    expect(fields(longTitle)).toEqual(['title']);
  });

  it('повертає 400 для некоректних значень полів', async () => {
    const { owner, calendar } = await createOwner();

    const res = await postEvent(owner, {
      title: 'Зустріч',
      type: 'meeting',
      calendar,
      startAt: 'завтра',
      color: 'red',
      reminderMinutesBefore: 20000,
      priority: 'urgent',
      participants: ['not-an-email'],
    });

    expect(res.status).toBe(400);
    expect(fields(res).sort()).toEqual([
      'color',
      'participants.0',
      'priority',
      'reminderMinutesBefore',
      'startAt',
      'type',
    ]);
  });

  it('не дає створити подію в чужому або неіснуючому календарі', async () => {
    const { owner } = await createOwner();
    const stranger = await createOwner();
    const body = { title: 'Чужа', type: 'reminder', startAt: at('10:00') };

    const foreign = await postEvent(owner, { ...body, calendar: stranger.calendar });
    const missing = await postEvent(owner, { ...body, calendar: '507f1f77bcf86cd799439011' });
    const anonymous = await request(app)
      .post('/api/events')
      .send({ ...body, calendar: stranger.calendar });

    expect(foreign.status).toBe(403);
    expect(missing.status).toBe(404);
    expect(anonymous.status).toBe(401);
    expect(await Event.countDocuments()).toBe(0);
  });

  it('дозволяє створювати редактору і забороняє глядачу', async () => {
    const { editor, viewer, calendar } = await createTeam();
    const body = { title: 'Планування', type: 'arrangement', calendar, startAt: at('10:00') };

    const byEditor = await postEvent(editor, body);
    const byViewer = await postEvent(viewer, body);

    expect(byEditor.status).toBe(201);
    expect(byEditor.body.event.creator).toBe(editor.user.id);
    expect(byViewer.status).toBe(403);
  });

  it('додає учасників, створює запрошення і надсилає листи', async () => {
    const { owner, calendar } = await createOwner();
    const guest = await createUser({ name: 'Максим' });

    const res = await postEvent(owner, {
      title: 'Ретро',
      type: 'arrangement',
      calendar,
      startAt: at('15:00'),
      participants: [
        guest.user.email.toUpperCase(),
        guest.user.email,
        'new.person@mail.com',
        owner.user.email,
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.event.participants).toHaveLength(2);
    expect(res.body.event.participants[0]).toMatchObject({
      user: guest.user.id,
      name: 'Максим',
      email: guest.user.email,
      status: 'pending',
    });
    expect(res.body.event.participants[1]).toMatchObject({
      user: null,
      name: 'new.person',
      email: 'new.person@mail.com',
      status: 'pending',
    });

    const invites = await Invite.find({ event: res.body.event.id }).sort({ email: 1 });
    expect(invites.map((invite) => invite.email)).toEqual(
      ['new.person@mail.com', guest.user.email].sort(),
    );
    expect(invites.every((invite) => invite.kind === 'event' && invite.status === 'pending')).toBe(
      true,
    );
    expect(String(invites[0].invitedBy)).toBe(owner.user.id);

    expect(outbox.map((mail) => mail.to).sort()).toEqual(
      ['new.person@mail.com', guest.user.email].sort(),
    );
    expect(outbox[0].subject).toContain('Ретро');
  });
});

describe('GET /api/events', () => {
  const range = { from: at('00:00'), to: at('00:00', '2026-11-17') };

  async function seedDay() {
    const ctx = await createOwner();
    const { owner, calendar } = ctx;
    const arrangement = (title, startAt, endAt) =>
      postEvent(owner, { title, type: 'arrangement', calendar, startAt, endAt });
    const reminder = (title, startAt) =>
      postEvent(owner, { title, type: 'reminder', calendar, startAt });
    const task = (title, startAt) => postEvent(owner, { title, type: 'task', calendar, startAt });

    await arrangement('Нічна', at('23:00'), at('02:00', '2026-11-17'));
    await arrangement('Закінчилась на межі', at('22:00', '2026-11-15'), at('00:00'));
    await arrangement('Через північ', at('23:00', '2026-11-15'), at('01:00'));
    await arrangement('Вдень', at('10:00'), at('11:00'));
    await arrangement('Починається на межі', at('00:00', '2026-11-17'), at('01:00', '2026-11-17'));
    await reminder('Нагадування на межі', at('00:00'));
    await reminder('Учорашнє нагадування', at('23:59', '2026-11-15'));
    await task('Дедлайн', at('18:00'));

    return ctx;
  }

  it('повертає події, що перетинають діапазон, за зростанням початку', async () => {
    const { owner } = await seedDay();

    const res = await listEvents(owner, range);

    expect(res.status).toBe(200);
    expect(titles(res)).toEqual([
      'Через північ',
      'Нагадування на межі',
      'Вдень',
      'Дедлайн',
      'Нічна',
    ]);
  });

  it('без діапазону повертає всі події за зростанням початку', async () => {
    const { owner } = await seedDay();

    const res = await listEvents(owner);

    expect(res.status).toBe(200);
    expect(titles(res)).toEqual([
      'Закінчилась на межі',
      'Через північ',
      'Учорашнє нагадування',
      'Нагадування на межі',
      'Вдень',
      'Дедлайн',
      'Нічна',
      'Починається на межі',
    ]);
  });

  it('перевіряє параметри діапазону', async () => {
    const { owner } = await createOwner();

    const onlyFrom = await listEvents(owner, { from: range.from });
    const onlyTo = await listEvents(owner, { to: range.to });
    const reversed = await listEvents(owner, { from: range.to, to: range.from });
    const tooLong = await listEvents(owner, { from: at('00:00'), to: at('00:00', '2027-12-22') });
    const maxAllowed = await listEvents(owner, {
      from: at('00:00'),
      to: at('00:00', '2027-12-21'),
    });
    const notDate = await listEvents(owner, { from: 'учора', to: range.to });

    expect(onlyFrom.status).toBe(400);
    expect(onlyTo.status).toBe(400);
    expect(reversed.status).toBe(400);
    expect(fields(reversed)).toEqual(['to']);
    expect(tooLong.status).toBe(400);
    expect(fields(tooLong)).toEqual(['to']);
    expect(maxAllowed.status).toBe(200);
    expect(notDate.status).toBe(400);
    expect(fields(notDate)).toEqual(['from']);
  });

  it('фільтрує за типами', async () => {
    const { owner } = await seedDay();

    const tasks = await listEvents(owner, { ...range, types: 'task' });
    const mixed = await listEvents(owner, { ...range, types: 'reminder, task' });
    const invalid = await listEvents(owner, { types: 'task,meeting' });

    expect(titles(tasks)).toEqual(['Дедлайн']);
    expect(titles(mixed)).toEqual(['Нагадування на межі', 'Дедлайн']);
    expect(invalid.status).toBe(400);
    expect(fields(invalid)).toEqual(['types']);
  });

  it('фільтрує за календарями і мовчки ігнорує чужі', async () => {
    const { owner, calendar } = await createOwner();
    const study = await createCalendar(owner, [], 'Навчання');
    const stranger = await createOwner();
    await postEvent(owner, { title: 'Особиста', ...TASK, calendar });
    await postEvent(owner, { title: 'Лекція', ...TASK, calendar: study.id });
    await postEvent(stranger.owner, { title: 'Чужа', ...TASK, calendar: stranger.calendar });

    const all = await listEvents(owner);
    const onlyStudy = await listEvents(owner, { calendars: study.id });
    const both = await listEvents(owner, { calendars: `${calendar},${study.id}` });
    const withForeign = await listEvents(owner, { calendars: `${stranger.calendar},${calendar}` });
    const onlyForeign = await listEvents(owner, { calendars: `${stranger.calendar},holidays` });

    expect(titles(all).sort()).toEqual(['Лекція', 'Особиста']);
    expect(titles(onlyStudy)).toEqual(['Лекція']);
    expect(titles(both).sort()).toEqual(['Лекція', 'Особиста']);
    expect(titles(withForeign)).toEqual(['Особиста']);
    expect(onlyForeign.status).toBe(200);
    expect(onlyForeign.body.events).toEqual([]);
  });

  it('шукає підрядок у назві та описі без урахування регістру', async () => {
    const { owner, calendar } = await createOwner();
    const task = (title, description = '') =>
      postEvent(owner, { title, ...TASK, calendar, description });
    await task('Квартальний ЗВІТ');
    await task('Дзвінок', 'обговорити звіт за жовтень');
    await task('Реліз (v2.0)');
    await task('Реліз v2x0');

    const cyrillic = await listEvents(owner, { q: 'звіт' });
    const upper = await listEvents(owner, { q: 'ЗВІТ' });
    const special = await listEvents(owner, { q: '(v2.0)' });
    const dot = await listEvents(owner, { q: 'v2.0' });
    const blank = await listEvents(owner, { q: '' });
    const tooLong = await listEvents(owner, { q: 'я'.repeat(101) });

    expect(titles(cyrillic).sort()).toEqual(['Дзвінок', 'Квартальний ЗВІТ']);
    expect(titles(upper).sort()).toEqual(['Дзвінок', 'Квартальний ЗВІТ']);
    expect(titles(special)).toEqual(['Реліз (v2.0)']);
    expect(titles(dot)).toEqual(['Реліз (v2.0)']);
    expect(blank.body.events).toHaveLength(4);
    expect(tooLong.status).toBe(400);
  });

  it('не показує приховані календарі без includeHidden або явного id', async () => {
    const { owner, calendar } = await createOwner();
    const hidden = await createCalendar(owner, [], 'Прихований');
    await Calendar.updateOne({ _id: hidden._id }, { $set: { 'members.0.isHidden': true } });
    await postEvent(owner, { title: 'Видима', ...TASK, calendar });
    await postEvent(owner, { title: 'Прихована', ...TASK, calendar: hidden.id });

    const byDefault = await listEvents(owner);
    const withHidden = await listEvents(owner, { includeHidden: true });
    const explicit = await listEvents(owner, { calendars: hidden.id });

    expect(titles(byDefault)).toEqual(['Видима']);
    expect(titles(withHidden).sort()).toEqual(['Видима', 'Прихована']);
    expect(titles(explicit)).toEqual(['Прихована']);
  });

  it('приховування діє лише для того учасника, який сховав календар', async () => {
    const { owner, editor, team, calendar } = await createTeam();
    await Calendar.updateOne(
      { _id: team._id, 'members.user': editor.user._id },
      { $set: { 'members.$.isHidden': true } },
    );
    await postEvent(owner, { title: 'Спільна', ...TASK, calendar });

    const forOwner = await listEvents(owner);
    const forEditor = await listEvents(editor);

    expect(titles(forOwner)).toEqual(['Спільна']);
    expect(titles(forEditor)).toEqual([]);
  });

  it('показує подію з чужого календаря у головному після прийняття запрошення', async () => {
    const host = await createOwner();
    const guest = await createOwner();
    const extra = await createCalendar(guest.owner, [], 'Навчання');
    const created = await postEvent(host.owner, {
      title: 'День народження',
      type: 'arrangement',
      calendar: host.calendar,
      startAt: at('19:00'),
      participants: [guest.owner.user.email],
    });
    const eventId = created.body.event.id;

    const pending = await listEvents(guest.owner);
    await acceptInvite(eventId, guest.owner.user.email);
    const accepted = await listEvents(guest.owner);
    const inMain = await listEvents(guest.owner, { calendars: guest.calendar });
    const inOther = await listEvents(guest.owner, { calendars: extra.id });
    const forHost = await listEvents(host.owner);

    expect(pending.body.events).toEqual([]);
    expect(accepted.body.events).toHaveLength(1);
    expect(accepted.body.events[0]).toMatchObject({
      id: eventId,
      title: 'День народження',
      calendar: guest.calendar,
      creator: host.owner.user.id,
      isInvited: true,
      sourceCalendar: { id: host.calendar, name: 'Основний', color: 'graphite' },
    });
    expect(accepted.body.events[0].participants[0]).toMatchObject({
      user: guest.owner.user.id,
      status: 'accepted',
    });
    expect(titles(inMain)).toEqual(['День народження']);
    expect(inOther.body.events).toEqual([]);
    expect(forHost.body.events[0]).toMatchObject({
      calendar: host.calendar,
      isInvited: false,
      sourceCalendar: null,
    });
  });

  it('не дублює подію, якщо запрошений також є учасником календаря', async () => {
    const { owner, editor, calendar } = await createTeam();
    const created = await postEvent(owner, {
      title: 'Планування спринту',
      type: 'arrangement',
      calendar,
      startAt: at('11:00'),
      participants: [editor.user.email],
    });
    await acceptInvite(created.body.event.id, editor.user.email);

    const res = await listEvents(editor);

    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0]).toMatchObject({ calendar, isInvited: false, sourceCalendar: null });
  });
});

describe('GET /api/events/:id', () => {
  it('віддає подію учаснику календаря з будь-якою роллю', async () => {
    const { owner, viewer, calendar } = await createTeam();
    const created = await postEvent(owner, { title: 'Огляд', ...TASK, calendar });

    const res = await getEvent(viewer, created.body.event.id);

    expect(res.status).toBe(200);
    expect(res.body.event).toMatchObject({
      id: created.body.event.id,
      title: 'Огляд',
      calendar,
      isInvited: false,
      sourceCalendar: null,
    });
  });

  it('віддає подію запрошеному, навіть якщо він зареєструвався пізніше', async () => {
    const host = await createOwner();
    const created = await postEvent(host.owner, {
      title: 'Вечірка',
      type: 'arrangement',
      calendar: host.calendar,
      startAt: at('20:00'),
      participants: ['late@mail.com'],
    });
    const eventId = created.body.event.id;
    const late = await createUser({ email: 'late@mail.com' });
    const lateMain = await getMainCalendar(late.user._id);

    const pending = await getEvent(late, eventId);
    await acceptInvite(eventId, 'late@mail.com');
    const accepted = await getEvent(late, eventId);

    expect(created.body.event.participants[0].user).toBeNull();
    expect(pending.status).toBe(200);
    expect(pending.body.event).toMatchObject({
      calendar: host.calendar,
      isInvited: true,
      sourceCalendar: { id: host.calendar, name: 'Основний', color: 'graphite' },
    });
    expect(accepted.body.event).toMatchObject({ calendar: lateMain.id, isInvited: true });
  });

  it('відповідає 403 сторонньому, 404 для неіснуючої та 400 для некоректного id', async () => {
    const host = await createOwner();
    const stranger = await createUser();
    const created = await postEvent(host.owner, {
      title: 'Приватна',
      ...TASK,
      calendar: host.calendar,
    });

    const forbidden = await getEvent(stranger, created.body.event.id);
    const missing = await getEvent(host.owner, '507f1f77bcf86cd799439011');
    const invalid = await getEvent(host.owner, 'not-an-id');

    expect(forbidden.status).toBe(403);
    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(400);
  });
});

describe('PATCH /api/events/:id', () => {
  it('редактор змінює лише власні події, власник календаря будь-які', async () => {
    const { owner, editor, viewer, calendar } = await createTeam();
    const body = { type: 'arrangement', calendar, startAt: at('10:00') };
    const ownerEvent = await postEvent(owner, { ...body, title: 'Подія власника' });
    const editorEvent = await postEvent(editor, { ...body, title: 'Подія редактора' });

    const editorOnForeign = await patchEvent(editor, ownerEvent.body.event.id, { title: 'Злам' });
    const editorOnOwn = await patchEvent(editor, editorEvent.body.event.id, { title: 'Моя' });
    const ownerOnForeign = await patchEvent(owner, editorEvent.body.event.id, {
      location: 'Офіс',
    });
    const viewerOnAny = await patchEvent(viewer, editorEvent.body.event.id, { title: 'Злам' });

    expect(editorOnForeign.status).toBe(403);
    expect(editorOnOwn.status).toBe(200);
    expect(editorOnOwn.body.event.title).toBe('Моя');
    expect(ownerOnForeign.status).toBe(200);
    expect(ownerOnForeign.body.event).toMatchObject({
      title: 'Моя',
      location: 'Офіс',
      creator: editor.user.id,
    });
    expect(viewerOnAny.status).toBe(403);
    expect((await Event.findById(ownerEvent.body.event.id)).title).toBe('Подія власника');
  });

  it('запрошений учасник події не може її змінювати', async () => {
    const host = await createOwner();
    const guest = await createUser();
    const created = await postEvent(host.owner, {
      title: 'Зустріч',
      type: 'arrangement',
      calendar: host.calendar,
      startAt: at('10:00'),
      participants: [guest.user.email],
    });
    await acceptInvite(created.body.event.id, guest.user.email);

    const patched = await patchEvent(guest, created.body.event.id, { title: 'Злам' });
    const deleted = await deleteEvent(guest, created.body.event.id);

    expect(patched.status).toBe(403);
    expect(deleted.status).toBe(403);
  });

  it('isCompleted ставить і знімає completedAt', async () => {
    const { owner, calendar } = await createOwner();
    const created = await postEvent(owner, { title: 'Купити квитки', ...TASK, calendar });
    const { id } = created.body.event;

    const done = await patchEvent(owner, id, { isCompleted: true });
    const repeated = await patchEvent(owner, id, { isCompleted: true });
    const undone = await patchEvent(owner, id, { isCompleted: false });

    expect(done.status).toBe(200);
    expect(done.body.event.isCompleted).toBe(true);
    expect(Date.now() - new Date(done.body.event.completedAt).getTime()).toBeLessThan(5000);
    expect(repeated.body.event.completedAt).toBe(done.body.event.completedAt);
    expect(undone.body.event).toMatchObject({ isCompleted: false, completedAt: null });
  });

  it('не дає позначити виконаною зустріч', async () => {
    const { owner, calendar } = await createOwner();
    const created = await postEvent(owner, {
      title: 'Зустріч',
      type: 'arrangement',
      calendar,
      startAt: at('10:00'),
    });

    const res = await patchEvent(owner, created.body.event.id, { isCompleted: true });

    expect(res.status).toBe(400);
    expect(fields(res)).toEqual(['isCompleted']);
  });

  it('перевіряє правила типу після злиття з наявною подією', async () => {
    const { owner, calendar } = await createOwner();
    const created = await postEvent(owner, {
      title: 'Зустріч',
      type: 'arrangement',
      calendar,
      startAt: at('10:00'),
      endAt: at('11:00'),
    });
    const { id } = created.body.event;

    const startAfterEnd = await patchEvent(owner, id, { startAt: at('12:00') });
    const endBeforeStart = await patchEvent(owner, id, { endAt: at('09:00') });
    const withoutStart = await patchEvent(owner, id, { startAt: null });
    const moved = await patchEvent(owner, id, { startAt: at('12:00'), endAt: at('13:30') });
    const empty = await patchEvent(owner, id, {});

    expect(startAfterEnd.status).toBe(400);
    expect(startAfterEnd.body.details).toEqual([
      { field: 'endAt', message: 'Кінець має бути пізніше за початок' },
    ]);
    expect(endBeforeStart.status).toBe(400);
    expect(fields(endBeforeStart)).toEqual(['endAt']);
    expect(withoutStart.status).toBe(400);
    expect(fields(withoutStart)).toEqual(['startAt']);
    expect(moved.status).toBe(200);
    expect(moved.body.event).toMatchObject({ startAt: at('12:00'), endAt: at('13:30') });
    expect(empty.status).toBe(400);
  });

  it('при зміні типу прибирає або підставляє кінець', async () => {
    const { owner, calendar } = await createOwner();
    const created = await postEvent(owner, {
      title: 'Зустріч',
      type: 'arrangement',
      calendar,
      startAt: at('10:00'),
      endAt: at('12:00'),
    });
    const { id } = created.body.event;

    const asReminder = await patchEvent(owner, id, { type: 'reminder' });
    const asArrangement = await patchEvent(owner, id, { type: 'arrangement' });
    const asTask = await patchEvent(owner, id, { type: 'task', isCompleted: true });
    const backToReminder = await patchEvent(owner, id, { type: 'reminder', startAt: at('08:00') });

    expect(asReminder.body.event).toMatchObject({ type: 'reminder', endAt: null });
    expect(asArrangement.body.event).toMatchObject({ type: 'arrangement', endAt: at('11:00') });
    expect(asTask.body.event).toMatchObject({
      type: 'task',
      startAt: at('10:00'),
      endAt: null,
      isCompleted: true,
    });
    expect(backToReminder.body.event).toMatchObject({
      type: 'reminder',
      isCompleted: false,
      completedAt: null,
    });
  });

  it('перенесення в інший календар вимагає прав редактора в ньому', async () => {
    const { owner, calendar } = await createOwner();
    const study = await createCalendar(owner, [], 'Навчання');
    const stranger = await createOwner();
    const readOnly = await createCalendar(stranger.owner, [{ account: owner, role: 'viewer' }]);
    const created = await postEvent(owner, { title: 'Лекція', ...TASK, calendar });
    const { id } = created.body.event;

    const toForeign = await patchEvent(owner, id, { calendar: stranger.calendar });
    const toReadOnly = await patchEvent(owner, id, { calendar: readOnly.id });
    const toMissing = await patchEvent(owner, id, { calendar: '507f1f77bcf86cd799439011' });
    const toOwn = await patchEvent(owner, id, { calendar: study.id });

    expect(toForeign.status).toBe(403);
    expect(toReadOnly.status).toBe(403);
    expect(toMissing.status).toBe(404);
    expect(toOwn.status).toBe(200);
    expect(toOwn.body.event.calendar).toBe(study.id);
  });

  it('синхронізує список учасників', async () => {
    const { owner, calendar } = await createOwner();
    const created = await postEvent(owner, {
      title: 'Ретро',
      type: 'arrangement',
      calendar,
      startAt: at('15:00'),
      participants: ['keep@mail.com', 'drop@mail.com'],
    });
    const { id } = created.body.event;
    await acceptInvite(id, 'keep@mail.com');
    outbox.length = 0;

    const res = await patchEvent(owner, id, {
      participants: ['KEEP@mail.com', 'new@mail.com', 'new@mail.com', owner.user.email],
    });

    expect(res.status).toBe(200);
    expect(res.body.event.participants).toHaveLength(2);
    expect(res.body.event.participants[0]).toMatchObject({
      email: 'keep@mail.com',
      status: 'accepted',
    });
    expect(res.body.event.participants[0].invitedAt).toBe(
      created.body.event.participants[0].invitedAt,
    );
    expect(res.body.event.participants[1]).toMatchObject({
      email: 'new@mail.com',
      status: 'pending',
    });

    const invites = await Invite.find({ event: id }).sort({ email: 1 });
    expect(invites.map((invite) => invite.email)).toEqual(['keep@mail.com', 'new@mail.com']);
    expect(outbox.map((mail) => mail.to)).toEqual(['new@mail.com']);

    const cleared = await patchEvent(owner, id, { participants: [] });
    expect(cleared.body.event.participants).toEqual([]);
    expect(await Invite.countDocuments({ event: id, status: 'pending' })).toBe(0);
  });

  it('не чіпає учасників, якщо їх не передали', async () => {
    const { owner, calendar } = await createOwner();
    const created = await postEvent(owner, {
      title: 'Ретро',
      type: 'arrangement',
      calendar,
      startAt: at('15:00'),
      participants: ['keep@mail.com'],
    });
    outbox.length = 0;

    const res = await patchEvent(owner, created.body.event.id, { title: 'Ретро спринту' });

    expect(res.body.event.title).toBe('Ретро спринту');
    expect(res.body.event.participants).toHaveLength(1);
    expect(await Invite.countDocuments({ event: created.body.event.id })).toBe(1);
    expect(outbox).toHaveLength(0);
  });
});

describe('DELETE /api/events/:id', () => {
  it('видаляє подію разом із запрошеннями', async () => {
    const { owner, calendar } = await createOwner();
    const doomed = await postEvent(owner, {
      title: 'Скасована',
      type: 'arrangement',
      calendar,
      startAt: at('10:00'),
      participants: ['a@mail.com', 'b@mail.com'],
    });
    const kept = await postEvent(owner, {
      title: 'Лишається',
      type: 'arrangement',
      calendar,
      startAt: at('12:00'),
      participants: ['a@mail.com'],
    });
    await acceptInvite(doomed.body.event.id, 'a@mail.com');
    await Invite.updateOne(
      { event: doomed.body.event.id, email: 'a@mail.com' },
      { status: 'accepted' },
    );

    const res = await deleteEvent(owner, doomed.body.event.id);
    const again = await deleteEvent(owner, doomed.body.event.id);

    expect(res.status).toBe(204);
    expect(again.status).toBe(404);
    expect(await Event.findById(doomed.body.event.id)).toBeNull();
    expect(await Invite.countDocuments({ event: doomed.body.event.id })).toBe(0);
    expect(await Invite.countDocuments({ event: kept.body.event.id })).toBe(1);
  });

  it('редактор не може видалити чужу подію, власник календаря може', async () => {
    const { owner, editor, viewer, calendar } = await createTeam();
    const body = { ...TASK, calendar };
    const ownerEvent = await postEvent(owner, { ...body, title: 'Подія власника' });
    const editorEvent = await postEvent(editor, { ...body, title: 'Подія редактора' });

    const byEditor = await deleteEvent(editor, ownerEvent.body.event.id);
    const byViewer = await deleteEvent(viewer, editorEvent.body.event.id);
    const byOwner = await deleteEvent(owner, editorEvent.body.event.id);

    expect(byEditor.status).toBe(403);
    expect(byViewer.status).toBe(403);
    expect(byOwner.status).toBe(204);
    expect(await Event.countDocuments()).toBe(1);
  });
});

describe('POST /api/events/:id/invite', () => {
  it('додає нових учасників і пропускає наявних', async () => {
    const { owner, calendar } = await createOwner();
    const guest = await createUser({ name: 'Оля' });
    const created = await postEvent(owner, {
      title: 'Вечеря',
      type: 'arrangement',
      calendar,
      startAt: at('19:00'),
      participants: ['first@mail.com'],
    });
    outbox.length = 0;

    const res = await inviteToEvent(owner, created.body.event.id, [
      'first@mail.com',
      guest.user.email,
      owner.user.email,
    ]);

    expect(res.status).toBe(200);
    expect(res.body.event.participants.map((participant) => participant.email)).toEqual([
      'first@mail.com',
      guest.user.email,
    ]);
    expect(res.body.event.participants[1]).toMatchObject({
      user: guest.user.id,
      name: 'Оля',
      status: 'pending',
    });
    expect(outbox.map((mail) => mail.to)).toEqual([guest.user.email]);
    expect(await Invite.countDocuments({ event: created.body.event.id })).toBe(2);
  });

  it('перевіряє права і тіло запиту', async () => {
    const { owner, editor, calendar } = await createTeam();
    const created = await postEvent(owner, { title: 'Огляд', ...TASK, calendar });
    const { id } = created.body.event;

    const byEditor = await inviteToEvent(editor, id, ['x@mail.com']);
    const empty = await inviteToEvent(owner, id, []);
    const invalid = await inviteToEvent(owner, id, ['not-an-email']);
    const missing = await inviteToEvent(owner, '507f1f77bcf86cd799439011', ['x@mail.com']);

    expect(byEditor.status).toBe(403);
    expect(empty.status).toBe(400);
    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(outbox).toHaveLength(0);
  });

  it('не дає перевищити ліміт учасників події', async () => {
    const { owner, calendar } = await createOwner();
    const emails = (prefix, count) =>
      Array.from({ length: count }, (item, index) => `${prefix}${index}@mail.com`);
    const created = await postEvent(owner, {
      title: 'Конференція',
      type: 'arrangement',
      calendar,
      startAt: at('10:00'),
      participants: emails('first', 15),
    });

    const res = await inviteToEvent(owner, created.body.event.id, emails('second', 6));

    expect(res.status).toBe(400);
    expect(fields(res)).toEqual(['emails']);
    expect((await Event.findById(created.body.event.id)).participants).toHaveLength(15);
  });
});

describe('модель Event', () => {
  const base = () => ({
    title: 'Подія',
    calendar: '507f1f77bcf86cd799439011',
    creator: '507f1f77bcf86cd799439012',
  });

  it('відхиляє зустріч без початку або з кінцем не пізніше за початок', async () => {
    const withoutStart = new Event({ ...base(), type: 'arrangement' });
    const reversed = new Event({
      ...base(),
      type: 'arrangement',
      startAt: at('10:00'),
      endAt: at('09:00'),
    });
    const reminder = new Event({ ...base(), type: 'reminder' });

    await expect(withoutStart.validate()).rejects.toMatchObject({
      errors: { startAt: expect.anything() },
    });
    await expect(reversed.validate()).rejects.toMatchObject({
      errors: { endAt: { message: 'Кінець має бути пізніше за початок' } },
    });
    await expect(reminder.validate()).rejects.toMatchObject({
      errors: { startAt: expect.anything() },
    });
  });

  it('прибирає кінець у нагадування й задачі та виконання в не-задач', async () => {
    const reminder = new Event({
      ...base(),
      type: 'reminder',
      startAt: at('10:00'),
      endAt: at('11:00'),
      isCompleted: true,
      completedAt: new Date(),
    });
    const task = new Event({
      ...base(),
      type: 'task',
      startAt: at('10:00'),
      endAt: at('11:00'),
      isCompleted: true,
    });

    await reminder.validate();
    await task.validate();

    expect(reminder.endAt).toBeNull();
    expect(reminder.isCompleted).toBe(false);
    expect(reminder.completedAt).toBeNull();
    expect(task.endAt).toBeNull();
    expect(task.isCompleted).toBe(true);
  });
});
