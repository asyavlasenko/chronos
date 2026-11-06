// Спільні перелічення. Використовуй їх у моделях, валідації й сервісах замість «магічних» рядків.

export const ROLES = Object.freeze({
  OWNER: 'owner',
  EDITOR: 'editor',
  VIEWER: 'viewer',
});

// Ранг ролі для перевірки «не нижче ніж»: calendarAccess(ROLES.EDITOR) пропускає editor і owner
export const ROLE_RANK = Object.freeze({
  [ROLES.VIEWER]: 1,
  [ROLES.EDITOR]: 2,
  [ROLES.OWNER]: 3,
});

export const EVENT_TYPES = Object.freeze({
  ARRANGEMENT: 'arrangement', // зустріч: startAt + endAt
  REMINDER: 'reminder', // нагадування: лише startAt
  TASK: 'task', // задача: startAt = дедлайн, isCompleted
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

// Ключі кольорів. Фронт мапить їх на змінні з design/tokens.css (frontend/src/utils/colors.js)
export const COLOR_KEYS = Object.freeze(['graphite', 'blue', 'purple', 'green', 'orange', 'pink']);

// Id віртуального календаря свят (не зберігається в БД)
export const HOLIDAYS_CALENDAR_ID = 'holidays';

export const TIME_FORMATS = Object.freeze(['24h', '12h']);
export const WEEK_STARTS = Object.freeze({ MONDAY: 1, SUNDAY: 0 });
