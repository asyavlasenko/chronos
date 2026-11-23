import request from 'supertest';
import app from '../src/app.js';
import Calendar from '../src/modules/calendars/calendar.model.js';
import Event from '../src/modules/events/event.model.js';
import Invite from '../src/modules/invites/invite.model.js';
import User from '../src/modules/users/user.model.js';
import { outbox } from '../src/utils/mailer.js';
import { clearDb, connectTestDb, disconnectTestDb } from './helpers/db.js';
import { createUser, getMainCalendar } from './helpers/factories.js';

const GUEST_EMAIL = 'guest@mail.com';

const at = (time, day = '2026-11-16') => `${day}T${time}:00.000Z`;

const recipients = () => outbox.map((mail) => mail.to).sort();

const mailTo = (email) => outbox.find((mail) => mail.to === email);

const patchEvent = (account, id, body) =>
  request(app).patch(`/api/events/${id}`).set(account.headers).send(body);

const deleteEvent = (account, id) => request(app).delete(`/api/events/${id}`).set(account.headers);

const setStatus = (eventId, email, status) =>
  Event.updateOne(
    { _id: eventId, 'participants.email': email },
    { $set: { 'participants.$.status': status, 'participants.$.respondedAt': new Date() } },
  );

const muteSharedEmails = (account) =>
  User.updateOne({ _id: account.user._id }, { 'notifications.sharedCalendarEmails': false });

async function createMeeting() {
  const owner = await createUser();
  const accepted = await createUser({ timezone: 'America/New_York' });
  const pending = await createUser();
  const declined = await createUser();
  const main = await getMainCalendar(owner.user._id);

  const created = await request(app)
    .post('/api/events')
    .set(owner.headers)
    .send({
      title: 'Демо',
      type: 'arrangement',
      calendar: main.id,
      startAt: at('10:00'),
      endAt: at('11:00'),
      participants: [accepted.user.email, pending.user.email, declined.user.email, GUEST_EMAIL],
    });
  const { id } = created.body.event;

  await setStatus(id, accepted.user.email, 'accepted');
  await setStatus(id, declined.user.email, 'declined');
  outbox.length = 0;

  return { owner, accepted, pending, declined, id, calendar: main.id };
}

beforeAll(() => connectTestDb('notifications'));

afterEach(async () => {
  await clearDb();
  outbox.length = 0;
});

afterAll(() => disconnectTestDb());

describe('сповіщення про зміну події', () => {
  it('після перенесення пише учасникам, крім тих, хто відмовився, і самого автора змін', async () => {
    const { owner, accepted, pending, id } = await createMeeting();
    const invite = await Invite.findOne({ event: id, email: pending.user.email });

    const res = await patchEvent(owner, id, { startAt: at('12:00'), endAt: at('13:00') });

    expect(res.status).toBe(200);
    expect(recipients()).toEqual([accepted.user.email, pending.user.email, GUEST_EMAIL].sort());
    expect(mailTo(accepted.user.email).subject).toBe(`${owner.user.name} змінив(-ла) подію «Демо»`);
    expect(mailTo(accepted.user.email).html).toContain('07:00');
    expect(mailTo(accepted.user.email).html).toContain(`/calendar/day?date=2026-11-16&event=${id}`);
    expect(mailTo(pending.user.email).html).toContain('14:00');
    expect(mailTo(pending.user.email).html).toContain(`/invite/${invite.token}`);
  });

  it('пише про зміну місця й мовчить, якщо час і місце ті самі', async () => {
    const { owner, id } = await createMeeting();

    await patchEvent(owner, id, { title: 'Демо для ментора', description: 'Показуємо календар' });
    const afterRename = outbox.length;
    await patchEvent(owner, id, { location: 'Аудиторія 204' });

    expect(afterRename).toBe(0);
    expect(outbox).toHaveLength(3);
    expect(outbox[0].html).toContain('Місце: Аудиторія 204');
  });

  it('не пише тим, хто вимкнув листи про зміни в профілі', async () => {
    const { owner, accepted, pending, id } = await createMeeting();
    await muteSharedEmails(accepted);

    await patchEvent(owner, id, { startAt: at('12:00'), endAt: at('13:00') });

    expect(recipients()).toEqual([pending.user.email, GUEST_EMAIL].sort());
  });

  it('новому учаснику надсилає лише запрошення', async () => {
    const { owner, accepted, pending, declined, id } = await createMeeting();
    const newcomer = await createUser();

    await patchEvent(owner, id, {
      startAt: at('12:00'),
      endAt: at('13:00'),
      participants: [
        accepted.user.email,
        pending.user.email,
        declined.user.email,
        GUEST_EMAIL,
        newcomer.user.email,
      ],
    });
    const toNewcomer = outbox.filter((mail) => mail.to === newcomer.user.email);

    expect(toNewcomer).toHaveLength(1);
    expect(toNewcomer[0].subject).toContain('запрошує тебе на подію');
    expect(outbox).toHaveLength(4);
  });

  it('пише авторові події, коли її переносить власник календаря', async () => {
    const owner = await createUser();
    const editor = await createUser();
    const team = await Calendar.create({
      name: 'Команда',
      color: 'blue',
      owner: owner.user._id,
      members: [
        { user: owner.user._id, role: 'owner' },
        { user: editor.user._id, role: 'editor' },
      ],
    });
    const created = await request(app)
      .post('/api/events')
      .set(editor.headers)
      .send({ title: 'Ревʼю', type: 'reminder', calendar: team.id, startAt: at('10:00') });

    await patchEvent(owner, created.body.event.id, { startAt: at('15:00') });

    expect(recipients()).toEqual([editor.user.email]);
    expect(outbox[0].subject).toBe(`${owner.user.name} змінив(-ла) подію «Ревʼю»`);
  });
});

describe('сповіщення про скасування події', () => {
  it('після видалення пише учасникам, що подію скасовано', async () => {
    const { owner, accepted, pending, id } = await createMeeting();

    const res = await deleteEvent(owner, id);

    expect(res.status).toBe(204);
    expect(recipients()).toEqual([accepted.user.email, pending.user.email, GUEST_EMAIL].sort());
    expect(mailTo(accepted.user.email).subject).toBe(
      `${owner.user.name} скасував(-ла) подію «Демо»`,
    );
    expect(mailTo(accepted.user.email).html).toContain('05:00');
    expect(mailTo(accepted.user.email).html).not.toContain('<a ');
  });

  it('не пише нікому, якщо в події немає учасників', async () => {
    const owner = await createUser();
    const main = await getMainCalendar(owner.user._id);
    const created = await request(app)
      .post('/api/events')
      .set(owner.headers)
      .send({ title: 'Особисте', type: 'reminder', calendar: main.id, startAt: at('10:00') });

    await patchEvent(owner, created.body.event.id, { startAt: at('11:00') });
    await deleteEvent(owner, created.body.event.id);

    expect(outbox).toHaveLength(0);
  });
});

describe('листи із запрошеннями', () => {
  it('не надсилає лист тому, хто їх вимкнув, але запрошення лишається в застосунку', async () => {
    const owner = await createUser();
    const quiet = await createUser();
    const main = await getMainCalendar(owner.user._id);
    await muteSharedEmails(quiet);

    await request(app)
      .post('/api/events')
      .set(owner.headers)
      .send({
        title: 'Тиха зустріч',
        type: 'reminder',
        calendar: main.id,
        startAt: at('10:00'),
        participants: [quiet.user.email, GUEST_EMAIL],
      });
    const mine = await request(app).get('/api/invites').set(quiet.headers);

    expect(recipients()).toEqual([GUEST_EMAIL]);
    expect(mine.status).toBe(200);
    expect(mine.body.invites).toHaveLength(1);
  });
});
