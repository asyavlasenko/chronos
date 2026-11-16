import request from 'supertest';
import app from '../src/app.js';
import Calendar from '../src/modules/calendars/calendar.model.js';
import Event from '../src/modules/events/event.model.js';
import Invite from '../src/modules/invites/invite.model.js';
import { createInvite } from '../src/modules/invites/invite.service.js';
import { outbox } from '../src/utils/mailer.js';
import { clearDb, connectTestDb, disconnectTestDb } from './helpers/db.js';
import { createUser } from './helpers/factories.js';

const HOUR_MS = 60 * 60 * 1000;

let owner;
let guest;

const createCalendar = (overrides = {}) =>
  Calendar.create({
    name: 'Команда',
    description: 'Спільні справи',
    color: 'blue',
    owner: owner.user._id,
    members: [{ user: owner.user._id, role: 'owner' }],
    ...overrides,
  });

const createEvent = (calendar, overrides = {}) =>
  Event.create({
    title: 'Планування спринту',
    type: 'arrangement',
    calendar: calendar._id,
    creator: owner.user._id,
    startAt: new Date('2026-11-20T10:00:00Z'),
    endAt: new Date('2026-11-20T11:00:00Z'),
    ...overrides,
  });

const inviteToCalendar = (calendar, overrides = {}) =>
  createInvite({
    kind: 'calendar',
    email: guest.user.email,
    invitedBy: owner.user,
    calendar,
    role: 'editor',
    ...overrides,
  });

const inviteToEvent = (event, overrides = {}) =>
  createInvite({
    kind: 'event',
    email: guest.user.email,
    invitedBy: owner.user,
    event,
    ...overrides,
  });

const expire = (invite) =>
  Invite.updateOne({ _id: invite._id }, { expiresAt: new Date(Date.now() - HOUR_MS) });

const accept = (token, user = guest) =>
  request(app).post(`/api/invites/${token}/accept`).set(user.headers);

const decline = (token, user = guest) =>
  request(app).post(`/api/invites/${token}/decline`).set(user.headers);

const membersOf = async (calendar) => {
  const fresh = await Calendar.findById(calendar._id);
  return fresh.members.map((m) => ({ user: String(m.user), role: m.role }));
};

const participantsOf = async (event) => {
  const fresh = await Event.findById(event._id);
  return fresh.participants;
};

beforeAll(() => connectTestDb('invites'));

beforeEach(async () => {
  owner = await createUser({ name: 'Анастасія' });
  guest = await createUser({ name: 'Гість' });
});

afterEach(async () => {
  await clearDb();
  outbox.length = 0;
});

afterAll(() => disconnectTestDb());

describe('GET /api/invites', () => {
  it('віддає лише мої pending-запрошення, новіші перші, з токеном', async () => {
    const stranger = await createUser();
    const calendar = await createCalendar();
    const event = await createEvent(calendar, { participants: [{ email: guest.user.email }] });

    const calendarInvite = await inviteToCalendar(calendar);
    const eventInvite = await inviteToEvent(event);
    await inviteToCalendar(calendar, { email: stranger.user.email });
    await inviteToCalendar(calendar, { email: 'nobody@mail.com' });

    const res = await request(app).get('/api/invites').set(guest.headers);

    expect(res.status).toBe(200);
    expect(res.body.invites.map((i) => i.id)).toEqual([eventInvite.id, calendarInvite.id]);

    const [first, second] = res.body.invites;
    expect(first).toMatchObject({
      kind: 'event',
      email: guest.user.email,
      status: 'pending',
      role: null,
      token: eventInvite.token,
      invitedBy: { id: owner.user.id, name: 'Анастасія' },
      event: { id: event.id, title: 'Планування спринту', calendar: calendar.id },
      calendar: { id: calendar.id, name: 'Команда', color: 'blue' },
    });
    expect(second).toMatchObject({
      kind: 'calendar',
      status: 'pending',
      role: 'editor',
      token: calendarInvite.token,
      event: null,
      calendar: { id: calendar.id, name: 'Команда', color: 'blue', isShared: false },
    });
  });

  it('не показує опрацьовані та прострочені запрошення', async () => {
    const accepted = await inviteToCalendar(await createCalendar({ name: 'Прийняте' }));
    const declined = await inviteToCalendar(await createCalendar({ name: 'Відхилене' }));
    const expired = await inviteToCalendar(await createCalendar({ name: 'Прострочене' }));
    const pending = await inviteToCalendar(await createCalendar({ name: 'Активне' }));
    await accept(accepted.token);
    await decline(declined.token);
    await expire(expired);

    const res = await request(app).get('/api/invites').set(guest.headers);

    expect(res.status).toBe(200);
    expect(res.body.invites.map((i) => i.id)).toEqual([pending.id]);
  });

  it('пропускає запрошення, де подію чи календар уже видалено', async () => {
    const goneCalendar = await createCalendar({ name: 'Видалений' });
    const calendar = await createCalendar();
    const goneEvent = await createEvent(calendar, { title: 'Видалена подія' });
    const event = await createEvent(calendar);

    const orphanCalendar = await createCalendar({ name: 'Видалений з подією' });
    const orphanEvent = await createEvent(orphanCalendar, { title: 'Подія без календаря' });

    await inviteToCalendar(goneCalendar);
    await inviteToEvent(goneEvent);
    await inviteToEvent(orphanEvent);
    const alive = await inviteToEvent(event);
    await Calendar.deleteMany({ _id: { $in: [goneCalendar._id, orphanCalendar._id] } });
    await Event.deleteOne({ _id: goneEvent._id });

    const res = await request(app).get('/api/invites').set(guest.headers);

    expect(res.status).toBe(200);
    expect(res.body.invites.map((i) => i.id)).toEqual([alive.id]);
  });

  it('повертає порожній список, якщо запрошень немає', async () => {
    const res = await request(app).get('/api/invites').set(guest.headers);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ invites: [] });
  });

  it('відповідає 401 без токена', async () => {
    const res = await request(app).get('/api/invites');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/invites/:token', () => {
  it('публічно показує запрошення в календар без токена в тілі', async () => {
    const calendar = await createCalendar();
    const invite = await inviteToCalendar(calendar, { role: 'viewer' });

    const res = await request(app).get(`/api/invites/${invite.token}`);

    expect(res.status).toBe(200);
    expect(res.body.invite).toMatchObject({
      id: invite.id,
      kind: 'calendar',
      email: guest.user.email,
      status: 'pending',
      role: 'viewer',
      invitedBy: { id: owner.user.id, name: 'Анастасія' },
      event: null,
      calendar: { id: calendar.id, name: 'Команда', description: 'Спільні справи', color: 'blue' },
    });
    expect(res.body.invite.token).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(invite.token);
  });

  it('публічно показує запрошення на подію з її деталями', async () => {
    const calendar = await createCalendar();
    const event = await createEvent(calendar, { participants: [{ email: guest.user.email }] });
    const invite = await inviteToEvent(event);

    const res = await request(app).get(`/api/invites/${invite.token}`);

    expect(res.status).toBe(200);
    expect(res.body.invite).toMatchObject({
      kind: 'event',
      status: 'pending',
      role: null,
      event: {
        id: event.id,
        title: 'Планування спринту',
        startAt: '2026-11-20T10:00:00.000Z',
        endAt: '2026-11-20T11:00:00.000Z',
        participants: [{ email: guest.user.email, status: 'pending' }],
      },
      calendar: { id: calendar.id, name: 'Команда' },
    });
  });

  it('прострочене pending віддає 200 зі статусом expired', async () => {
    const invite = await inviteToCalendar(await createCalendar());
    await expire(invite);

    const res = await request(app).get(`/api/invites/${invite.token}`);

    expect(res.status).toBe(200);
    expect(res.body.invite.status).toBe('expired');
  });

  it('показує статус уже опрацьованого запрошення', async () => {
    const invite = await inviteToCalendar(await createCalendar());
    await accept(invite.token);

    const res = await request(app).get(`/api/invites/${invite.token}`);

    expect(res.status).toBe(200);
    expect(res.body.invite.status).toBe('accepted');
    expect(res.body.invite.respondedAt).toEqual(expect.any(String));
  });

  it('відповідає 404 на невідомий токен', async () => {
    const res = await request(app).get(`/api/invites/${'a'.repeat(64)}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ status: 'error', message: 'Запрошення не знайдено' });
  });

  it.each([['abc'], ['z'.repeat(64)], ['a'.repeat(63)], ['a'.repeat(65)], ['%24ne']])(
    'відповідає 404 на некоректний токен %s',
    async (token) => {
      const res = await request(app).get(`/api/invites/${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Запрошення не знайдено');
    },
  );

  it('відповідає 404, якщо календар або подію видалено', async () => {
    const calendar = await createCalendar();
    const event = await createEvent(await createCalendar({ name: 'Інший' }));
    const calendarInvite = await inviteToCalendar(calendar);
    const eventInvite = await inviteToEvent(event);
    await Calendar.deleteOne({ _id: calendar._id });
    await Event.deleteOne({ _id: event._id });

    const goneCalendar = await request(app).get(`/api/invites/${calendarInvite.token}`);
    const goneEvent = await request(app).get(`/api/invites/${eventInvite.token}`);

    expect(goneCalendar.status).toBe(404);
    expect(goneEvent.status).toBe(404);
  });
});

describe('POST /api/invites/:token/accept', () => {
  it('додає мене в календар з роллю із запрошення', async () => {
    const calendar = await createCalendar();
    const invite = await inviteToCalendar(calendar, { role: 'editor' });

    const res = await accept(invite.token);

    expect(res.status).toBe(200);
    expect(res.body.invite).toMatchObject({
      id: invite.id,
      kind: 'calendar',
      status: 'accepted',
      role: 'editor',
      calendar: { id: calendar.id, isShared: true },
    });
    expect(res.body.invite.respondedAt).toEqual(expect.any(String));
    expect(res.body.invite.token).toBeUndefined();

    expect(await membersOf(calendar)).toEqual([
      { user: owner.user.id, role: 'owner' },
      { user: guest.user.id, role: 'editor' },
    ]);

    const fresh = await Calendar.findById(calendar._id);
    expect(fresh.members[1].isHidden).toBe(false);
    expect(typeof fresh.members[1].color).toBe('string');
    expect(fresh.members[1].color).not.toBe(fresh.color);
    expect(fresh.members[1].joinedAt).toBeInstanceOf(Date);

    const saved = await Invite.findById(invite._id);
    expect(saved.status).toBe('accepted');
    expect(saved.respondedAt).toBeInstanceOf(Date);
  });

  it('не дублює учасника, якщо я вже в календарі', async () => {
    const calendar = await createCalendar({
      members: [
        { user: owner.user._id, role: 'owner' },
        { user: guest.user._id, role: 'viewer' },
      ],
    });
    const invite = await inviteToCalendar(calendar, { role: 'editor' });

    const res = await accept(invite.token);

    expect(res.status).toBe(200);
    expect(res.body.invite.status).toBe('accepted');
    expect(await membersOf(calendar)).toEqual([
      { user: owner.user.id, role: 'owner' },
      { user: guest.user.id, role: 'viewer' },
    ]);
  });

  it('повторний accept дає 409 і не дублює учасника', async () => {
    const calendar = await createCalendar();
    const invite = await inviteToCalendar(calendar);

    const first = await accept(invite.token);
    const second = await accept(invite.token);

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body.message).toBe('Запрошення вже опрацьовано');
    expect(await membersOf(calendar)).toHaveLength(2);
  });

  it('одночасні accept не створюють дублікатів', async () => {
    const calendar = await createCalendar();
    const invite = await inviteToCalendar(calendar);

    const responses = await Promise.all(Array.from({ length: 5 }, () => accept(invite.token)));
    const statuses = responses.map((res) => res.status);

    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(4);
    expect(await membersOf(calendar)).toHaveLength(2);
  });

  it('оновлює запис учасника події', async () => {
    const calendar = await createCalendar();
    const event = await createEvent(calendar, {
      participants: [{ email: 'other@mail.com' }, { email: guest.user.email }],
    });
    const invite = await inviteToEvent(event);

    const res = await accept(invite.token);

    expect(res.status).toBe(200);
    expect(res.body.invite).toMatchObject({ kind: 'event', status: 'accepted', role: null });
    expect(res.body.invite.event.participants).toEqual([
      expect.objectContaining({ email: 'other@mail.com', status: 'pending', user: null }),
      expect.objectContaining({
        email: guest.user.email,
        status: 'accepted',
        user: guest.user.id,
        name: 'Гість',
      }),
    ]);

    const participants = await participantsOf(event);
    expect(participants).toHaveLength(2);
    expect(participants[0]).toMatchObject({ status: 'pending', user: null, respondedAt: null });
    expect(String(participants[1].user)).toBe(guest.user.id);
    expect(participants[1].status).toBe('accepted');
    expect(participants[1].respondedAt).toBeInstanceOf(Date);
    expect(await membersOf(calendar)).toHaveLength(1);
  });

  it('додає учасника події, якщо запису ще немає', async () => {
    const event = await createEvent(await createCalendar());
    const invite = await inviteToEvent(event);

    const res = await accept(invite.token);

    expect(res.status).toBe(200);
    const participants = await participantsOf(event);
    expect(participants).toHaveLength(1);
    expect(participants[0]).toMatchObject({ email: guest.user.email, status: 'accepted' });
    expect(String(participants[0].user)).toBe(guest.user.id);
    expect(participants[0].respondedAt).toBeInstanceOf(Date);
  });

  it('відповідає 403, якщо запрошення надіслано на інший email', async () => {
    const stranger = await createUser();
    const calendar = await createCalendar();
    const invite = await inviteToCalendar(calendar);

    const res = await accept(invite.token, stranger);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Це запрошення надіслано на інший email');
    expect(await membersOf(calendar)).toHaveLength(1);
    expect((await Invite.findById(invite._id)).status).toBe('pending');
  });

  it('відповідає 410 на прострочене і зберігає статус expired', async () => {
    const calendar = await createCalendar();
    const invite = await inviteToCalendar(calendar);
    await expire(invite);

    const first = await accept(invite.token);
    const second = await accept(invite.token);

    expect(first.status).toBe(410);
    expect(first.body.message).toBe('Термін дії запрошення минув');
    expect(second.status).toBe(410);
    expect((await Invite.findById(invite._id)).status).toBe('expired');
    expect(await membersOf(calendar)).toHaveLength(1);
  });

  it('відповідає 404, якщо календар або подію видалено', async () => {
    const calendar = await createCalendar();
    const event = await createEvent(await createCalendar({ name: 'Інший' }));
    const calendarInvite = await inviteToCalendar(calendar);
    const eventInvite = await inviteToEvent(event);
    await Calendar.deleteOne({ _id: calendar._id });
    await Event.deleteOne({ _id: event._id });

    const goneCalendar = await accept(calendarInvite.token);
    const goneEvent = await accept(eventInvite.token);

    expect(goneCalendar.status).toBe(404);
    expect(goneEvent.status).toBe(404);
    expect((await Invite.findById(calendarInvite._id)).status).toBe('pending');
  });

  it('відповідає 404 на невідомий і некоректний токен', async () => {
    const unknown = await accept('b'.repeat(64));
    const malformed = await accept('not-a-token');

    expect(unknown.status).toBe(404);
    expect(unknown.body.message).toBe('Запрошення не знайдено');
    expect(malformed.status).toBe(404);
  });

  it('відповідає 401 без токена доступу', async () => {
    const invite = await inviteToCalendar(await createCalendar());

    const res = await request(app).post(`/api/invites/${invite.token}/accept`);

    expect(res.status).toBe(401);
    expect((await Invite.findById(invite._id)).status).toBe('pending');
  });
});

describe('POST /api/invites/:token/decline', () => {
  it('відхиляє запрошення в календар і нікого не додає', async () => {
    const calendar = await createCalendar();
    const invite = await inviteToCalendar(calendar);

    const res = await decline(invite.token);

    expect(res.status).toBe(200);
    expect(res.body.invite).toMatchObject({ id: invite.id, status: 'declined' });
    expect(res.body.invite.respondedAt).toEqual(expect.any(String));
    expect(await membersOf(calendar)).toEqual([{ user: owner.user.id, role: 'owner' }]);
    expect((await Invite.findById(invite._id)).status).toBe('declined');
  });

  it('ставить учаснику події статус declined', async () => {
    const event = await createEvent(await createCalendar(), {
      participants: [{ email: guest.user.email }],
    });
    const invite = await inviteToEvent(event);

    const res = await decline(invite.token);

    expect(res.status).toBe(200);
    expect(res.body.invite.status).toBe('declined');
    expect(res.body.invite.event.participants).toEqual([
      expect.objectContaining({ email: guest.user.email, status: 'declined' }),
    ]);

    const participants = await participantsOf(event);
    expect(participants).toHaveLength(1);
    expect(participants[0].status).toBe('declined');
    expect(participants[0].respondedAt).toBeInstanceOf(Date);
  });

  it('не додає учасника події, якщо запису не було', async () => {
    const event = await createEvent(await createCalendar());
    const invite = await inviteToEvent(event);

    const res = await decline(invite.token);

    expect(res.status).toBe(200);
    expect(await participantsOf(event)).toHaveLength(0);
  });

  it('після decline не можна прийняти, і навпаки', async () => {
    const declined = await inviteToCalendar(await createCalendar({ name: 'Перший' }));
    const accepted = await inviteToCalendar(await createCalendar({ name: 'Другий' }));
    await decline(declined.token);
    await accept(accepted.token);

    const acceptAfterDecline = await accept(declined.token);
    const declineAfterAccept = await decline(accepted.token);

    expect(acceptAfterDecline.status).toBe(409);
    expect(declineAfterAccept.status).toBe(409);
    expect((await Invite.findById(accepted._id)).status).toBe('accepted');
  });

  it('перевіряє email, термін дії та ціль так само, як accept', async () => {
    const stranger = await createUser();
    const foreign = await inviteToCalendar(await createCalendar({ name: 'Чужий' }));
    const expired = await inviteToCalendar(await createCalendar({ name: 'Прострочений' }));
    const goneCalendar = await createCalendar({ name: 'Видалений' });
    const gone = await inviteToCalendar(goneCalendar);
    await expire(expired);
    await Calendar.deleteOne({ _id: goneCalendar._id });

    const wrongEmail = await decline(foreign.token, stranger);
    const tooLate = await decline(expired.token);
    const noTarget = await decline(gone.token);
    const unknown = await decline('c'.repeat(64));
    const anonymous = await request(app).post(`/api/invites/${foreign.token}/decline`);

    expect(wrongEmail.status).toBe(403);
    expect(tooLate.status).toBe(410);
    expect((await Invite.findById(expired._id)).status).toBe('expired');
    expect(noTarget.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(anonymous.status).toBe(401);
  });
});
