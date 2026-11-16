# Chronos — frontend

React 18 + Vite + React Router 6. Верстка — CSS Modules зі змінними з `src/styles/tokens.css`
(копія `design/tokens.css`). Джерело правди для вигляду — `design/screens/*.html` і `design/README.md`.

## Правила верстки

- Тільки змінні з `tokens.css`: кольори, шрифти (`--fs-*`, `--fw-*`), радіуси (`--r-*`), розміри (`--control-h*`, `--hour-h-*`).
  Виняток: кілька кольорів, яких немає в токенах, але вони є в мокапах: `#d1d5db` (рамка нагадувань і пунктир), `#60A5FA` (крапка в темному чіпі).
- Кожен компонент це пара `Name.jsx` + `Name.module.css`. Інлайн лишається лише для обчислюваних значень
  (top/height у сітці, кольори календаря через `colorVars(key)`).
- Код без коментарів. Назви змінних і функцій мають пояснювати себе самі.
- Airbnb ESLint: `propTypes` для всіх пропсів, дефолти через параметри за замовчуванням (`{ size = 'md' }`),
  без вкладених тернарників, клікабельне це `<button>` або `Link`. Перед завершенням: `npm run lint` і `npm run build`.
- Адаптив: бічні панелі (`aside`) стають на всю ширину нижче 1000px, мобільний вигляд нижче 768px
  (`MobileTabBar`, `Fab` і компактний `AppHeader` вмикаються самі в `PageShell`).
- Акцент `--accent` лише для «сьогодні», лінії «зараз», фокусу й посилань. Головні кнопки темні, вторинні білі, усе пілюлі.

## Дані

Сторінки не ходять в API напряму. Запити лежать у `src/api/*`, стан тримають провайдери з `src/app/providers/`,
сторінки читають його через хуки. Формат відповідей описано в `docs/api.md`.

```
api/client.js        axios, access-токен у пам'яті, одне спільне оновлення сесії на 401
api/errors.js        parseApiError(error) → { status, message, fields }
AuthProvider         користувач і сесія
CalendarsProvider    календарі + віртуальний календар свят
EventsProvider       події, свята, вхідні запрошення
ToastProvider        сповіщення
ModalsProvider       швидке створення і деталі події (живе в PageShell)
```

| Хук | Що повертає |
|---|---|
| `useAuth()` | `{ user, isLoading, login, register, logout, updateUser, changePassword, logoutEverywhere, requestPasswordReset, confirmPasswordReset }`. Усі методи асинхронні. `user.firstName` додається на фронті |
| `useCalendars()` | `{ calendars, byId, getCalendar(id), visibleIds, mainCalendar, isLoading, error, toggleVisibility(id), setMyColor(id, color), updateCalendar(id, patch), createCalendar(dto) → id, removeCalendar(id), shareCalendar(id, { email, role }), updateMemberRole(id, userId, role), removeMember(id, userId), cancelInvite(id, inviteId), reload(), refresh() }` |
| `useEvents({ from, to, calendarIds, types, q, includeHidden })` | `{ events, holidayEvents, holidays, invites, pendingInvites, isLoading, error, getEvent(id), createEvent(dto) → id, saveEvent(id, dto), updateEvent(id, patch), toggleCompleted(id), deleteEvent(id), inviteToEvent(id, emails), respondInvite(inviteId, status), ensureHolidays(year), reload() }`. Без аргументів повертає всі події, включно із задачами без дати |
| `usePeople()` | мапа `id → { id, name, fullName, email, initials, color, isMe }`, зібрана з учасників моїх календарів; для себе `name` це «Ти» |
| `useToast()` | `{ notify(text), notifySuccess(text), notifyError(error) }` |
| `useModals()` | `{ openQuickCreate({ date, startAt, endAt, calendarId }), closeQuickCreate, quickCreate, detailsEventId, openDetails(id), closeDetails }`. Деталі події живуть в адресі `?event=<id>` |
| `useViewDate()` | `{ date, setDate(d), dateSearch, isTodaySelected }`, дата подання з `?date=YYYY-MM-DD` |
| `useNow(intervalMs)` | «зараз», що оновлюється раз на хвилину |

Два види методів зміни даних:

- **Оптимістичні** (`toggleVisibility`, `setMyColor`, `updateEvent`, `toggleCompleted`, `deleteEvent`, `respondInvite`): стан змінюється одразу,
  при відмові сервера відкочується, користувач бачить сповіщення. Їх можна викликати без `await`.
- **Ті, що кидають помилку** (`createEvent`, `saveEvent`, `inviteToEvent`, `createCalendar`, `updateCalendar`, `removeCalendar`, `shareCalendar`,
  `updateMemberRole`, `removeMember`, `cancelInvite`): обгортай у `try/catch`, помилки полів бери з `parseApiError(err).fields`, кнопку на час запиту блокуй.

Подія: `{ id, type: 'arrangement'|'reminder'|'task'|'holiday', title, description, calendar, creator, creatorName, startAt: Date|null, endAt: Date|null,
allDay, color, location, reminderMinutesBefore, isCompleted, completedAt, priority, participants[{ user, name, email, status }], isInvited, sourceCalendar, isDeadline }`.
`isInvited` означає подію з чужого календаря, куди мене запросили: вона лише для читання. `isDeadline` обчислюється на фронті для задачі на весь день.
Свята приходять як події `type: 'holiday'`, `calendar: 'holidays'`.

Календар: `{ id, name, description, color, owner, isMain, isShared, isReadOnly, isHidden, myRole, myColor, members[{ user, name, email, role, color }], pendingInvites[{ id, email, role, expiresAt }], eventsCount }`.

Пошук із хедера кладе `?q=` в адресу сторінки календаря чи задач: читай через `useSearchParams().get('q')` і передавай у `useEvents`.

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
| `Modal` | `open, onClose, label, width, top, padding, gap, initialFocus` (CSS-селектор): portal, Esc і клік по фону закривають, на мобільному виїжджає знизу |
| `Toaster`, `PageLoader` | сповіщення (рендерить `ToastProvider`) і повноекранний індикатор завантаження |
| `Avatar` / `AvatarStack` | `initials, color (ключ або CSS), size, ring, palette` (за замовчуванням 'member' — кольори учасників) / `items[{ initials, color, name }], size, ring, max` |
| `Toggle` | `checked, onChange, label` (role=switch, 40×22) |
| `ColorPicker` | `value, onChange, options, size, inherit { label, color }, palette ('calendar' \| 'member'), disabled` |
| `Field` | `label, htmlFor, hint, error, trailing` — обгортка з підписом 12/600 і помилкою 12px --danger |
| `Input` | `size` lg44·md40·sm36·xs32, `invalid`, `trailing` + усі атрибути input |
| `Select` | `options [{ value, label }], value, onChange, size` md·sm·xs, `leading` (крапка кольору) — нативний select як кнопка з шевроном |
| `Textarea`, `Checkbox` (`size`, `color` ключ або 'accent', `locked` для позначки, яку не можна зняти) | |

## Календарні примітиви (`src/components/calendar`)

- `HourRuler { startHour, endHour, hourHeight, width, fontSize, topOffset }` — колонка годин.
- `HourGrid { day, startHour, endHour, hourHeight, lineColor, onSlotClick(Date), children }` — сітка з лініями; діти абсолютні.
- `EventBlock { event, calendar, variant week·day·overview·timeline·list·chip·mobile, top, height, left, width, selected, meta, description, author { initials, color, name }, participants [{ initials, color }], action, onClick(event), onToggleComplete(event) }` — рендер за типом події.
- `FreeSlot { start, end, onClick(start, end), variant week·day·overview·list, top, height }`.
- `NowLine { top, showLabel, left, right, labelLeft }`.
- `DayCard { date, events, calendarsById, selectedEventId, onEventClick, onSlotClick, onToggleComplete, authorsById }` — картка дня тижня (36px/год).
- `DayStrip { days, selected, onSelect, variant toolbar·mobile }`, `MiniMonth { month, selected, onSelect, onMonthChange, markedDays: Set<'YYYY-MM-DD'>, weekStartsOn }`.

Утиліти: `utils/dates.js` (форматування дат і часу українською, ISO-тиждень, межі подань, позиція блоку в сітці),
`utils/text.js` (множина, привітання, ініціали), `utils/colors.js` (дві палітри: кольори календарів і кольори учасників; `resolveEventColors`),
`utils/eventStats.js` (групування по днях, зайнятість, наступна подія, вільні вікна, аватари учасників),
`utils/normalize.js` (перетворення відповідей API і тіла запиту події), `utils/cx.js`.

Сторінки лежать у `src/pages/*`, їхні локальні компоненти в `components/overview/`, `components/calendars/`, `components/tasks/`, модалки в `modals/`.
Лейаут календарних сторінок це `components/layout/CalendarLayout.jsx`: тулбар спільний, сторінки рендерять лише вміст під ним.
