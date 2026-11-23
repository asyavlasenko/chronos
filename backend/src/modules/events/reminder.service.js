import env from '../../config/env.js';
import { PARTICIPANT_STATUSES } from '../../constants/index.js';
import { sendReminderEmail } from '../../utils/mailer.js';
import {
  canNotify,
  sendSnoozedReminders,
  sendTelegramReminder,
} from '../telegram/telegram.service.js';
import User from '../users/user.model.js';
import Event from './event.model.js';
import { describeReminder } from './event.notifications.js';

const MINUTE_MS = 60 * 1000;
const TICK_MS = MINUTE_MS;
const GRACE_MS = 5 * MINUTE_MS;
const MAX_LEAD_MS = 7 * 24 * 60 * MINUTE_MS;
const BATCH_LIMIT = 200;

let timer = null;
let isRunning = false;

const findDue = (now) =>
  Event.find({
    reminderSentAt: null,
    reminderMinutesBefore: { $ne: null },
    isCompleted: false,
    isFloating: { $ne: true },
    startAt: {
      $gt: new Date(now.getTime() - GRACE_MS),
      $lte: new Date(now.getTime() + MAX_LEAD_MS),
    },
    $expr: {
      $lte: [
        { $subtract: ['$startAt', { $multiply: ['$reminderMinutesBefore', MINUTE_MS] }] },
        now,
      ],
    },
  })
    .sort({ startAt: 1, _id: 1 })
    .limit(BATCH_LIMIT);

async function claim(event, now) {
  const result = await Event.updateOne(
    { _id: event._id, reminderSentAt: null },
    { $set: { reminderSentAt: now } },
    { timestamps: false },
  );
  return result.modifiedCount === 1;
}

function findRecipients(event) {
  const accepted = event.participants
    .filter((participant) => participant.status === PARTICIPANT_STATUSES.ACCEPTED)
    .map((participant) => participant.user)
    .filter(Boolean);

  return User.find({ _id: { $in: [event.creator, ...accepted] } }).select(
    'email timezone notifications telegram',
  );
}

function deliveriesFor(user, event, now) {
  const reminder = describeReminder(event, user, now);
  const deliveries = [];
  if (user.notifications.emailReminders) {
    deliveries.push(sendReminderEmail({ to: user.email, ...reminder }));
  }
  if (canNotify(user)) deliveries.push(sendTelegramReminder(user, reminder));
  return deliveries;
}

async function remind(event, now) {
  const recipients = await findRecipients(event);
  const results = await Promise.allSettled(
    recipients.flatMap((user) => deliveriesFor(user, event, now)),
  );

  results
    .filter((result) => result.status === 'rejected')
    .forEach((result) => {
      console.error(`[reminders] Не вдалося надіслати нагадування: ${result.reason.message}`);
    });

  return results.filter((result) => result.status === 'fulfilled').length;
}

export async function sendDueReminders(now = new Date()) {
  const due = await findDue(now);

  return due.reduce(async (previous, event) => {
    const sent = await previous;
    if (!(await claim(event, now))) return sent;
    return sent + (await remind(event, now));
  }, Promise.resolve(0));
}

async function tick() {
  if (isRunning) return;
  isRunning = true;
  try {
    const sent = (await sendDueReminders()) + (await sendSnoozedReminders());
    if (sent > 0) console.log(`[reminders] Надіслано нагадувань: ${sent}`);
  } catch (err) {
    console.error(`[reminders] ${err.message}`);
  } finally {
    isRunning = false;
  }
}

export function startReminderScheduler() {
  if (env.isTest || timer) return;
  timer = setInterval(tick, TICK_MS);
  timer.unref();
  tick();
}

export function stopReminderScheduler() {
  clearInterval(timer);
  timer = null;
}
