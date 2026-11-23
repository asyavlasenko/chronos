import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import Calendar from '../src/modules/calendars/calendar.model.js';
import Event from '../src/modules/events/event.model.js';
import Invite from '../src/modules/invites/invite.model.js';
import { outbox } from '../src/utils/mailer.js';
import { clearDb, connectTestDb, disconnectTestDb } from './helpers/db.js';
import { createUser, getMainCalendar } from './helpers/factories.js';

const unknownId = () => new mongoose.Types.ObjectId().toString();

async function createCalendar(owner, body = {}) {
  const res = await request(app)
    .post('/api/calendars')
    .set(owner.headers)
    .send({ name: 'Робота', ...body });
  return res.body.calendar;
}

const addMember = (calendarId, member, role) =>
  Calendar.updateOne({ _id: calendarId }, { $push: { members: { user: member.user._id, role } } });

async function createSharedCalendar() {
  const owner = await createUser();
  const editor = await createUser();
  const viewer = await createUser();
  const stranger = await createUser();
  const calendar = await createCalendar(owner, { name: 'Команда' });
  await addMember(calendar.id, editor, 'editor');
  await addMember(calendar.id, viewer, 'viewer');
  return { owner, editor, viewer, stranger, calendar };
}

const createEvent = (calendarId, creator, overrides = {}) =>
  Event.create({
    title: 'Нагадування',
    type: 'reminder',
    calendar: calendarId,
    creator: creator.user._id,
    startAt: new Date('2026-11-20T09:00:00.000Z'),
    ...overrides,
  });

const share = (calendarId, owner, body) =>
  request(app).post(`/api/calendars/${calendarId}/share`).set(owner.headers).send(body);

const getCalendar = (calendarId, user) =>
  request(app).get(`/api/calendars/${calendarId}`).set(user.headers);

beforeAll(() => connectTestDb('calendars'));

afterEach(async () => {
  await clearDb();
  outbox.length = 0;
});

afterAll(() => disconnectTestDb());

describe('GET /api/calendars', () => {
  it('повертає календарі користувача: головний перший, далі за датою створення', async () => {
    const me = await createUser();
    const other = await createUser();
    const main = await getMainCalendar(me.user._id);
    const work = await createCalendar(me, { name: 'Робота' });
    const foreign = await createCalendar(other, { name: 'Чужий' });
    const team = await createCalendar(other, { name: 'Команда' });
    await addMember(team.id, me, 'viewer');
    const study = await createCalendar(me, { name: 'Навчання' });

    const res = await request(app).get('/api/calendars').set(me.headers);

    expect(res.status).toBe(200);
    expect(res.body.calendars.map((c) => c.id)).toEqual([main.id, work.id, team.id, study.id]);
    expect(res.body.calendars.map((c) => c.id)).not.toContain(foreign.id);
    expect(res.body.calendars[0]).toMatchObject({ isMain: true, myRole: 'owner', isShared: false });
    expect(res.body.calendars[2]).toMatchObject({
      name: 'Команда',
      myRole: 'viewer',
      isShared: true,
      owner: other.user.id,
    });
  });

  it('ставить головний календар першим, навіть якщо він створений пізніше за спільний', async () => {
    const other = await createUser();
    const team = await createCalendar(other, { name: 'Команда' });
    const me = await createUser();
    await addMember(team.id, me, 'editor');
    const main = await getMainCalendar(me.user._id);

    const res = await request(app).get('/api/calendars').set(me.headers);

    expect(res.body.calendars.map((c) => c.id)).toEqual([main.id, team.id]);
  });

  it('рахує події кожного календаря і підставляє імена учасників', async () => {
    const { owner, editor, calendar } = await createSharedCalendar();
    const main = await getMainCalendar(owner.user._id);
    await createEvent(calendar.id, owner);
    await createEvent(calendar.id, editor);
    await createEvent(calendar.id, owner, { type: 'task' });
    await createEvent(main.id, owner);

    const res = await request(app).get('/api/calendars').set(owner.headers);
    const [first, second] = res.body.calendars;

    expect(first).toMatchObject({ id: main.id, eventsCount: 1 });
    expect(second).toMatchObject({ id: calendar.id, eventsCount: 3 });
    expect(second.members).toHaveLength(3);
    expect(second.members[0]).toMatchObject({
      user: owner.user.id,
      name: owner.user.name,
      email: owner.user.email,
      role: 'owner',
    });
    expect(second.members[1]).toMatchObject({
      user: editor.user.id,
      name: editor.user.name,
      email: editor.user.email,
      role: 'editor',
    });
  });

  it('показує pendingInvites лише власнику і лише чинні', async () => {
    const { owner, editor, calendar } = await createSharedCalendar();
    await share(calendar.id, owner, { email: 'fresh@mail.com', role: 'editor' });
    await share(calendar.id, owner, { email: 'expired@mail.com', role: 'viewer' });
    await share(calendar.id, owner, { email: 'declined@mail.com', role: 'viewer' });
    await Invite.updateOne(
      { email: 'expired@mail.com' },
      { expiresAt: new Date(Date.now() - 1000) },
    );
    await Invite.updateOne({ email: 'declined@mail.com' }, { status: 'declined' });
    const fresh = await Invite.findOne({ email: 'fresh@mail.com' });

    const asOwner = await request(app).get('/api/calendars').set(owner.headers);
    const asEditor = await request(app).get('/api/calendars').set(editor.headers);
    const ownerView = asOwner.body.calendars.find((c) => c.id === calendar.id);
    const editorView = asEditor.body.calendars.find((c) => c.id === calendar.id);

    expect(ownerView.pendingInvites).toEqual([
      {
        id: fresh.id,
        email: 'fresh@mail.com',
        role: 'editor',
        expiresAt: fresh.expiresAt.toISOString(),
      },
    ]);
    expect(asOwner.body.calendars[0].pendingInvites).toEqual([]);
    expect(editorView.pendingInvites).toEqual([]);
  });

  it('відповідає 401 без токена', async () => {
    const res = await request(app).get('/api/calendars');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/calendars', () => {
  it('створює календар, автор стає власником', async () => {
    const me = await createUser();

    const res = await request(app)
      .post('/api/calendars')
      .set(me.headers)
      .send({ name: '  Навчання  ', description: 'Лекції та дедлайни', color: 'purple' });

    expect(res.status).toBe(201);
    expect(res.body.calendar).toMatchObject({
      name: 'Навчання',
      description: 'Лекції та дедлайни',
      color: 'purple',
      owner: me.user.id,
      isMain: false,
      isShared: false,
      myRole: 'owner',
      myColor: null,
      isHidden: false,
      eventsCount: 0,
      pendingInvites: [],
    });
    expect(res.body.calendar.members).toEqual([
      expect.objectContaining({
        user: me.user.id,
        name: me.user.name,
        email: me.user.email,
        role: 'owner',
      }),
    ]);

    const saved = await Calendar.findById(res.body.calendar.id);
    expect(saved.members).toHaveLength(1);
    expect(String(saved.owner)).toBe(me.user.id);
  });

  it('за замовчуванням колір blue, опис порожній, isMain завжди false', async () => {
    const me = await createUser();

    const res = await request(app)
      .post('/api/calendars')
      .set(me.headers)
      .send({ name: 'Спорт', description: '', isMain: true, owner: unknownId() });

    expect(res.status).toBe(201);
    expect(res.body.calendar).toMatchObject({
      color: 'blue',
      description: '',
      isMain: false,
      owner: me.user.id,
    });
    expect(await Calendar.countDocuments({ owner: me.user._id, isMain: true })).toBe(1);
  });

  it('повертає 400 з помилками по полях', async () => {
    const me = await createUser();

    const invalid = await request(app)
      .post('/api/calendars')
      .set(me.headers)
      .send({ name: '   ', description: 'x'.repeat(301), color: 'red' });
    const tooLong = await request(app)
      .post('/api/calendars')
      .set(me.headers)
      .send({ name: 'x'.repeat(61) });
    const missing = await request(app).post('/api/calendars').set(me.headers).send({});

    expect(invalid.status).toBe(400);
    expect(invalid.body.details.map((d) => d.field).sort()).toEqual([
      'color',
      'description',
      'name',
    ]);
    expect(tooLong.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(missing.body.details[0].field).toBe('name');
  });

  it('відповідає 401 без токена', async () => {
    const res = await request(app).post('/api/calendars').send({ name: 'Робота' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/calendars/:id', () => {
  it('віддає календар будь-якому учаснику з його роллю', async () => {
    const { owner, editor, viewer, calendar } = await createSharedCalendar();
    await createEvent(calendar.id, owner);

    const asOwner = await getCalendar(calendar.id, owner);
    const asEditor = await getCalendar(calendar.id, editor);
    const asViewer = await getCalendar(calendar.id, viewer);

    expect(asOwner.status).toBe(200);
    expect(asOwner.body.calendar).toMatchObject({
      id: calendar.id,
      name: 'Команда',
      myRole: 'owner',
      isShared: true,
      eventsCount: 1,
    });
    expect(asEditor.body.calendar.myRole).toBe('editor');
    expect(asViewer.status).toBe(200);
    expect(asViewer.body.calendar.myRole).toBe('viewer');
    expect(asViewer.body.calendar.members.map((m) => m.email)).toEqual([
      owner.user.email,
      editor.user.email,
      viewer.user.email,
    ]);
  });

  it('показує pendingInvites лише власнику', async () => {
    const { owner, viewer, calendar } = await createSharedCalendar();
    await share(calendar.id, owner, { email: 'guest@mail.com', role: 'viewer' });

    const asOwner = await getCalendar(calendar.id, owner);
    const asViewer = await getCalendar(calendar.id, viewer);

    expect(asOwner.body.calendar.pendingInvites).toHaveLength(1);
    expect(asOwner.body.calendar.pendingInvites[0]).toMatchObject({
      email: 'guest@mail.com',
      role: 'viewer',
    });
    expect(Object.keys(asOwner.body.calendar.pendingInvites[0]).sort()).toEqual([
      'email',
      'expiresAt',
      'id',
      'role',
    ]);
    expect(asViewer.body.calendar.pendingInvites).toEqual([]);
  });

  it('відповідає 403 сторонньому, 404 для невідомого і 400 для некоректного id', async () => {
    const { stranger, calendar } = await createSharedCalendar();

    const forbidden = await getCalendar(calendar.id, stranger);
    const missing = await getCalendar(unknownId(), stranger);
    const malformed = await getCalendar('not-an-id', stranger);

    expect(forbidden.status).toBe(403);
    expect(missing.status).toBe(404);
    expect(malformed.status).toBe(400);
  });

  it('відповідає 401 без токена', async () => {
    const { calendar } = await createSharedCalendar();
    const res = await request(app).get(`/api/calendars/${calendar.id}`);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/calendars/:id', () => {
  it('власник змінює назву, опис і колір', async () => {
    const { owner, calendar } = await createSharedCalendar();

    const res = await request(app)
      .patch(`/api/calendars/${calendar.id}`)
      .set(owner.headers)
      .send({ name: 'Проєкт', description: '', color: 'green' });

    expect(res.status).toBe(200);
    expect(res.body.calendar).toMatchObject({
      id: calendar.id,
      name: 'Проєкт',
      description: '',
      color: 'green',
      myRole: 'owner',
    });
    expect(res.body.calendar.members).toHaveLength(3);
    expect(res.body.calendar.members[0].email).toBe(owner.user.email);
  });

  it('оновлює лише передані поля', async () => {
    const owner = await createUser();
    const calendar = await createCalendar(owner, { description: 'Опис', color: 'pink' });

    const res = await request(app)
      .patch(`/api/calendars/${calendar.id}`)
      .set(owner.headers)
      .send({ name: 'Нова назва' });

    expect(res.body.calendar).toMatchObject({
      name: 'Нова назва',
      description: 'Опис',
      color: 'pink',
    });
  });

  it('не дає змінити власника, isMain і учасників', async () => {
    const { owner, stranger, calendar } = await createSharedCalendar();

    const res = await request(app)
      .patch(`/api/calendars/${calendar.id}`)
      .set(owner.headers)
      .send({ name: 'Проєкт', owner: stranger.user.id, isMain: true, members: [] });

    expect(res.status).toBe(200);
    expect(res.body.calendar).toMatchObject({ owner: owner.user.id, isMain: false });
    expect(res.body.calendar.members).toHaveLength(3);
  });

  it('відповідає 403 редактору, глядачу і сторонньому', async () => {
    const { editor, viewer, stranger, calendar } = await createSharedCalendar();
    const patch = (user) =>
      request(app)
        .patch(`/api/calendars/${calendar.id}`)
        .set(user.headers)
        .send({ name: 'Зламано' });

    expect((await patch(editor)).status).toBe(403);
    expect((await patch(viewer)).status).toBe(403);
    expect((await patch(stranger)).status).toBe(403);
    expect((await Calendar.findById(calendar.id)).name).toBe('Команда');
  });

  it('повертає 400 для порожнього тіла і некоректних значень', async () => {
    const { owner, calendar } = await createSharedCalendar();
    const patch = (body) =>
      request(app).patch(`/api/calendars/${calendar.id}`).set(owner.headers).send(body);

    expect((await patch({})).status).toBe(400);
    expect((await patch({ name: '' })).status).toBe(400);
    expect((await patch({ color: 'red' })).status).toBe(400);
  });

  it('відповідає 401 без токена', async () => {
    const { calendar } = await createSharedCalendar();
    const res = await request(app).patch(`/api/calendars/${calendar.id}`).send({ name: 'Х' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/calendars/:id', () => {
  it('видаляє календар разом з подіями і запрошеннями', async () => {
    const { owner, editor, calendar } = await createSharedCalendar();
    const other = await createCalendar(owner, { name: 'Інший' });
    const event = await createEvent(calendar.id, owner);
    await createEvent(calendar.id, editor);
    const otherEvent = await createEvent(other.id, owner);
    await share(calendar.id, owner, { email: 'guest@mail.com', role: 'viewer' });
    await share(other.id, owner, { email: 'guest@mail.com', role: 'viewer' });
    await Invite.create({
      kind: 'event',
      token: 'a'.repeat(64),
      email: 'guest@mail.com',
      invitedBy: owner.user._id,
      event: event._id,
    });
    await Invite.create({
      kind: 'event',
      token: 'b'.repeat(64),
      email: 'guest@mail.com',
      invitedBy: owner.user._id,
      event: otherEvent._id,
    });

    const res = await request(app).delete(`/api/calendars/${calendar.id}`).set(owner.headers);

    expect(res.status).toBe(204);
    expect(await Calendar.findById(calendar.id)).toBeNull();
    expect(await Event.countDocuments({ calendar: calendar.id })).toBe(0);
    expect(await Event.countDocuments({ calendar: other.id })).toBe(1);
    expect(await Invite.countDocuments({ calendar: calendar.id })).toBe(0);
    expect(await Invite.countDocuments({ event: event._id })).toBe(0);
    expect(await Invite.countDocuments({ calendar: other.id })).toBe(1);
    expect(await Invite.countDocuments({ event: otherEvent._id })).toBe(1);
    expect((await getCalendar(calendar.id, owner)).status).toBe(404);
  });

  it('відповідає 403 для головного календаря', async () => {
    const me = await createUser();
    const main = await getMainCalendar(me.user._id);
    await createEvent(main.id, me);

    const res = await request(app).delete(`/api/calendars/${main.id}`).set(me.headers);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Головний календар не можна видалити');
    expect(await Calendar.findById(main.id)).not.toBeNull();
    expect(await Event.countDocuments({ calendar: main.id })).toBe(1);
  });

  it('відповідає 403 редактору, глядачу і сторонньому', async () => {
    const { editor, viewer, stranger, calendar } = await createSharedCalendar();
    const remove = (user) => request(app).delete(`/api/calendars/${calendar.id}`).set(user.headers);

    expect((await remove(editor)).status).toBe(403);
    expect((await remove(viewer)).status).toBe(403);
    expect((await remove(stranger)).status).toBe(403);
    expect(await Calendar.findById(calendar.id)).not.toBeNull();
  });

  it('відповідає 401 без токена', async () => {
    const { calendar } = await createSharedCalendar();
    const res = await request(app).delete(`/api/calendars/${calendar.id}`);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/calendars/:id/visibility', () => {
  it('ховає календар і задає колір лише для поточного учасника', async () => {
    const { owner, viewer, calendar } = await createSharedCalendar();

    const res = await request(app)
      .patch(`/api/calendars/${calendar.id}/visibility`)
      .set(viewer.headers)
      .send({ isHidden: true, color: 'orange' });
    const asOwner = await getCalendar(calendar.id, owner);

    expect(res.status).toBe(200);
    expect(res.body.calendar).toMatchObject({
      id: calendar.id,
      isHidden: true,
      myColor: 'orange',
      myRole: 'viewer',
      color: 'blue',
    });
    expect(asOwner.body.calendar).toMatchObject({ isHidden: false, myColor: null, color: 'blue' });

    const saved = await Calendar.findById(calendar.id);
    expect(saved.members.map((m) => m.isHidden)).toEqual([false, false, true]);
    expect(saved.members.map((m) => m.color)).toEqual([null, null, 'orange']);
  });

  it('змінює поля незалежно і дозволяє скинути колір у null', async () => {
    const { editor, calendar } = await createSharedCalendar();
    const patch = (body) =>
      request(app).patch(`/api/calendars/${calendar.id}/visibility`).set(editor.headers).send(body);

    await patch({ isHidden: true, color: 'pink' });
    const onlyColor = await patch({ color: null });
    const onlyHidden = await patch({ isHidden: false });

    expect(onlyColor.body.calendar).toMatchObject({ isHidden: true, myColor: null });
    expect(onlyHidden.status).toBe(200);
    expect(onlyHidden.body.calendar).toMatchObject({ isHidden: false, myColor: null });
  });

  it('не дає сховати головний календар, але дозволяє змінити його колір', async () => {
    const me = await createUser();
    const main = await getMainCalendar(me.user._id);
    const patch = (body) =>
      request(app).patch(`/api/calendars/${main.id}/visibility`).set(me.headers).send(body);

    const hide = await patch({ isHidden: true, color: 'green' });
    const color = await patch({ isHidden: false, color: 'green' });

    expect(hide.status).toBe(403);
    expect(hide.body.message).toBe('Головний календар не можна сховати');
    expect(color.status).toBe(200);
    expect(color.body.calendar).toMatchObject({ isHidden: false, myColor: 'green' });
    expect((await getMainCalendar(me.user._id)).members[0].isHidden).toBe(false);
  });

  it('повертає 400 для порожнього тіла і некоректних значень', async () => {
    const { viewer, calendar } = await createSharedCalendar();
    const patch = (body) =>
      request(app).patch(`/api/calendars/${calendar.id}/visibility`).set(viewer.headers).send(body);

    expect((await patch({})).status).toBe(400);
    expect((await patch({ isHidden: 'так' })).status).toBe(400);
    expect((await patch({ color: 'red' })).status).toBe(400);
  });

  it('відповідає 403 сторонньому і 401 без токена', async () => {
    const { stranger, calendar } = await createSharedCalendar();
    const url = `/api/calendars/${calendar.id}/visibility`;

    const forbidden = await request(app).patch(url).set(stranger.headers).send({ isHidden: true });
    const anonymous = await request(app).patch(url).send({ isHidden: true });

    expect(forbidden.status).toBe(403);
    expect(anonymous.status).toBe(401);
  });
});

describe('POST /api/calendars/:id/share', () => {
  it('створює запрошення і надсилає лист', async () => {
    const owner = await createUser();
    const guest = await createUser();
    const calendar = await createCalendar(owner, { name: 'Команда', color: 'green' });

    const res = await share(calendar.id, owner, { email: guest.user.email, role: 'editor' });

    expect(res.status).toBe(201);
    expect(res.body.invite).toMatchObject({
      kind: 'calendar',
      email: guest.user.email,
      role: 'editor',
      status: 'pending',
      invitedBy: { id: owner.user.id, name: owner.user.name },
      calendar: { id: calendar.id, name: 'Команда', color: 'green' },
      event: null,
    });
    expect(res.body.invite.token).toBeUndefined();

    const saved = await Invite.findById(res.body.invite.id);
    expect(saved).toMatchObject({ kind: 'calendar', role: 'editor', status: 'pending' });
    expect(String(saved.calendar)).toBe(calendar.id);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(guest.user.email);
    expect(outbox[0].text).toContain(saved.token);

    const { members } = await Calendar.findById(calendar.id);
    expect(members).toHaveLength(1);
  });

  it('дозволяє запросити незареєстрований email і нормалізує його', async () => {
    const owner = await createUser();
    const calendar = await createCalendar(owner);

    const res = await share(calendar.id, owner, { email: '  Newbie@Mail.com ', role: 'viewer' });

    expect(res.status).toBe(201);
    expect(res.body.invite).toMatchObject({ email: 'newbie@mail.com', role: 'viewer' });
  });

  it('повторне запрошення на той самий email не створює дубль', async () => {
    const owner = await createUser();
    const calendar = await createCalendar(owner);

    const first = await share(calendar.id, owner, { email: 'guest@mail.com', role: 'viewer' });
    const second = await share(calendar.id, owner, { email: 'guest@mail.com', role: 'editor' });

    expect(second.status).toBe(201);
    expect(second.body.invite.id).toBe(first.body.invite.id);
    expect(second.body.invite.role).toBe('editor');
    expect(await Invite.countDocuments({ calendar: calendar.id })).toBe(1);
  });

  it('відповідає 403 для головного календаря', async () => {
    const me = await createUser();
    const main = await getMainCalendar(me.user._id);

    const res = await share(main.id, me, { email: 'guest@mail.com', role: 'viewer' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Головний календар не можна зробити спільним');
    expect(await Invite.countDocuments()).toBe(0);
    expect(outbox).toHaveLength(0);
  });

  it('відповідає 409 для власного email і для чинного учасника', async () => {
    const { owner, editor, calendar } = await createSharedCalendar();

    const self = await share(calendar.id, owner, {
      email: owner.user.email.toUpperCase(),
      role: 'viewer',
    });
    const member = await share(calendar.id, owner, { email: editor.user.email, role: 'viewer' });

    expect(self.status).toBe(409);
    expect(self.body.details[0].field).toBe('email');
    expect(member.status).toBe(409);
    expect(member.body.details[0].field).toBe('email');
    expect(await Invite.countDocuments()).toBe(0);
    expect(outbox).toHaveLength(0);
  });

  it('відповідає 403 редактору, глядачу і сторонньому', async () => {
    const { editor, viewer, stranger, calendar } = await createSharedCalendar();
    const body = { email: 'guest@mail.com', role: 'viewer' };

    expect((await share(calendar.id, editor, body)).status).toBe(403);
    expect((await share(calendar.id, viewer, body)).status).toBe(403);
    expect((await share(calendar.id, stranger, body)).status).toBe(403);
    expect(await Invite.countDocuments()).toBe(0);
  });

  it('повертає 400 для некоректного email і ролі owner', async () => {
    const owner = await createUser();
    const calendar = await createCalendar(owner);

    const res = await share(calendar.id, owner, { email: 'not-an-email', role: 'owner' });
    const missing = await share(calendar.id, owner, {});

    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field).sort()).toEqual(['email', 'role']);
    expect(missing.status).toBe(400);
  });

  it('відповідає 401 без токена', async () => {
    const owner = await createUser();
    const calendar = await createCalendar(owner);
    const res = await request(app)
      .post(`/api/calendars/${calendar.id}/share`)
      .send({ email: 'guest@mail.com', role: 'viewer' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/calendars/:id/members/:userId', () => {
  const changeRole = (calendarId, actor, memberId, role) =>
    request(app)
      .patch(`/api/calendars/${calendarId}/members/${memberId}`)
      .set(actor.headers)
      .send({ role });

  it('власник змінює роль учасника', async () => {
    const { owner, editor, viewer, calendar } = await createSharedCalendar();

    const promoted = await changeRole(calendar.id, owner, viewer.user.id, 'editor');
    const demoted = await changeRole(calendar.id, owner, editor.user.id, 'viewer');

    expect(promoted.status).toBe(200);
    expect(promoted.body.calendar.id).toBe(calendar.id);
    expect(demoted.body.calendar.members.map((m) => [m.email, m.role])).toEqual([
      [owner.user.email, 'owner'],
      [editor.user.email, 'viewer'],
      [viewer.user.email, 'editor'],
    ]);
    expect((await getCalendar(calendar.id, viewer)).body.calendar.myRole).toBe('editor');
    expect((await getCalendar(calendar.id, editor)).body.calendar.myRole).toBe('viewer');
  });

  it('відповідає 404, якщо такого учасника немає', async () => {
    const { owner, stranger, calendar } = await createSharedCalendar();

    const res = await changeRole(calendar.id, owner, stranger.user.id, 'editor');

    expect(res.status).toBe(404);
  });

  it('не дає змінити роль власника', async () => {
    const { owner, calendar } = await createSharedCalendar();

    const res = await changeRole(calendar.id, owner, owner.user.id, 'viewer');

    expect(res.status).toBe(403);
    expect((await Calendar.findById(calendar.id)).members[0].role).toBe('owner');
  });

  it('відповідає 403 редактору, глядачу і сторонньому', async () => {
    const { editor, viewer, stranger, calendar } = await createSharedCalendar();

    expect((await changeRole(calendar.id, editor, viewer.user.id, 'editor')).status).toBe(403);
    expect((await changeRole(calendar.id, viewer, viewer.user.id, 'editor')).status).toBe(403);
    expect((await changeRole(calendar.id, stranger, viewer.user.id, 'editor')).status).toBe(403);
    expect((await Calendar.findById(calendar.id)).members[2].role).toBe('viewer');
  });

  it('повертає 400 для ролі owner, відсутньої ролі та некоректного userId', async () => {
    const { owner, viewer, calendar } = await createSharedCalendar();

    expect((await changeRole(calendar.id, owner, viewer.user.id, 'owner')).status).toBe(400);
    expect((await changeRole(calendar.id, owner, viewer.user.id, undefined)).status).toBe(400);
    expect((await changeRole(calendar.id, owner, 'not-an-id', 'editor')).status).toBe(400);
  });

  it('відповідає 401 без токена', async () => {
    const { viewer, calendar } = await createSharedCalendar();
    const res = await request(app)
      .patch(`/api/calendars/${calendar.id}/members/${viewer.user.id}`)
      .send({ role: 'editor' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/calendars/:id/members/:userId', () => {
  const removeMember = (calendarId, actor, memberId) =>
    request(app).delete(`/api/calendars/${calendarId}/members/${memberId}`).set(actor.headers);

  it('власник прибирає учасника, і той втрачає доступ', async () => {
    const { owner, editor, viewer, calendar } = await createSharedCalendar();

    const res = await removeMember(calendar.id, owner, editor.user.id);

    expect(res.status).toBe(204);
    const saved = await Calendar.findById(calendar.id);
    expect(saved.members.map((m) => String(m.user))).toEqual([owner.user.id, viewer.user.id]);
    expect((await getCalendar(calendar.id, editor)).status).toBe(403);
    expect((await getCalendar(calendar.id, viewer)).status).toBe(200);
  });

  it('учасник може вийти з календаря сам', async () => {
    const { owner, editor, viewer, calendar } = await createSharedCalendar();

    const viewerLeaves = await removeMember(calendar.id, viewer, viewer.user.id);
    const editorLeaves = await removeMember(calendar.id, editor, editor.user.id);

    expect(viewerLeaves.status).toBe(204);
    expect(editorLeaves.status).toBe(204);
    const saved = await Calendar.findById(calendar.id);
    expect(saved.members.map((m) => String(m.user))).toEqual([owner.user.id]);
    expect((await getCalendar(calendar.id, viewer)).status).toBe(403);

    const list = await request(app).get('/api/calendars').set(viewer.headers);
    expect(list.body.calendars.map((c) => c.id)).not.toContain(calendar.id);
  });

  it('учасник не може прибрати іншого учасника чи власника', async () => {
    const { owner, editor, viewer, calendar } = await createSharedCalendar();

    expect((await removeMember(calendar.id, editor, viewer.user.id)).status).toBe(403);
    expect((await removeMember(calendar.id, viewer, editor.user.id)).status).toBe(403);
    expect((await removeMember(calendar.id, editor, owner.user.id)).status).toBe(403);
    expect((await Calendar.findById(calendar.id)).members).toHaveLength(3);
  });

  it('власник не може вийти з власного календаря', async () => {
    const { owner, calendar } = await createSharedCalendar();
    const main = await getMainCalendar(owner.user._id);

    const shared = await removeMember(calendar.id, owner, owner.user.id);
    const personal = await removeMember(main.id, owner, owner.user.id);

    expect(shared.status).toBe(403);
    expect(personal.status).toBe(403);
    expect((await Calendar.findById(calendar.id)).members).toHaveLength(3);
    expect((await Calendar.findById(main.id)).members).toHaveLength(1);
  });

  it('відповідає 404, якщо такого учасника немає', async () => {
    const { owner, stranger, calendar } = await createSharedCalendar();

    const res = await removeMember(calendar.id, owner, stranger.user.id);

    expect(res.status).toBe(404);
  });

  it('відповідає 403 сторонньому і 401 без токена', async () => {
    const { stranger, viewer, calendar } = await createSharedCalendar();

    const others = await removeMember(calendar.id, stranger, viewer.user.id);
    const self = await removeMember(calendar.id, stranger, stranger.user.id);
    const anonymous = await request(app).delete(
      `/api/calendars/${calendar.id}/members/${viewer.user.id}`,
    );

    expect(others.status).toBe(403);
    expect(self.status).toBe(403);
    expect(anonymous.status).toBe(401);
  });
});

describe('DELETE /api/calendars/:id/invites/:inviteId', () => {
  const cancel = (calendarId, actor, inviteId) =>
    request(app).delete(`/api/calendars/${calendarId}/invites/${inviteId}`).set(actor.headers);

  it('власник скасовує запрошення', async () => {
    const { owner, calendar } = await createSharedCalendar();
    const { body } = await share(calendar.id, owner, { email: 'guest@mail.com', role: 'viewer' });
    await share(calendar.id, owner, { email: 'second@mail.com', role: 'viewer' });

    const res = await cancel(calendar.id, owner, body.invite.id);

    expect(res.status).toBe(204);
    expect(await Invite.findById(body.invite.id)).toBeNull();
    const { pendingInvites } = (await getCalendar(calendar.id, owner)).body.calendar;
    expect(pendingInvites.map((i) => i.email)).toEqual(['second@mail.com']);
  });

  it('відповідає 404 для невідомого, чужого і вже прийнятого запрошення', async () => {
    const { owner, calendar } = await createSharedCalendar();
    const other = await createCalendar(owner, { name: 'Інший' });
    const foreign = await share(other.id, owner, { email: 'guest@mail.com', role: 'viewer' });
    const accepted = await share(calendar.id, owner, { email: 'guest@mail.com', role: 'viewer' });
    await Invite.updateOne({ _id: accepted.body.invite.id }, { status: 'accepted' });

    expect((await cancel(calendar.id, owner, unknownId())).status).toBe(404);
    expect((await cancel(calendar.id, owner, foreign.body.invite.id)).status).toBe(404);
    expect((await cancel(calendar.id, owner, accepted.body.invite.id)).status).toBe(404);
    expect(await Invite.countDocuments()).toBe(2);
  });

  it('відповідає 403 редактору, глядачу і сторонньому, 401 без токена', async () => {
    const { owner, editor, viewer, stranger, calendar } = await createSharedCalendar();
    const { body } = await share(calendar.id, owner, { email: 'guest@mail.com', role: 'viewer' });
    const anonymous = await request(app).delete(
      `/api/calendars/${calendar.id}/invites/${body.invite.id}`,
    );

    expect((await cancel(calendar.id, editor, body.invite.id)).status).toBe(403);
    expect((await cancel(calendar.id, viewer, body.invite.id)).status).toBe(403);
    expect((await cancel(calendar.id, stranger, body.invite.id)).status).toBe(403);
    expect(anonymous.status).toBe(401);
    expect(await Invite.findById(body.invite.id)).not.toBeNull();
  });
});
