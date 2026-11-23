import env from '../../config/env.js';
import { INVITE_KINDS, INVITE_STATUSES, PARTICIPANT_STATUSES } from '../../constants/index.js';
import { formatEventWhen, formatLead, toDateParam } from '../../utils/dates.js';
import { sendEventCancelledEmail, sendEventChangedEmail } from '../../utils/mailer.js';
import Invite from '../invites/invite.model.js';
import User from '../users/user.model.js';

const idOf = (value) => String(value?._id ?? value);

export const eventUrl = (event, timeZone) =>
  `${env.clientUrl}/calendar/day?date=${toDateParam(event.startAt, timeZone)}&event=${event.id}`;

export const describeReminder = (event, user, now) => ({
  eventId: event.id,
  type: event.type,
  title: event.title,
  when: formatEventWhen(event, user.timezone),
  lead: formatLead(event.startAt, now),
  location: event.location,
  eventUrl: eventUrl(event, user.timezone),
});

export const scheduleSnapshot = (event) => ({
  startAt: event.startAt?.getTime() ?? null,
  endAt: event.endAt?.getTime() ?? null,
  location: event.location,
});

export function isRescheduled(before, event) {
  const after = scheduleSnapshot(event);
  return Object.keys(after).some((key) => before[key] !== after[key]);
}

async function findAudience(event, actor, skippedEmails = []) {
  const invited = event.participants
    .filter((participant) => participant.status !== PARTICIPANT_STATUSES.DECLINED)
    .map((participant) => participant.email);

  const users = await User.find({
    $or: [{ email: { $in: invited } }, { _id: event.creator }],
  }).select('email timezone notifications');
  const userByEmail = new Map(users.map((user) => [user.email, user]));
  const creator = users.find((user) => user.id === idOf(event.creator));

  const emails = new Set(creator ? [creator.email, ...invited] : invited);
  emails.delete(actor.email);
  skippedEmails.forEach((email) => emails.delete(email));

  return [...emails]
    .filter((email) => userByEmail.get(email)?.notifications?.sharedCalendarEmails !== false)
    .map((email) => ({ email, timeZone: userByEmail.get(email)?.timezone ?? actor.timezone }));
}

async function deliver(audience, send) {
  const results = await Promise.allSettled(audience.map(send));
  results
    .filter((result) => result.status === 'rejected')
    .forEach((result) => {
      console.error(`[mail] Не вдалося надіслати сповіщення: ${result.reason.message}`);
    });
}

export async function notifyEventChanged(event, actor, skippedEmails = []) {
  const audience = await findAudience(event, actor, skippedEmails);
  if (audience.length === 0) return;

  const awaiting = event.participants
    .filter((participant) => participant.status === PARTICIPANT_STATUSES.PENDING)
    .map((participant) => participant.email);
  const invites = await Invite.find({
    kind: INVITE_KINDS.EVENT,
    event: event._id,
    email: { $in: awaiting },
    status: INVITE_STATUSES.PENDING,
  }).select('email token');
  const tokenByEmail = new Map(invites.map((invite) => [invite.email, invite.token]));

  await deliver(audience, ({ email, timeZone }) =>
    sendEventChangedEmail({
      to: email,
      editorName: actor.name,
      title: event.title,
      when: formatEventWhen(event, timeZone),
      location: event.location,
      eventUrl: tokenByEmail.has(email)
        ? `${env.clientUrl}/invite/${tokenByEmail.get(email)}`
        : eventUrl(event, timeZone),
    }),
  );
}

export async function notifyEventCancelled(event, actor) {
  const audience = await findAudience(event, actor);

  await deliver(audience, ({ email, timeZone }) =>
    sendEventCancelledEmail({
      to: email,
      editorName: actor.name,
      title: event.title,
      when: formatEventWhen(event, timeZone),
    }),
  );
}
