export const ROLES = Object.freeze({
  OWNER: 'owner',
  EDITOR: 'editor',
  VIEWER: 'viewer',
});

export const ROLE_RANK = Object.freeze({
  [ROLES.VIEWER]: 1,
  [ROLES.EDITOR]: 2,
  [ROLES.OWNER]: 3,
});

export const EVENT_TYPES = Object.freeze({
  ARRANGEMENT: 'arrangement',
  REMINDER: 'reminder',
  TASK: 'task',
});

export const PRIORITIES = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

export const PARTICIPANT_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
});

export const INVITE_KINDS = Object.freeze({
  EVENT: 'event',
  CALENDAR: 'calendar',
});

export const INVITE_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
});

export const INVITE_TTL_DAYS = 7;

export const COLOR_KEYS = Object.freeze(['graphite', 'blue', 'purple', 'green', 'orange', 'pink']);

export const HOLIDAYS_CALENDAR_ID = 'holidays';

export const BOARD_MODULES = Object.freeze([
  'floating',
  'next',
  'tasks',
  'load',
  'shared',
  'invites',
  'holidays',
  'calendars',
]);

export const TIME_FORMATS = Object.freeze(['24h', '12h']);

export const THEME_COLORS = Object.freeze([
  'graphite',
  'blue',
  'lavender',
  'pink',
  'coral',
  'sand',
  'mint',
  'teal',
]);
export const THEME_MODES = Object.freeze(['light', 'dark', 'system']);
export const WEEK_STARTS = Object.freeze({ MONDAY: 1, SUNDAY: 0 });
