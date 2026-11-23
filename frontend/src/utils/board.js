import { MONTHS_GENITIVE, addDays, startOfDay, toDate } from './dates';

export const BOARD_DAYS = 14;
export const ANCHOR_OFFSET_DAYS = 2;
export const SHIFT_DAYS = 7;
export const ZOOM_LEVELS = [60, 100, 160];
export const DEFAULT_ZOOM_INDEX = 1;
export const SNAP_MINUTES = 15;
export const MIN_STICKER_WIDTH = 120;
export const STICKER_GAP = 8;
export const LANE_HEIGHT = 108;
export const STICKER_HEIGHT = 92;
export const MIN_LANES = 4;
export const LANES_PADDING = 14;
export const NOW_SCROLL_OFFSET = 200;
export const DRAG_THRESHOLD = 6;
export const TASK_MIME = 'application/x-chronos-task';
export const MAX_STROKE_POINTS = 2000;
export const MIN_POINT_DISTANCE = 2;
export const MAX_STROKE_Y = 4000;
export const STROKE_WIDTHS = [2, 4, 8];

const MS_MINUTE = 60 * 1000;
const MS_HOUR = 60 * MS_MINUTE;
const MAX_TILT_DEG = 1.5;
const TILT_STEPS = 30;

export function timeToX(date, rangeStart, hourWidth) {
  return ((toDate(date).getTime() - rangeStart.getTime()) / MS_HOUR) * hourWidth;
}

export function xToTime(x, rangeStart, hourWidth) {
  return new Date(rangeStart.getTime() + (x / hourWidth) * MS_HOUR);
}

export function getBoardRange(anchor) {
  const rangeStart = addDays(startOfDay(anchor), -ANCHOR_OFFSET_DAYS);
  return { rangeStart, rangeEnd: addDays(rangeStart, BOARD_DAYS) };
}

export function snapTime(date, stepMinutes = SNAP_MINUTES) {
  const step = stepMinutes * MS_MINUTE;
  return new Date(Math.round(toDate(date).getTime() / step) * step);
}

export function floorTime(date, stepMinutes = SNAP_MINUTES) {
  const step = stepMinutes * MS_MINUTE;
  return new Date(Math.floor(toDate(date).getTime() / step) * step);
}

export function clampTime(date, min, max) {
  const time = Math.min(Math.max(toDate(date).getTime(), min.getTime()), max.getTime());
  return new Date(time);
}

export function buildDays(rangeStart, hourWidth) {
  return Array.from({ length: BOARD_DAYS }, (_, index) => {
    const date = addDays(rangeStart, index);
    const left = timeToX(date, rangeStart, hourWidth);
    return { date, left, width: timeToX(addDays(date, 1), rangeStart, hourWidth) - left };
  });
}

export function buildHourTicks(rangeStart, rangeEnd) {
  const count = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / MS_HOUR);
  return Array.from(
    { length: count },
    (_, index) => new Date(rangeStart.getTime() + index * MS_HOUR),
  );
}

export function formatHourTick(date, timeFormat = '24h') {
  const hours = date.getHours();
  if (timeFormat === '12h') return `${hours % 12 || 12} ${hours < 12 ? 'AM' : 'PM'}`;
  return String(hours).padStart(2, '0');
}

export function formatBoardRange(rangeStart, rangeEnd) {
  const last = addDays(rangeEnd, -1);
  const lastLabel = `${last.getDate()} ${MONTHS_GENITIVE[last.getMonth()]}`;
  if (rangeStart.getMonth() === last.getMonth()) return `${rangeStart.getDate()} – ${lastLabel}`;
  return `${rangeStart.getDate()} ${MONTHS_GENITIVE[rangeStart.getMonth()]} – ${lastLabel}`;
}

export function packLanes(events, rangeStart, rangeEnd, hourWidth) {
  const boardWidth = timeToX(rangeEnd, rangeStart, hourWidth);
  const laneEnds = [];
  const stickers = [...events]
    .sort((a, b) => toDate(a.startAt) - toDate(b.startAt))
    .map((event) => {
      const start = timeToX(event.startAt, rangeStart, hourWidth);
      const end = event.endAt ? timeToX(event.endAt, rangeStart, hourWidth) : start;
      const left = Math.min(Math.max(start, 0), boardWidth);
      const width = Math.max(end - left, MIN_STICKER_WIDTH);
      const firstFit = laneEnds.findIndex((laneEnd) => laneEnd + STICKER_GAP <= left);
      const lane = firstFit === -1 ? laneEnds.length : firstFit;
      laneEnds[lane] = left + width;
      return { event, left, width, lane };
    });
  return { stickers, laneCount: laneEnds.length };
}

export function lanesHeight(laneCount) {
  return LANES_PADDING * 2 + Math.max(laneCount, MIN_LANES) * LANE_HEIGHT;
}

export function laneTop(lane) {
  return LANES_PADDING + lane * LANE_HEIGHT;
}

export function laneAtY(y, laneCount) {
  const lane = Math.floor((y - LANES_PADDING) / LANE_HEIGHT);
  return Math.min(Math.max(lane, 0), Math.max(laneCount, MIN_LANES) - 1);
}

export function stickerTilt(id) {
  const hash = [...String(id)].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 9973, 7);
  return ((hash % (TILT_STEPS + 1)) / TILT_STEPS) * 2 * MAX_TILT_DEG - MAX_TILT_DEG;
}

export function strokeToPath(points, rangeStart, hourWidth) {
  return points
    .map(([time, y], index) => {
      const x = Math.round(timeToX(time, rangeStart, hourWidth) * 10) / 10;
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
    })
    .join(' ');
}

export function toStrokePoint(x, y, rangeStart, hourWidth) {
  const clampedY = Math.min(Math.max(y, 0), MAX_STROKE_Y);
  return [Math.round(xToTime(x, rangeStart, hourWidth).getTime()), Math.round(clampedY * 10) / 10];
}
