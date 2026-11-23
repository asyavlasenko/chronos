import request from 'supertest';
import app from '../src/app.js';
import Event from '../src/modules/events/event.model.js';
import { sendDueReminders } from '../src/modules/events/reminder.service.js';
import User from '../src/modules/users/user.model.js';
import { outbox } from '../src/utils/mailer.js';
import { clearDb, connectTestDb, disconnectTestDb } from './helpers/db.js';
import { createUser, getMainCalendar } from './helpers/factories.js';

const MINUTE_MS = 60 * 1000;
const NOW = new Date('2026-11-16T10:00:00.000Z');

const minutesFromNow = (minutes) => new Date(NOW.getTime() + minutes * MINUTE_MS);

const recipients = () => outbox.map((mail) => mail.to).sort();

const mailTo = (account) => outbox.find((mail) => mail.to === account.user.email);

async function createOwner(overrides) {
  const owner = await createUser(overrides);
  const main = await getMainCalendar(owner.user._id);
  return { owner, calendar: main.id };
}

const createEvent = (owner, calendar, overrides = {}) =>
  Event.create({
    title: 'Стендап',
    type: 'arrangement',
    calendar,
    creator: owner.user._id,
    startAt: minutesFromNow(10),
    endAt: minutesFromNow(40),
    ...overrides,
  });

const participant = (account, status) => ({
  user: account.user._id,
  email: account.user.email,
  status,
});

beforeAll(() => connectTestDb('reminders'));

afterEach(async () => {
  await clearDb();
  outbox.length = 0;
});

afterAll(() => disconnectTestDb());

describe('sendDueReminders', () => {
  it('надсилає нагадування авторові, коли настав час, і лише один раз', async () => {
    const { owner, calendar } = await createOwner();
    const event = await createEvent(owner, calendar, { location: 'Zoom' });

    const first = await sendDueReminders(NOW);
    const second = await sendDueReminders(minutesFromNow(1));
    const saved = await Event.findById(event.id);

    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(owner.user.email);
    expect(outbox[0].subject).toBe('Нагадування: «Стендап» через 10 хв');
    expect(outbox[0].html).toContain('Нагадування про зустріч');
    expect(outbox[0].html).toContain('Місце: Zoom');
    expect(outbox[0].html).toContain(`/calendar/day?date=2026-11-16&event=${event.id}`);
    expect(saved.reminderSentAt).toEqual(NOW);
    expect(saved.updatedAt).toEqual(event.updatedAt);
  });

  it('не надсилає зарано, без нагадування, для виконаних задач і давно розпочатих подій', async () => {
    const { owner, calendar } = await createOwner();
    await createEvent(owner, calendar, { title: 'Зарано', startAt: minutesFromNow(30) });
    await createEvent(owner, calendar, {
      title: 'Без нагадування',
      startAt: minutesFromNow(5),
      reminderMinutesBefore: null,
    });
    await createEvent(owner, calendar, {
      title: 'Виконана',
      type: 'task',
      startAt: minutesFromNow(5),
      endAt: null,
      isCompleted: true,
      completedAt: NOW,
    });
    await createEvent(owner, calendar, {
      title: 'Давно почалась',
      startAt: minutesFromNow(-10),
      endAt: minutesFromNow(20),
    });

    const sent = await sendDueReminders(NOW);

    expect(sent).toBe(0);
    expect(outbox).toHaveLength(0);
    expect(await Event.countDocuments({ reminderSentAt: null })).toBe(4);
  });

  it('враховує власний інтервал події та нагадує в момент початку', async () => {
    const { owner, calendar } = await createOwner();
    await createEvent(owner, calendar, {
      title: 'За годину',
      startAt: minutesFromNow(60),
      endAt: minutesFromNow(90),
      reminderMinutesBefore: 60,
    });
    await createEvent(owner, calendar, {
      title: 'Випити ліки',
      type: 'reminder',
      startAt: NOW,
      endAt: null,
      reminderMinutesBefore: 0,
    });
    await createEvent(owner, calendar, {
      title: 'Щойно почалась',
      startAt: minutesFromNow(-3),
      endAt: minutesFromNow(27),
    });

    const sent = await sendDueReminders(NOW);

    expect(sent).toBe(3);
    expect(outbox.map((mail) => mail.subject).sort()).toEqual([
      'Нагадування: «Випити ліки» уже зараз',
      'Нагадування: «За годину» через 1 год',
      'Нагадування: «Щойно почалась» уже зараз',
    ]);
  });

  it('пише прийнятим учасникам у їхньому часовому поясі й пропускає решту', async () => {
    const { owner, calendar } = await createOwner();
    const accepted = await createUser({ timezone: 'America/New_York' });
    const pending = await createUser();
    const declined = await createUser();
    await createEvent(owner, calendar, {
      participants: [
        participant(accepted, 'accepted'),
        participant(pending, 'pending'),
        participant(declined, 'declined'),
      ],
    });

    const sent = await sendDueReminders(NOW);

    expect(sent).toBe(2);
    expect(recipients()).toEqual([owner.user.email, accepted.user.email].sort());
    expect(mailTo(owner).html).toContain('12:10');
    expect(mailTo(accepted).html).toContain('05:10');
  });

  it('не пише тим, хто вимкнув нагадування в профілі', async () => {
    const { owner, calendar } = await createOwner();
    const guest = await createUser();
    await User.updateOne({ _id: owner.user._id }, { 'notifications.emailReminders': false });
    await createEvent(owner, calendar, { participants: [participant(guest, 'accepted')] });

    const sent = await sendDueReminders(NOW);

    expect(sent).toBe(1);
    expect(recipients()).toEqual([guest.user.email]);
  });

  it('після перенесення події нагадує ще раз, а після інших змін ні', async () => {
    const { owner, calendar } = await createOwner();
    const event = await createEvent(owner, calendar);
    await sendDueReminders(NOW);

    await request(app)
      .patch(`/api/events/${event.id}`)
      .set(owner.headers)
      .send({ title: 'Стендап команди' });
    const afterRename = await Event.findById(event.id);

    await request(app)
      .patch(`/api/events/${event.id}`)
      .set(owner.headers)
      .send({ startAt: minutesFromNow(120), endAt: minutesFromNow(150) });
    const afterMove = await Event.findById(event.id);
    const early = await sendDueReminders(minutesFromNow(60));
    const onTime = await sendDueReminders(minutesFromNow(110));

    expect(afterRename.reminderSentAt).toEqual(NOW);
    expect(afterMove.reminderSentAt).toBeNull();
    expect(early).toBe(0);
    expect(onTime).toBe(1);
    expect(outbox).toHaveLength(2);
    expect(outbox[1].subject).toBe('Нагадування: «Стендап команди» через 10 хв');
  });
});

describe('reminderMinutesBefore в API', () => {
  it('приймає null як «не нагадувати» і відхиляє некоректні значення', async () => {
    const { owner, calendar } = await createOwner();
    const body = {
      title: 'Лекція',
      type: 'reminder',
      calendar,
      startAt: minutesFromNow(60).toISOString(),
    };

    const silent = await request(app)
      .post('/api/events')
      .set(owner.headers)
      .send({ ...body, reminderMinutesBefore: null });
    const byDefault = await request(app).post('/api/events').set(owner.headers).send(body);
    const negative = await request(app)
      .post('/api/events')
      .set(owner.headers)
      .send({ ...body, reminderMinutesBefore: -5 });
    const enabled = await request(app)
      .patch(`/api/events/${silent.body.event.id}`)
      .set(owner.headers)
      .send({ reminderMinutesBefore: 30 });

    expect(silent.status).toBe(201);
    expect(silent.body.event.reminderMinutesBefore).toBeNull();
    expect(silent.body.event).not.toHaveProperty('reminderSentAt');
    expect(byDefault.body.event.reminderMinutesBefore).toBe(10);
    expect(negative.status).toBe(400);
    expect(enabled.body.event.reminderMinutesBefore).toBe(30);
  });
});
