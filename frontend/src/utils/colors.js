export const COLOR_KEYS = ['graphite', 'blue', 'purple', 'green', 'orange', 'pink'];

export const COLOR_VARS = {
  graphite: { base: 'var(--cal-main)', tint: 'var(--cal-main-tint)', text: 'var(--cal-main-text)' },
  blue: {
    base: 'var(--member-blue)',
    tint: 'var(--member-blue-tint)',
    text: 'var(--member-blue-text)',
  },
  purple: {
    base: 'var(--cal-study)',
    tint: 'var(--cal-study-tint)',
    text: 'var(--cal-study-text)',
  },
  green: { base: 'var(--cal-sport)', tint: 'var(--cal-sport-tint)', text: 'var(--cal-sport-text)' },
  orange: { base: 'var(--cal-work)', tint: 'var(--cal-work-tint)', text: 'var(--cal-work-text)' },
  pink: {
    base: 'var(--cal-volunteer)',
    tint: 'var(--cal-volunteer-tint)',
    text: 'var(--cal-volunteer-text)',
  },
  holidays: {
    base: 'var(--cal-holidays)',
    tint: 'var(--cal-holidays-tint)',
    text: 'var(--cal-holidays-text)',
  },
};

export const COLOR_HEX = {
  graphite: '#111827',
  blue: '#2563EB',
  purple: '#6D5BD0',
  green: '#059669',
  orange: '#D97706',
  pink: '#DB2777',
  holidays: '#2563EB',
};

export const COLOR_LABELS = {
  graphite: 'Графіт',
  blue: 'Синій',
  purple: 'Фіолетовий',
  green: 'Зелений',
  orange: 'Помаранчевий',
  pink: 'Рожевий',
};

export const MEMBER_COLOR_VARS = {
  graphite: {
    base: 'var(--member-graphite)',
    tint: 'var(--cal-main-tint)',
    text: 'var(--member-graphite)',
  },
  blue: {
    base: 'var(--member-blue)',
    tint: 'var(--member-blue-tint)',
    text: 'var(--member-blue-text)',
  },
  purple: {
    base: 'var(--member-purple)',
    tint: 'var(--member-purple-tint)',
    text: 'var(--member-purple-text)',
  },
  green: {
    base: 'var(--member-green)',
    tint: 'var(--member-green-tint)',
    text: 'var(--member-green-text)',
  },
  orange: {
    base: 'var(--member-orange)',
    tint: 'var(--cal-work-tint)',
    text: 'var(--cal-work-text)',
  },
  pink: {
    base: 'var(--member-pink)',
    tint: 'var(--cal-volunteer-tint)',
    text: 'var(--cal-volunteer-text)',
  },
  holidays: COLOR_VARS.holidays,
};

export const MEMBER_COLOR_HEX = {
  graphite: '#374151',
  blue: '#2563EB',
  purple: '#7C3AED',
  green: '#059669',
  orange: '#EA580C',
  pink: '#DB2777',
  holidays: '#2563EB',
};

export const colorVars = (key, palette = 'calendar') => {
  const table = palette === 'member' ? MEMBER_COLOR_VARS : COLOR_VARS;
  return table[key] || table.graphite;
};

export const colorHex = (key, palette = 'calendar') => {
  const table = palette === 'member' ? MEMBER_COLOR_HEX : COLOR_HEX;
  return table[key] || table.graphite;
};

export function resolveEventColor(event, calendar) {
  if (event?.color) return { key: event.color, palette: 'calendar' };
  if (calendar?.isShared && calendar.members) {
    const author = calendar.members.find((m) => m.user === event?.creator);
    if (author?.color) return { key: author.color, palette: 'member' };
  }
  return { key: calendar?.color || 'graphite', palette: 'calendar' };
}

export const resolveEventColorKey = (event, calendar) => resolveEventColor(event, calendar).key;

export const resolveEventColors = (event, calendar) => {
  const { key, palette } = resolveEventColor(event, calendar);
  return colorVars(key, palette);
};

const NOTE_COLORS = {
  base: 'var(--sticker-main)',
  tint: 'var(--sticker-main-tint)',
  text: 'var(--sticker-main-text)',
};

export const stickerColors = (event, calendar) =>
  resolveEventColorKey(event, calendar) === 'graphite'
    ? NOTE_COLORS
    : resolveEventColors(event, calendar);
