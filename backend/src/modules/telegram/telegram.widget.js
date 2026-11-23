import { readFileSync } from 'node:fs';
import { EVENT_TYPES } from '../../constants/index.js';
import { agendaTime, dayOf } from './telegram.messages.js';

export const AGENDA_WIDGET_HTML = readFileSync(
  new URL('./agenda.widget.html', import.meta.url),
  'utf8',
);
export const WIDGET_CAPTION = 'Розклад із Chronos';
export const WIDGET_ACTIONS = Object.freeze({ REFRESH: 'ref', DAY: 'day', DONE: 'done' });
export const STATE_LIMIT_BYTES = 1024;

const QUERY_SEPARATOR = ':';
const TITLE_LIMIT = 40;
const ELLIPSIS = '…';
const DAY_CODES = { today: 't', tomorrow: 'm' };
const KIND_CODES = {
  [EVENT_TYPES.ARRANGEMENT]: 'a',
  [EVENT_TYPES.REMINDER]: 'r',
  [EVENT_TYPES.TASK]: 't',
};

const shorten = (title) =>
  title.length > TITLE_LIMIT ? `${title.slice(0, TITLE_LIMIT - 1)}${ELLIPSIS}` : title;

function toRow(event, timeZone) {
  const row = [agendaTime(event, timeZone), shorten(event.title), KIND_CODES[event.type]];
  return event.type === EVENT_TYPES.TASK ? [...row, event.id, event.isCompleted ? 1 : 0] : row;
}

export function agendaState({ day, date, events, timeZone }) {
  const rows = events.map((event) => toRow(event, timeZone));
  const serialize = (count) =>
    JSON.stringify({
      d: DAY_CODES[day],
      h: dayOf(date, timeZone),
      e: rows.slice(0, count),
      m: rows.length - count,
    });
  const counts = rows.map((row, index) => rows.length - index);
  const fitting = counts.find((count) => Buffer.byteLength(serialize(count)) <= STATE_LIMIT_BYTES);

  return serialize(fitting ?? 0);
}

export function parseWidgetQuery(data = '') {
  const [action, code, id] = data.split(QUERY_SEPARATOR);
  const day = Object.keys(DAY_CODES).find((key) => DAY_CODES[key] === code) ?? null;
  return { action, day, id };
}
