# Chronos — frontend

React 18 + Vite + React Router 6. Верстка — CSS Modules зі змінними з `src/styles/tokens.css`
(копія `design/tokens.css`). Джерело правди для вигляду — `design/screens/*.html` і `design/README.md`.

## Правила верстки

- Тільки змінні з `tokens.css`: кольори, шрифти (`--fs-*`, `--fw-*`), радіуси (`--r-*`), розміри (`--control-h*`, `--hour-h-*`).
  Виняток — кілька кольорів, яких немає в токенах і які є в мокапах: `#d1d5db` (рамка нагадувань/пунктир), `#60A5FA` (крапка в темному чіпі).
- Кожен компонент — пара `Name.jsx` + `Name.module.css`. Інлайнові стилі з мокапів переносимо в класи; інлайн лишається лише для
  обчислюваних значень (top/height у сітці, кольори календаря через `colorVars(key)`).
- Шапка файлу: `// Дизайн: design/screens/NN-xxx.html`.
- Airbnb ESLint: `propTypes` для всіх пропсів, дефолти — через параметри за замовчуванням (`{ size = 'md' }`),
  без вкладених тернарників, клікабельне — `<button>`, не `<div onClick>`. Перед завершенням: `npm run lint` і `npm run build`.
- Адаптив: бічні панелі (`aside`) стають на всю ширину нижче 1000px (`flex-wrap`), мобільний — нижче 768px
  (`MobileTabBar`, `Fab` і компактний `AppHeader` вмикаються самі в `PageShell`).
- Акцент `--accent` лише для «сьогодні», лінії «зараз», фокусу й посилань. Головні кнопки темні, вторинні білі, усе — пілюлі.

## Дані (поки мок, формат = docs/api.md)

| Хук | Що повертає |
|---|---|
| `useAuth()` | `{ user, login, logout, updateUser }`. `user`: name, firstName, email, country, timezone, defaultArrangementDuration (60), weekStartsOn (1), timeFormat ('24h'), showWeekNumbers, showHolidays, notifications |
| `useCalendars()` | `{ calendars, byId, getCalendar(id), visibleIds, toggleVisibility(id), updateCalendar(id, patch), createCalendar(dto), removeCalendar(id) }`. Календар: id, name, description, color (ключ), isMain, isShared, isReadOnly ('holidays'), isHidden, myRole, myColor, members[{ user, name, email, role, color }], eventsCount |
| `useEvents({ from, to, calendarIds, types, q, includeHidden })` | `{ events, holidayEvents, holidays, invites, pendingInvites, getEvent(id), createEvent(dto), updateEvent(id, patch), deleteEvent(id), toggleCompleted(id), respondInvite(id, 'accepted'\|'declined') }`. Без аргументів — усі події (у т.ч. задачі без дати). Свята приходять як події `type: 'holiday'`, `calendar: 'holidays'`, `allDay: true` |
| `useModals()` | `{ openQuickCreate({ date, startAt, endAt, calendarId }), closeQuickCreate, quickCreate, detailsEventId, openDetails(id), closeDetails }`. Деталі події живуть в URL `?event=<id>` |
| `useViewDate()` | `{ date, setDate(d), dateSearch, isTodaySelected }` — дата подання з `?date=YYYY-MM-DD` |
| `useNow(intervalMs)` | «зараз», що тикає раз на хвилину (лінія часу, «через N хв») |

Подія: `{ id, type: 'arrangement'|'reminder'|'task'|'holiday', title, description, calendar, creator, startAt: Date, endAt: Date|null,
allDay, color, location, reminderMinutesBefore, isCompleted, completedAt, priority: 'low'|'medium'|'high', estimateMinutes,
isDeadline, participants[{ user, name, email, status: 'pending'|'accepted'|'declined' }] }`.
Довідник людей для аватарів: `people` з `src/mocks/data.js` (`{ id, name, email, initials, color }`), стрічка активності — `activity`.

Пошук із хедера кладе `?q=` в URL сторінки календаря/задач — читай через `useSearchParams().get('q')` і передавай у `useEvents`.

## UI-кит (`src/components/ui`)

| Компонент | Пропси |
|---|---|
| `Icon` | `name` (див. `ICON_NAMES` у Icon.jsx: logo, search, plus, user, users, lock, chevron-left/right/down, bell, square, check-square, check, x, clock, pencil, trash, video, text, eye, eye-off, mail, globe, info, layout-dashboard, layout-grid, calendar, map-pin, settings, arrow-right, arrow-left, camera), `size`, `strokeWidth` |
| `PillButton` | `variant` primary·secondary·white·ghost·danger·accent, `size` lg40·md38·sm34·xs32·xxs28, `shape` pill·rounded, `icon`, `to` (Link), `href`, `type`, `fullWidth` |
| `IconButton` | `icon`, `label` (aria), `size` md34·sm28·xs26·round32·xl38, `variant` white·muted, `to` |
| `Badge` | `variant` muted·tint(+`color`)·dark·accent·success·outline·danger·white, `size` sm10·md11·lg12, `dot` (ключ кольору або 'accent'), `dotShape` round·square |
| `Chip` | `label, checked, onChange, color, variant` pill·plain, `hint` |
| `SegmentedControl` | `options [{ value, label, to? }], value, onChange, size` md·sm, `bg` white·muted, `stretch`, `role` tablist·radiogroup |
| `Card` | `title, subtitle, action, variant` white·dark·muted, `padding` ('18px'), `radius` (18), `gap` (10), `as` |
| `DarkCard` | `eyebrow, value, valueSize, title, meta, footer, children` |
| `Modal` | `open, onClose, label, width, top, padding, gap, initialFocus` (CSS-селектор) — portal, Esc/overlay закривають, на мобільному — знизу |
| `Avatar` / `AvatarStack` | `initials, color (ключ або CSS), size, ring, palette` (за замовчуванням 'member' — кольори учасників) / `items[{ initials, color, name }], size, ring, max` |
| `Toggle` | `checked, onChange, label` (role=switch, 40×22) |
| `ColorPicker` | `value, onChange, options, size, inherit { label, color }, palette ('calendar' \| 'member'), disabled` |
| `Field` | `label, htmlFor, hint, error, trailing` — обгортка з підписом 12/600 і помилкою 12px --danger |
| `Input` | `size` lg44·md40·sm36·xs32, `invalid`, `trailing` + усі атрибути input |
| `Select` | `options [{ value, label }], value, onChange, size` md·sm·xs, `leading` (крапка кольору) — нативний select як кнопка з шевроном |
| `Textarea`, `Checkbox` (`size`, `color` ключ або 'accent') | |

## Календарні примітиви (`src/components/calendar`)

- `HourRuler { startHour, endHour, hourHeight, width, fontSize, topOffset }` — колонка годин.
- `HourGrid { day, startHour, endHour, hourHeight, lineColor, onSlotClick(Date), children }` — сітка з лініями; діти абсолютні.
- `EventBlock { event, calendar, variant week·day·overview·timeline·list·chip·mobile, top, height, left, width, selected, meta, description, author { initials, color, name }, participants [{ initials, color }], action, onClick(event), onToggleComplete(event) }` — рендер за типом події.
- `FreeSlot { start, end, onClick(start, end), variant week·day·overview·list, top, height }`.
- `NowLine { top, showLabel, left, right, labelLeft }`.
- `DayCard { date, events, calendarsById, selectedEventId, onEventClick, onSlotClick, onToggleComplete, authorsById }` — картка дня тижня (36px/год).
- `DayStrip { days, selected, onSelect, variant toolbar·mobile }`, `MiniMonth { month, selected, onSelect, onMonthChange, markedDays: Set<'YYYY-MM-DD'>, weekStartsOn }`.

Утиліти: `utils/dates.js` (formatDate патерни 'weekday-long' | 'weekday-short' | 'short' | 'day-month' | 'day-month-short' | 'month-year' | 'weekday-day' | 'iso',
formatTime, formatTimeRange, formatDuration, formatHours, formatRelative, formatWeekRange, getIsoWeek, getWeekDays, getMonthGridDays, getViewRange,
eventToGridPosition, nowOffsetMinutes, addDays/addMonths/addYears, isSameDay, isToday, MONTHS_*, WEEKDAYS_*),
`utils/text.js` (plural*, greeting, initials), `utils/colors.js` (colorVars(key, palette), colorHex, resolveEventColor → { key, palette }, resolveEventColors, COLOR_HEX, MEMBER_COLOR_HEX, COLOR_LABELS; дві палітри: кольори календарів і кольори учасників),
`utils/eventStats.js` (groupEventsByDay, busyMinutes, nextUpcoming, currentEvent, weekSummary, participantsToAvatars, addMinutes, findFreeSlots), `utils/cx.js`.

Сторінки: `src/pages/*` (усі 16 мокапів), локальні компоненти сторінок — `components/overview/`, `components/calendars/`, `components/tasks/`, `modals/`.
Приклад сторінки з повним використанням кита — `src/pages/WeekPage.jsx`; лейаут календарних сторінок — `components/layout/CalendarLayout.jsx`
(тулбар уже є, сторінки рендерять тільки контент під ним).
