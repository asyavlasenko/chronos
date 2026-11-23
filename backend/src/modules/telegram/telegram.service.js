import mongoose from 'mongoose';
import env from '../../config/env.js';
import { EVENT_TYPES } from '../../constants/index.js';
import ApiError from '../../utils/ApiError.js';
import { localDayRange } from '../../utils/dates.js';
import { hashToken, randomToken } from '../../utils/tokens.js';
import Event from '../events/event.model.js';
import { describeReminder } from '../events/event.notifications.js';
import * as eventService from '../events/event.service.js';
import User from '../users/user.model.js';
import bot from './telegram.bot.js';
import {
  ACTIONS,
  PROFILE,
  REPLIES,
  SNOOZE_MINUTES,
  agendaMessage,
  formatTime,
  reminderMessage,
} from './telegram.messages.js';
import TelegramSnooze from './telegram.snooze.model.js';
import {
  AGENDA_WIDGET_HTML,
  WIDGET_ACTIONS,
  WIDGET_CAPTION,
  agendaState,
  parseWidgetQuery,
} from './telegram.widget.js';

const MINUTE_MS = 60 * 1000;
const LINK_TOKEN_BYTES = 16;
const LINK_TOKEN_PATTERN = /^[a-f0-9]{32}$/;
const BOT_URL = 'https://t.me';
const AGENDA_DAYS = {
  today: { label: 'Сьогодні', offset: 0 },
  tomorrow: { label: 'Завтра', offset: 1 },
};

const UNAVAILABLE = 'Telegram зараз недоступний. Спробуй пізніше';
const NOT_CONFIGURED = 'Telegram-бот не налаштований на сервері';
const NOT_CONNECTED = 'Telegram ще не підключено';

const forget = (filter) => User.updateMany(filter, { $unset: { telegram: '' } });

const findByChat = (chatId) => User.findOne({ 'telegram.chatId': chatId });

const logError = (err) => {
  if (!env.isTest) console.error(`[telegram] ${err.message}`);
};

function ensureEnabled() {
  if (!bot.isEnabled()) throw new ApiError(503, NOT_CONFIGURED);
}

async function findBotUsername() {
  try {
    return await bot.getUsername();
  } catch (err) {
    logError(err);
    throw new ApiError(502, UNAVAILABLE);
  }
}

async function deliver(user, text, options) {
  try {
    await bot.send(user.telegram.chatId, text, options);
  } catch (err) {
    if (bot.isBlocked(err)) await forget({ _id: user._id });
    throw err;
  }
}

export const canNotify = (user) => bot.isEnabled() && Boolean(user.telegram?.chatId);

export async function getStatus(user) {
  if (!bot.isEnabled()) {
    return { enabled: false, botUsername: null, isConnected: false, username: null };
  }
  return {
    enabled: true,
    botUsername: await findBotUsername(),
    isConnected: Boolean(user.telegram?.chatId),
    username: user.telegram?.username ?? null,
  };
}

export async function createLink(user, now = new Date()) {
  ensureEnabled();
  const botUsername = await findBotUsername();
  const token = randomToken(LINK_TOKEN_BYTES);
  const expiresAt = new Date(now.getTime() + env.telegram.linkTtlMinutes * MINUTE_MS);

  await User.updateOne(
    { _id: user._id },
    { $set: { 'telegram.linkToken': hashToken(token), 'telegram.linkExpiresAt': expiresAt } },
  );

  return { url: `${BOT_URL}/${botUsername}?start=${token}`, expiresAt };
}

export async function disconnect(user) {
  await forget({ _id: user._id });
}

export async function sendTest(user) {
  ensureEnabled();
  if (!user.telegram?.chatId) throw new ApiError(409, NOT_CONNECTED);

  try {
    await deliver(user, REPLIES.test);
  } catch (err) {
    if (bot.isBlocked(err)) throw new ApiError(409, NOT_CONNECTED);
    throw new ApiError(502, UNAVAILABLE);
  }
}

export function sendTelegramReminder(user, reminder) {
  const { text, buttons } = reminderMessage(reminder);
  return deliver(user, text, { buttons });
}

export async function connectChat({ chatId, username, args }, now = new Date()) {
  if (!LINK_TOKEN_PATTERN.test(args)) return REPLIES.help;

  const user = await User.findOneAndUpdate(
    { 'telegram.linkToken': hashToken(args), 'telegram.linkExpiresAt': { $gt: now } },
    {
      $set: {
        'telegram.chatId': chatId,
        'telegram.username': username,
        'telegram.connectedAt': now,
      },
      $unset: { 'telegram.linkToken': '', 'telegram.linkExpiresAt': '' },
    },
    { new: true },
  );
  if (!user) return REPLIES.expired;

  await forget({ _id: { $ne: user._id }, 'telegram.chatId': chatId });
  return REPLIES.connected(user.name);
}

export async function disconnectChat({ chatId }) {
  const result = await forget({ 'telegram.chatId': chatId });
  return result.modifiedCount > 0 ? REPLIES.disconnected : REPLIES.notConnected;
}

async function loadAgenda(user, day, now) {
  const { label, offset } = AGENDA_DAYS[day];
  const { from, to } = localDayRange(now, user.timezone, offset);
  const events = await eventService.list(user, { from, to });

  return { day, label, date: from, events, timeZone: user.timezone };
}

export async function showAgenda({ chatId }, day, now = new Date()) {
  const user = await findByChat(chatId);
  if (!user) return REPLIES.notConnected;

  const agenda = await loadAgenda(user, day, now);
  return {
    text: agendaMessage(agenda),
    widget: { html: AGENDA_WIDGET_HTML, chatData: agendaState(agenda), caption: WIDGET_CAPTION },
  };
}

async function toggleTask(user, id) {
  if (!mongoose.isValidObjectId(id)) return;
  const event = await Event.findById(id);
  if (!event || event.type !== EVENT_TYPES.TASK) return;

  try {
    await eventService.update(user, id, { isCompleted: !event.isCompleted });
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
  }
}

export async function handleWidgetQuery({ chatId, data }, now = new Date()) {
  const { action, day, id } = parseWidgetQuery(data);
  const user = await findByChat(chatId);
  if (!user || !day) return null;

  if (action === WIDGET_ACTIONS.DONE) await toggleTask(user, id);
  return agendaState(await loadAgenda(user, day, now));
}

async function findReminderTarget(chatId, id) {
  if (!mongoose.isValidObjectId(id)) return {};
  const [user, event] = await Promise.all([findByChat(chatId), Event.findById(id)]);
  return user && event ? { user, event } : {};
}

export async function snoozeReminder({ chatId, id }, now = new Date()) {
  const { user, event } = await findReminderTarget(chatId, id);
  if (!user || event.isCompleted) return { text: REPLIES.unavailable, isHandled: true };

  const dueAt = new Date(now.getTime() + SNOOZE_MINUTES * MINUTE_MS);
  await TelegramSnooze.updateOne(
    { user: user._id, event: event._id },
    { $set: { dueAt } },
    { upsert: true },
  );

  return { text: REPLIES.snoozed(formatTime(dueAt, user.timezone)), isHandled: true };
}

export async function completeTask({ chatId, id }) {
  const { user, event } = await findReminderTarget(chatId, id);
  if (!user || event.type !== EVENT_TYPES.TASK) {
    return { text: REPLIES.unavailable, isHandled: true };
  }

  try {
    await eventService.update(user, id, { isCompleted: true });
  } catch (err) {
    if (err instanceof ApiError) return { text: err.message, isHandled: false };
    throw err;
  }

  await TelegramSnooze.deleteOne({ user: user._id, event: event._id });
  return { text: REPLIES.done, isHandled: true };
}

async function remindAgain(snooze, now) {
  const [user, event] = await Promise.all([
    User.findById(snooze.user),
    Event.findById(snooze.event),
  ]);
  if (!user || !event || event.isCompleted || !canNotify(user)) return 0;

  try {
    await sendTelegramReminder(user, describeReminder(event, user, now));
    return 1;
  } catch (err) {
    logError(err);
    return 0;
  }
}

export async function sendSnoozedReminders(now = new Date(), sent = 0) {
  const snooze = await TelegramSnooze.findOneAndDelete(
    { dueAt: { $lte: now } },
    { sort: { dueAt: 1 } },
  );
  if (!snooze) return sent;

  return sendSnoozedReminders(now, sent + (await remindAgain(snooze, now)));
}

export function startTelegramBot() {
  if (env.isTest || !bot.isEnabled()) return;
  bot.setup(PROFILE).catch(logError);
  bot.listen({
    commands: {
      start: connectChat,
      stop: disconnectChat,
      today: (input) => showAgenda(input, 'today'),
      tomorrow: (input) => showAgenda(input, 'tomorrow'),
      help: () => REPLIES.help,
    },
    actions: {
      [ACTIONS.DONE]: completeTask,
      [ACTIONS.SNOOZE]: snoozeReminder,
    },
    widgetQuery: handleWidgetQuery,
    fallback: REPLIES.help,
  });
}

export function stopTelegramBot() {
  bot.stop();
}
