# Chronos — frontend

React 18 + Vite + React Router 6. Верстка — CSS Modules зі змінними з `src/styles/tokens.css`
(копія `design/tokens.css`). Джерело правди для вигляду — `design/screens/*.html` і `design/README.md`.

## Правила верстки

- Тільки змінні з `tokens.css`: кольори, шрифти (`--fs-*`, `--fw-*`), радіуси (`--r-*`), розміри (`--control-h*`, `--hour-h-*`).
  Виняток: кілька кольорів, яких немає в токенах, але вони є в мокапах: `#d1d5db` (рамка нагадувань і пунктир), `#60A5FA` (крапка в темному чіпі).
- Стилі за Google HTML/CSS Style Guide: назви класів у CSS через дефіс (`.tab-active`), кольори малими літерами і в короткому записі
  (`#fff`), між правилами порожній рядок. У JSX ті самі класи доступні у camelCase (`styles.tabActive`): це робить
  `css.modules.localsConvention: 'dashesOnly'` у `vite.config.js`. `index.html` написано без закриття порожніх тегів.
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
| `useAuth()` | `{ user, isLoading, login, register, verifyEmail, resendVerification, logout, updateUser, changePassword, logoutEverywhere, requestPasswordReset, confirmPasswordReset }`. Усі методи асинхронні. `user.firstName` додається на фронті. `user.hiddenModules` це масив ключів схованих блоків головного екрана, зберігається через `updateUser({ hiddenModules })` |
| `useCalendars()` | `{ calendars, byId, getCalendar(id), visibleIds, mainCalendar, isLoading, error, toggleVisibility(id), setMyColor(id, color), updateCalendar(id, patch), createCalendar(dto) → id, removeCalendar(id), shareCalendar(id, { email, role }), updateMemberRole(id, userId, role), removeMember(id, userId), cancelInvite(id, inviteId), reload(), refresh() }` |
| `useEvents({ from, to, calendarIds, types, q, includeHidden, includeFloating })` | `{ events, floatingTasks, holidayEvents, holidays, invites, pendingInvites, isLoading, error, getEvent(id), createEvent(dto) → id, saveEvent(id, dto), updateEvent(id, patch), toggleCompleted(id), deleteEvent(id), inviteToEvent(id, emails), respondInvite(inviteId, status), ensureHolidays(year), reload() }`. Без аргументів повертає всі події, крім «плаваючих» задач: вони потрапляють в `events` лише з `includeFloating: true`. `floatingTasks` це «плаваючі» задачі з видимих календарів (з фільтрів діє тільки `q`): спершу невиконані, далі новіші за `createdAt` |
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

Подія: `{ id, type: 'arrangement'|'reminder'|'task'|'holiday', title, description, calendar, creator, creatorName, startAt: Date, endAt: Date|null,
allDay, color, location, reminderMinutesBefore, isCompleted, completedAt, isFloating, priority, participants[{ user, name, email, status }], isInvited, sourceCalendar, isDeadline }`.
`isInvited` означає подію з чужого календаря, куди мене запросили: вона лише для читання. `isDeadline` обчислюється на фронті для задачі на весь день (для «плаваючої» завжди `false`).
Дата є в кожної події; у «плаваючої» задачі (`isFloating`) сервер ставить датою момент створення, і вона не показується в календарі.
У звичайної задачі `startAt` це дедлайн, без часу надсилай 00:00 локального часу з `allDay: true`.
«Плаваючу» задачу створюй як `createEvent({ type: 'task', title, calendar, isFloating: true })`: `toEventPayload` сам прибирає `startAt`, `endAt`, `allDay`
і `reminderMinutesBefore`. Призначити час: `updateEvent(id, { isFloating: false, startAt, allDay })`, повернути в «Колись»: `updateEvent(id, { isFloating: true })`.
`reminderMinutesBefore` це хвилини до початку або `null` («не нагадувати»).
Свята приходять як події `type: 'holiday'`, `calendar: 'holidays'`.

Календар: `{ id, name, description, color, owner, isMain, isShared, isReadOnly, isHidden, myRole, myColor, members[{ user, name, email, role, color }], pendingInvites[{ id, email, role, expiresAt }], eventsCount }`.

## Головний екран

`pages/OverviewPage.jsx` на десктопі й планшеті: привітання з кнопкою «Налаштувати», дошка `components/board/Board` на всю ширину
(сама вантажить свої дані, сховати її не можна), під нею сітка блоків. На мобільному (<768px) дошки немає: лишається стрічка дня,
а внизу блок «Колись». Яке з двох дерев рендерити, вирішує `useMediaQuery('(max-width: 767px)')` з `components/overview/`.

| Ключ | Блок | Компонент |
|---|---|---|
| `floating` | Колись | `FloatingTasksCard` |
| `next` | Наступна подія | `NextEventCard` |
| `tasks` | Задачі тижня | `TasksCard` |
| `load` | Навантаження тижня | `WeekLoadChart` |
| `shared` | Спільні календарі | `SharedCalendarsCard` |
| `invites` | Запрошення | `InvitesCard` |
| `holidays` | Свята | `HolidayList` |
| `calendars` | Мої календарі | `CalendarsCard` |

- Кожен блок загорнутий у `BoardModule { label, onHide }`: він малює кнопку «Сховати» в кутку (видно на hover і focus).
- `useHiddenModules()` з `components/overview/` повертає `{ hidden, setModuleHidden(key, isHidden) }`: стан міняється одразу, зберігається
  в `user.hiddenModules`, при відмові сервера відкочується зі сповіщенням. Ті самі перемикачі живуть у `ModulesSettingsModal`.
- Сітка на 4 колонки (2 нижче 1100px) з `grid-auto-flow: dense`, широкі блоки (`floating`, `load`) займають дві колонки, тож після приховування дірок немає.
- Перетягування: стікер у `FloatingTasksCard` кладе в `dataTransfer` id задачі під типом `application/x-chronos-task` (`effectAllowed = 'move'`).
  Дошка на `drop` читає цей id і викликає `updateEvent(id, { isFloating: false, allDay: false, startAt })`. Задачі лише для читання не перетягуються.

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

## Помічник (`src/components/assistant`)

- `AssistantWidget` живе в `PageShell`: 3D-лінивець у правому нижньому куті (на телефоні над «+»). Клік відкриває вікно
  з полем введення. Фраза йде в `POST /assistant/draft` (`api/assistant.api.js`), з отриманої чернетки створюється подія через
  `createEvent` у головному календарі; у вікні з'являється картка результату з кнопками «Відкрити» (`openDetails`) і «Скасувати» (`deleteEvent`).
- Це не чат: кожна фраза обробляється окремо, історія живе лише в стані компонента й зникає після перезавантаження.
- Лінивець показується, лише якщо `GET /assistant` повернув `enabled: true` (на сервері є ключ Claude API).
- Сценарій рухів: повільно махає лапою, коли з'являється і коли відкривають вікно; поки модель думає, неквапом ходить убік туди-сюди;
  отримавши чернетку, іде до середини сторінки («на календар»), там з'являється драбинка, і він повзе по ній угору, перебираючи лапами;
  нагорі створює подію й радіє з піднятими лапами, сповзає вниз, драбинка зникає, він повертається. Якщо фразу не розпізнано, хитає головою.
- Переміщення по екрану це CSS `transform` кнопки, драбинка це звичайний елемент із градієнтом, а кроки й жести це пози самого лінивця.
  Точку для драбинки рахує `ladderSpot`: 36% ширини і 66% видимої висоти `main`.
- На телефоні й при `prefers-reduced-motion` лінивець не ходить по екрану і драбинки немає: він лише рухається на місці.
- `character.js` збирає лінивця з простих фігур three.js (шоколадний тулуб із рожевим животом, голова зі світлою маскою, темними смужками
  біля очей, рожевим носом і рум'янцем, довгі лапи з трьома кігтями; усі кольори в `COLORS`) і описує пози. Сторонніх моделей немає. `createCharacter()` повертає корінь і суглоби,
  `poseFor(action, time, age)` рахує значення суглобів для дії (`Idle`, `Walking`, `Wave`, `Punch`, `ThumbsUp`, `Jump`, `No`, `Climb`),
  `blendPose` плавно переводить одну позу в іншу, `applyPose` застосовує її до суглобів.
- `CharacterStage { action, heading, onReady, onError }` малює персонажа: сцена, камера, світло і цикл кадрів. Він підвантажується лише
  разом із персонажем (`React.lazy`), тому three.js не потрапляє в основний файл застосунку. `heading` це кут повороту в радіанах
  (0 — мордочкою до користувача).
- Якщо WebGL недоступний або 3D-код не завантажився, замість лінивця показується плоска лисичка `Mascot` у круглій кнопці.

## Підтвердження email

- `register()` більше не відкриває сесію: повертає `{ email, previewUrl? }`, і `AuthPage` показує `components/auth/CheckEmailPanel`
  («Перевір пошту», «Відкрити лист» для Ethereal, «Надіслати ще раз»). Та сама панель з'являється, коли вхід повернув код `EMAIL_NOT_VERIFIED`
  (`parseApiError(err).code`).
- Посилання з листа веде на `pages/VerifyEmailPage` (`/verify-email/:token`): вона викликає `verifyEmail(token)`, який відкриває сесію,
  і переходить на `?next=` або на Огляд. Якщо посилання недійсне, сторінка пропонує надіслати новий лист.

## Теми оформлення

- Тема це пара `{ color, mode }`: один із восьми кольорів (`graphite`, `blue`, `lavender`, `pink`, `coral`, `sand`, `mint`, `teal`)
  і режим `light`, `dark` або `system`. Вибір лежить у профілі (`components/profile/ThemePicker`), зберігається в акаунті (`user.theme`)
  і дублюється в `localStorage`, щоб сторінка входу теж була в останній темі.
- `utils/theme.js` рахує палітру з відтінку кольору (функції `lightTokens` і `darkTokens`) і записує значення CSS-змінних на `<html>`.
  Тема «Графіт» у світлому режимі це вихідні значення з `tokens.css`, тому для неї нічого не перевизначається.
- `ThemeProvider` тримає поточну тему, застосовує її, стежить за системною темою в режимі `system` і зберігає вибір через `updateUser`.
  Хук: `useTheme()` → `{ theme, setTheme(changes) }`.
- Щоб тема працювала всюди, у стилях не можна писати кольори напряму: лише змінні. Додано нові змінні: `--line-strong`, `--accent-dot` і трійку `--sticker-main*`.
- Наклейки на дошці й у блоці «Колись» беруть колір через `stickerColors(event, calendar)` з `utils/colors.js`: фон це суміш основного кольору
  календаря з його світлим відтінком (`color-mix`), зверху кольорова смужка. Наклейки графітового календаря жовті, як паперові стікери.
- У темному режимі `--dark` стає світлим відтінком теми, а `--ink-on-dark` темним: головні кнопки й темні картки інвертуються.

## Нагадування в Telegram

- У профілі, в розділі «Сповіщення», є рядок «Нагадування в Telegram» (`TelegramRow` у `pages/ProfilePage.jsx`). Він показується,
  лише якщо `GET /telegram` повернув `enabled: true` (на сервері є токен бота).
- Хук `useTelegram()` → `{ status, pending, isWaiting, connect, disconnect, sendTest, cancel }`; запити лежать в `api/telegram.api.js`.
- `connect()` одразу по кліку відкриває порожню вкладку (інакше браузер заблокує спливаюче вікно), бере посилання з `POST /telegram/link`
  і спрямовує вкладку на бота. Далі хук раз на 3 секунди перепитує статус, доки чат не підключиться або не сплине термін посилання.
- «Перевірити» надсилає тестове повідомлення в чат, «Відключити» відв'язує чат від акаунта.
