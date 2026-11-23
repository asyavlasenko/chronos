export const THEMES = [
  { key: 'graphite', label: 'Графіт', hue: 220, chroma: 0.28, accentHue: 221, accentChroma: 1 },
  { key: 'blue', label: 'Небо', hue: 217, chroma: 1 },
  { key: 'lavender', label: 'Лаванда', hue: 262, chroma: 0.9 },
  { key: 'pink', label: 'Півонія', hue: 332, chroma: 0.95 },
  { key: 'coral', label: 'Корал', hue: 14, chroma: 1 },
  { key: 'sand', label: 'Пісок', hue: 40, chroma: 0.95 },
  { key: 'mint', label: "М'ята", hue: 158, chroma: 0.85 },
  { key: 'teal', label: 'Лагуна', hue: 190, chroma: 0.95 },
];

export const MODES = [
  { value: 'light', label: 'Світла' },
  { value: 'dark', label: 'Темна' },
  { value: 'system', label: 'Як у системі' },
];

export const DEFAULT_THEME = { color: 'graphite', mode: 'light' };

const STORAGE_KEY = 'chronos-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const findTheme = (key) => THEMES.find((theme) => theme.key === key) || THEMES[0];

const isKnownMode = (mode) => MODES.some((item) => item.value === mode);

export const normalizeTheme = (theme) => ({
  color: findTheme(theme?.color).key,
  mode: isKnownMode(theme?.mode) ? theme.mode : DEFAULT_THEME.mode,
});

export const sameTheme = (a, b) => a.color === b.color && a.mode === b.mode;

export const prefersDark = () => window.matchMedia(DARK_QUERY).matches;

export const isDarkMode = (mode) => mode === 'dark' || (mode === 'system' && prefersDark());

export function watchSystemScheme(onChange) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function painter({ hue, chroma, accentHue = hue, accentChroma = chroma }) {
  const tone = (saturation, lightness) =>
    `hsl(${hue} ${Math.round(Math.min(100, saturation * chroma))}% ${lightness}%)`;
  const accent = (saturation, lightness) =>
    `hsl(${accentHue} ${Math.round(Math.min(100, saturation * accentChroma))}% ${lightness}%)`;
  return { tone, accent };
}

function lightTokens(theme) {
  const { tone, accent } = painter(theme);
  const dark = tone(46, 24);
  return {
    '--bg': tone(40, 96),
    '--card': '#fff',
    '--card-muted': tone(36, 98.2),
    '--dark': dark,
    '--ink': tone(35, 13),
    '--ink-secondary': tone(12, 43),
    '--ink-tertiary': tone(12, 62),
    '--ink-body': tone(18, 28),
    '--line': tone(28, 89),
    '--line-soft': tone(30, 94),
    '--line-grid': tone(30, 94.5),
    '--line-strong': tone(22, 82),
    '--accent': accent(72, 46),
    '--accent-strong': accent(76, 38),
    '--accent-tint': accent(85, 94.5),
    '--accent-tint-soft': accent(80, 97.8),
    '--accent-dashed': accent(75, 76),
    '--accent-dot': accent(85, 70),
    '--ring-today': `0 0 0 2px ${dark}`,
  };
}

const DARK_CALENDARS = {
  '--cal-main': 'hsl(220 9% 72%)',
  '--cal-main-tint': 'hsl(220 10% 20%)',
  '--cal-main-text': 'hsl(220 14% 90%)',
  '--cal-study': 'hsl(250 70% 72%)',
  '--cal-study-tint': 'hsl(250 30% 22%)',
  '--cal-study-text': 'hsl(250 85% 84%)',
  '--cal-work': 'hsl(35 90% 60%)',
  '--cal-work-tint': 'hsl(35 45% 18%)',
  '--cal-work-text': 'hsl(35 90% 72%)',
  '--cal-sport': 'hsl(160 60% 50%)',
  '--cal-sport-tint': 'hsl(160 40% 15%)',
  '--cal-sport-text': 'hsl(160 60% 68%)',
  '--cal-holidays': 'hsl(221 90% 68%)',
  '--cal-holidays-tint': 'hsl(221 45% 20%)',
  '--cal-holidays-text': 'hsl(221 95% 80%)',
  '--cal-volunteer': 'hsl(330 80% 68%)',
  '--cal-volunteer-tint': 'hsl(330 40% 20%)',
  '--cal-volunteer-text': 'hsl(330 85% 80%)',
  '--member-blue': 'hsl(221 90% 68%)',
  '--member-blue-tint': 'hsl(221 45% 20%)',
  '--member-blue-text': 'hsl(221 95% 80%)',
  '--member-purple': 'hsl(262 85% 74%)',
  '--member-purple-tint': 'hsl(262 35% 22%)',
  '--member-purple-text': 'hsl(262 90% 84%)',
  '--member-green': 'hsl(160 60% 50%)',
  '--member-green-tint': 'hsl(160 40% 15%)',
  '--member-green-text': 'hsl(160 60% 68%)',
  '--member-orange': 'hsl(22 90% 62%)',
  '--member-pink': 'hsl(330 80% 68%)',
  '--member-graphite': 'hsl(220 9% 70%)',
  '--sticker-main': 'hsl(45 90% 58%)',
  '--sticker-main-tint': 'hsl(45 45% 17%)',
  '--sticker-main-text': 'hsl(45 90% 78%)',
  '--danger': 'hsl(0 85% 72%)',
  '--danger-tint': 'hsl(0 45% 19%)',
  '--success': 'hsl(158 60% 62%)',
  '--success-tint': 'hsl(158 40% 15%)',
  '--overlay': 'rgba(0, 0, 0, 0.55)',
  '--dark-soft': 'rgba(0, 0, 0, 0.1)',
  '--shadow-modal': '0 24px 60px rgba(0, 0, 0, 0.55)',
  '--shadow-fab': '0 12px 28px rgba(0, 0, 0, 0.5)',
};

function darkTokens(theme) {
  const { tone, accent } = painter(theme);
  const primary = tone(62, 76);
  return {
    ...DARK_CALENDARS,
    '--bg': tone(22, 8.5),
    '--card': tone(20, 12.5),
    '--card-muted': tone(20, 15),
    '--dark': primary,
    '--ink-on-dark': tone(40, 11),
    '--ink': tone(25, 93),
    '--ink-secondary': tone(12, 68),
    '--ink-tertiary': tone(10, 50),
    '--ink-body': tone(15, 82),
    '--line': tone(16, 23),
    '--line-soft': tone(16, 18.5),
    '--line-grid': tone(16, 17),
    '--line-strong': tone(16, 32),
    '--accent': accent(85, 70),
    '--accent-strong': accent(90, 78),
    '--accent-tint': accent(45, 21),
    '--accent-tint-soft': accent(35, 15.5),
    '--accent-dashed': accent(50, 42),
    '--accent-dot': accent(85, 70),
    '--ring-today': `0 0 0 2px ${primary}`,
  };
}

const MANAGED_TOKENS = Object.keys({ ...lightTokens(THEMES[0]), ...darkTokens(THEMES[0]) });

export function buildTokens(theme, isDark) {
  const { color } = normalizeTheme(theme);
  if (isDark) return darkTokens(findTheme(color));
  return color === DEFAULT_THEME.color ? {} : lightTokens(findTheme(color));
}

export function swatchOf(key, isDark) {
  const { tone, accent } = painter(findTheme(key));
  if (isDark) return { surface: tone(20, 16), primary: tone(62, 76) };
  if (key === DEFAULT_THEME.color) return { surface: '#f3f4f6', primary: '#111827' };
  return { surface: accent(85, 92), primary: tone(46, 24) };
}

export function applyTheme(theme) {
  const next = normalizeTheme(theme);
  const isDark = isDarkMode(next.mode);
  const tokens = buildTokens(next, isDark);
  const { style } = document.documentElement;

  MANAGED_TOKENS.forEach((name) => style.removeProperty(name));
  Object.entries(tokens).forEach(([name, value]) => style.setProperty(name, value));
  style.colorScheme = isDark ? 'dark' : 'light';
}

export function loadStoredTheme() {
  try {
    return normalizeTheme(JSON.parse(window.localStorage.getItem(STORAGE_KEY)));
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeTheme(theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeTheme(theme)));
    return true;
  } catch {
    return false;
  }
}
