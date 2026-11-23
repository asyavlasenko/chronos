import { Bot, TelegramApiError } from 'node-telegram-bot-api';
import env from '../../config/env.js';

const FORBIDDEN = 403;
const PRIVATE_CHAT = 'private';
const PARSE_MODE = 'HTML';
const ACTION_SEPARATOR = ':';
const ALLOWED_UPDATES = ['message', 'callback_query', 'widget_query'];
const NOT_MODIFIED = /not modified/i;
const WIDGETS_CLOSED = /WIDGET_NOT_ALLOWED/;
const WIDGET_RETRY_MS = 60 * 60 * 1000;
const FORMAT = { parse_mode: PARSE_MODE, link_preview_options: { is_disabled: true } };

let instance = null;
let username = null;
let widgetsClosedUntil = 0;

function getInstance() {
  if (!instance) instance = new Bot(env.telegram.botToken);
  return instance;
}

const isPrivate = (ctx) => ctx.chat?.type === PRIVATE_CHAT;

const logError = (err) => {
  console.error(`[telegram] ${err.message}`);
};

const toButton = ({ text, url, action, id }) =>
  url ? { text, url } : { text, callback_data: `${action}${ACTION_SEPARATOR}${id}` };

const toKeyboard = (buttons) => ({ inline_keyboard: buttons.map((row) => row.map(toButton)) });

async function getUsername() {
  if (!username) {
    const me = await getInstance().api.getMe();
    username = me.username;
  }
  return username;
}

function send(chatId, text, { buttons } = {}) {
  return getInstance().api.sendMessage({
    chat_id: chatId,
    text,
    ...FORMAT,
    ...(buttons ? { reply_markup: toKeyboard(buttons) } : {}),
  });
}

function sendWidget(chatId, { html, chatData, caption }) {
  return getInstance().api.sendWidget({
    chat_id: chatId,
    html,
    chat_data: chatData,
    caption,
    allow_queries: true,
  });
}

const ignoreNotModified = (err) => {
  if (!NOT_MODIFIED.test(err.description ?? '')) throw err;
};

async function setup({ commands, description, shortDescription }) {
  const { api } = getInstance();
  await api.setMyCommands({ commands });
  await api.setMyDescription({ description });
  await api.setMyShortDescription({ short_description: shortDescription });
}

function listen({ commands, actions, widgetQuery, fallback }) {
  const telegram = getInstance();
  if (telegram.isRunning()) return;

  Object.entries(commands).forEach(([name, handle]) => {
    telegram.command(name, async (ctx) => {
      if (!isPrivate(ctx)) return;
      const reply = await handle({
        chatId: ctx.chatId,
        username: ctx.from?.username ?? null,
        args: ctx.match,
      });
      if (typeof reply === 'string') {
        await ctx.reply(reply, FORMAT);
        return;
      }

      if (Date.now() < widgetsClosedUntil) {
        await ctx.reply(reply.text, FORMAT);
        return;
      }

      try {
        await sendWidget(ctx.chatId, reply.widget);
      } catch (err) {
        logError(err);
        if (WIDGETS_CLOSED.test(err.description ?? '')) {
          widgetsClosedUntil = Date.now() + WIDGET_RETRY_MS;
        }
        await ctx.reply(reply.text, FORMAT);
      }
    });
  });

  telegram.on('widget_query', async (ctx) => {
    const query = ctx.update.widget_query;
    let state = null;
    try {
      state = await widgetQuery({ chatId: query.from.id, data: query.data });
    } finally {
      await ctx.api.answerWidgetQuery({
        widget_query_id: query.id,
        ...(state ? { data: state } : {}),
      });
    }

    if (state && query.chat && query.message_id) {
      await ctx.api
        .editMessageWidgetData({
          chat_id: query.chat.id,
          message_id: query.message_id,
          chat_data: state,
        })
        .catch(ignoreNotModified);
    }
  });

  telegram.on('callback_query', async (ctx) => {
    const { data = '', message } = ctx.callbackQuery;
    const [name, id] = data.split(ACTION_SEPARATOR);
    const handle = actions[name];
    if (!handle || !message) {
      await ctx.answerCallbackQuery();
      return;
    }

    const result = await handle({ chatId: message.chat.id, id });
    await ctx.answerCallbackQuery({ text: result.text });
    if (result.isHandled) {
      await ctx.api.editMessageReplyMarkup({
        chat_id: message.chat.id,
        message_id: message.message_id,
      });
    }
  });

  telegram.on('message', async (ctx) => {
    if (isPrivate(ctx)) await ctx.reply(fallback, FORMAT);
  });
  telegram.catch(logError);
  telegram
    .startPolling(undefined, { allowedUpdates: ALLOWED_UPDATES, onError: logError })
    .catch(logError);
}

function stop() {
  if (instance?.isRunning()) instance.stop();
}

const bot = {
  isEnabled: () => Boolean(env.telegram.botToken),
  isBlocked: (err) => err instanceof TelegramApiError && err.errorCode === FORBIDDEN,
  getUsername,
  send,
  sendWidget,
  setup,
  listen,
  stop,
};

export default bot;
