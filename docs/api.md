# Chronos — API

База: `/api`. Формат JSON. Дати в запитах і відповідях: ISO 8601 в UTC (`2026-11-05T09:00:00.000Z`).

**Авторизація.** Захищені маршрути вимагають заголовок `Authorization: Bearer <accessToken>`. Access-токен живе 15 хвилин,
refresh-токен лежить у httpOnly cookie `refreshToken` (шлях `/api/auth`) і оновлює сесію через `POST /auth/refresh`.

**Успіх:** об'єкт із ресурсом (`{ user }`, `{ events: [...] }`); видалення повертає `204` без тіла.

**Помилка:** `{ "status": "error", "message": "…", "details": [{ "field": "email", "message": "…" }] }`.

| Код | Коли |
|---|---|
| 400 | помилка валідації (`details` по полях) або некоректний JSON |
| 401 | немає токена, токен недійсний або сесія закінчилась |
| 403 | недостатньо прав |
| 404 | ресурс не знайдено |
| 409 | конфлікт (email зайнятий, запрошення вже опрацьовано, учасників події щойно змінив хтось інший) |
| 410 | термін дії запрошення минув |
| 413 | тіло запиту більше за 1 МБ |
| 429 | забагато спроб входу, реєстрації або скидання пароля; заголовок `Retry-After` каже, через скільки секунд можна повторити |
| 502 | зовнішній сервіс свят недоступний і кешу немає |

У колонці «Доступ»: `—` публічний, `✓` будь-який авторизований, назва ролі означає мінімальну роль у календарі.

## Health

| Метод | Шлях | Доступ | Відповідь |
|---|---|---|---|
| GET | `/health` | — | `200 { "status": "ok" }` |

## Auth

| Метод | Шлях | Доступ | Тіло | Відповідь |
|---|---|---|---|---|
| POST | `/auth/register` | — | `{ email, password (8..128), name (2..80), country?, timezone?, next? }` | `201 { message, email, previewUrl? }`. Створює акаунт і головний календар, надсилає лист із посиланням для підтвердження; сесію **не** відкриває. `409` якщо email зайнятий |
| POST | `/auth/verify-email` | — | `{ token }` (64 hex із посилання в листі) | `200 { user, accessToken }` + cookie: email підтверджено, користувач одразу в системі. `400` якщо посилання недійсне, використане або прострочене |
| POST | `/auth/verify-email/resend` | — | `{ email }` | `202 { message, previewUrl? }`. Відповідь однакова для будь-якого email; лист іде лише непідтвердженому акаунту, попереднє посилання перестає діяти |
| POST | `/auth/login` | — | `{ email, password, remember? = true }` | `200 { user, accessToken }` + cookie (сесійна, якщо `remember: false`). `401` на невірні дані. `403` з `code: 'EMAIL_NOT_VERIFIED'`, якщо пароль правильний, але email ще не підтверджено |
| POST | `/auth/refresh` | cookie | — | `200 { user, accessToken }` + нова cookie. `401` без сесії |
| POST | `/auth/logout` | — | — | `204`, cookie очищено |
| POST | `/auth/password-reset` | — | `{ email }` | `202 { message }` завжди, лист іде лише на існуючий email |
| POST | `/auth/password-reset/confirm` | — | `{ token (64 hex), password }` | `204`; усі старі сесії скасовуються. `400` якщо посилання недійсне |

Посилання в листі скидання: `<CLIENT_URL>/reset?token=<token>`, дійсне 60 хвилин.

### Підтвердження email

1. Після реєстрації на email іде лист із кнопкою «Підтвердити email». Посилання: `<CLIENT_URL>/verify-email/<token>`, діє 24 години
   (`EMAIL_VERIFICATION_TTL_HOURS`). У базі зберігається лише хеш токена.
2. Поки email не підтверджено, вхід повертає `403` з кодом `EMAIL_NOT_VERIFIED`. Фронт у відповідь показує екран «Перевір пошту» з кнопкою «Надіслати ще раз».
3. Перехід за посиланням підтверджує email і одразу відкриває сесію. Необов'язкове поле `next` у реєстрації (шлях усередині застосунку,
   наприклад `/invite/<token>`) додається до посилання, і після підтвердження користувач потрапляє туди.
4. Скидання пароля теж підтверджує email: людина довела, що має доступ до скриньки.
5. `previewUrl` є у відповіді лише тоді, коли листи йдуть через Ethereal: це посилання на перегляд листа в браузері. Зі справжнім SMTP його немає.

## Users

| Метод | Шлях | Доступ | Тіло | Відповідь |
|---|---|---|---|---|
| GET | `/users/me` | ✓ | — | `200 { user }` |
| PATCH | `/users/me` | ✓ | мінімум одне з: `name`, `avatarUrl` (посилання http/https, зображення PNG/JPEG/WebP у вигляді data URL до 100 КБ, або null), `country`, `timezone`, `defaultArrangementDuration` (5..480), `weekStartsOn` (0\|1), `timeFormat` ('24h'\|'12h'), `showWeekNumbers`, `showHolidays`, `notifications { emailReminders?, push?, sharedCalendarEmails? }`, `theme { color, mode }` (тема оформлення: колір `graphite`, `blue`, `lavender`, `pink`, `coral`, `sand`, `mint`, `teal`; режим `light`, `dark`, `system`; обидва поля обов'язкові), `hiddenModules` (масив із `floating`, `next`, `tasks`, `load`, `shared`, `invites`, `holidays`, `calendars`: блоки головного екрана, які користувач сховав) | `200 { user }` |
| POST | `/users/me/password` | ✓ | `{ currentPassword, newPassword (8..128) }` | `200 { accessToken }` + нова cookie; інші пристрої виходять. `400` з `details.currentPassword` |
| POST | `/users/me/logout-everywhere` | ✓ | — | `204`, усі сесії скасовано |

`user`: `{ id, email, name, avatarUrl, country, timezone, defaultArrangementDuration, weekStartsOn, timeFormat, showWeekNumbers, showHolidays, notifications, isEmailVerified, createdAt, updatedAt }`

## Calendars

| Метод | Шлях | Доступ | Тіло | Відповідь |
|---|---|---|---|---|
| GET | `/calendars` | ✓ | — | `200 { calendars }`: усі, де я учасник; головний перший |
| POST | `/calendars` | ✓ | `{ name (1..60), description? (..300), color? = 'blue' }` | `201 { calendar }`, автор стає власником |
| GET | `/calendars/:id` | viewer | — | `200 { calendar }` |
| PATCH | `/calendars/:id` | owner | мінімум одне з `name`, `description`, `color` | `200 { calendar }` |
| DELETE | `/calendars/:id` | owner | — | `204`; видаляє події й запрошення календаря. `403` для головного |
| PATCH | `/calendars/:id/visibility` | viewer | `{ isHidden?, color? }` | `200 { calendar }`; змінює лише мої налаштування. `403` при спробі сховати головний |
| POST | `/calendars/:id/share` | owner | `{ email, role: 'editor' \| 'viewer' }` | `201 { invite }` + лист. `403` для головного, `409` якщо це вже учасник |
| PATCH | `/calendars/:id/members/:userId` | owner | `{ role: 'editor' \| 'viewer' }` | `200 { calendar }`; роль власника змінити не можна |
| DELETE | `/calendars/:id/members/:userId` | viewer | — | `204`; власник прибирає будь-кого, учасник може прибрати лише себе (вийти) |
| DELETE | `/calendars/:id/invites/:inviteId` | owner | — | `204`, скасовує запрошення, яке ще чекає |

`calendar`: `{ id, name, description, color, owner, isMain, isShared, myRole, myColor, isHidden, members: [{ user, name, email, role, color, joinedAt }], pendingInvites: [{ id, email, role, expiresAt }], eventsCount, createdAt, updatedAt }`.
`isHidden`, `myRole`, `myColor` стосуються користувача, який робить запит. `pendingInvites` заповнено лише для власника.
Кольори: `graphite`, `blue`, `purple`, `green`, `orange`, `pink`.

Правила ролей: власник керує календарем, учасниками і будь-якими подіями; редактор створює події й змінює лише свої; глядач лише читає.

## Events

| Метод | Шлях | Доступ | Тіло / query | Відповідь |
|---|---|---|---|---|
| GET | `/events` | ✓ | `?from&to&calendars=id1,id2&types=arrangement,task&q=текст&includeHidden=true` | `200 { events }` |
| POST | `/events` | editor у `calendar` | `{ title (1..120), type, calendar, startAt, endAt?, allDay?, color?, location? (..200), description? (..2000), reminderMinutesBefore? (0..10080 або `null`), priority?, participants?: [email] (до 20) }` | `201 { event }` + листи учасникам |
| GET | `/events/:id` | viewer або учасник події | — | `200 { event }` |
| PATCH | `/events/:id` | owner, або editor для своєї події | ті самі поля + `isCompleted`; мінімум одне | `200 { event }`; якщо змінились час або місце, учасники отримують лист |
| DELETE | `/events/:id` | owner, або editor для своєї події | — | `204`; учасники отримують лист про скасування |
| POST | `/events/:id/invite` | owner, або editor для своєї події | `{ emails: [email] (1..20) }` | `200 { event }` + листи |

Типи подій:

| Тип | `startAt` | `endAt` |
|---|---|---|
| `arrangement` | обов'язковий | пізніше за `startAt`; якщо не передано, сервер ставить `startAt + defaultArrangementDuration` з профілю |
| `reminder` | обов'язковий | завжди `null` |
| `task` | обов'язковий (дедлайн) | завжди `null`; має `isCompleted`, `completedAt`, `priority` |

Дата є в кожної події: запит без `startAt` або з `startAt: null` повертає `400` з повідомленням «У кожної події має бути дата».

**Плаваюча задача** (`isFloating: true`, лише для `task`) це справа «зроблю колись» без дедлайну. `startAt` можна не передавати:
сервер запише в нього момент створення, тож дата в базі є й у такої задачі. Сервер також ставить `allDay: true` і `reminderMinutesBefore: null`.
У вибірку за діапазоном (`from`/`to`) плаваючі задачі не потрапляють, у повний список потрапляють. `PATCH { isFloating: false, startAt }`
призначає задачі час (без `startAt` буде `400`), `PATCH { isFloating: true }` знову робить її плаваючою.

Список: `from` і `to` передаються лише разом, `to > from`, діапазон до 400 днів. З діапазоном повертаються події, що його перетинають;
без діапазону всі події. Приховані календарі виключаються, якщо не передано `includeHidden=true`
або календар не названо в `calendars`. `q` шукає підрядок у назві та описі без урахування регістру. Сортування за `startAt`, ліміт 2000.

Подія, на яку мене запросили з чужого календаря, після прийняття запрошення з'являється у списку з `calendar` = мій головний календар,
`isInvited: true` і `sourceCalendar: { id, name, color }`. Вона доступна лише для читання.

`event`: `{ id, title, description, type, calendar, creator, startAt, endAt, allDay, isFloating, color, location, reminderMinutesBefore, isCompleted, completedAt, priority, participants: [{ user, name, email, status: 'pending' \| 'accepted' \| 'declined', invitedAt, respondedAt }], isInvited, sourceCalendar, createdAt, updatedAt }`

У `PATCH` поле `participants` є повним новим списком email: нові отримують запрошення, відсутні прибираються.
Якщо двоє одночасно змінюють учасників однієї події, перший запит проходить, другий отримує `409` і має повторити спробу з актуальними даними.

### Нагадування

`reminderMinutesBefore` каже, за скільки хвилин до `startAt` надіслати лист: `0` означає в момент початку, `null` означає «не нагадувати»,
за замовчуванням `10`. Раз на хвилину бекенд шукає події, для яких настав час, і пише авторові та учасникам, що прийняли запрошення.
Кожен отримує час у своєму часовому поясі й посилання `<CLIENT_URL>/calendar/day?date=YYYY-MM-DD&event=<id>`.

- Нагадування про подію надсилається один раз. Якщо змінити `startAt` або `reminderMinutesBefore`, воно надійде знову за новим часом.
- Виконані задачі й події, що почались понад 5 хвилин тому, пропускаються.
- Перемикач профілю `notifications.emailReminders: false` вимикає ці листи для користувача.

### Листи про зміни

- `PATCH`, що змінює `startAt`, `endAt` або `location`, надсилає учасникам лист «подію змінено» з новим часом.
- `DELETE` надсилає учасникам лист «подію скасовано».
- Отримувачі: учасники, які не відмовились, і автор події, якщо змінював не він. Той, хто зробив зміну, листа не отримує.
- Перемикач профілю `notifications.sharedCalendarEmails: false` вимикає для користувача листи про зміни, скасування та запрошення.
  Саме запрошення при цьому лишається в `GET /invites`.

## Invites

| Метод | Шлях | Доступ | Відповідь |
|---|---|---|---|
| GET | `/invites` | ✓ | `200 { invites }`: запрошення на мій email, які чекають відповіді (з полем `token`) |
| GET | `/invites/:token` | — | `200 { invite }`; прострочене приходить зі `status: 'expired'`. `404` якщо токен невідомий або ціль видалено |
| POST | `/invites/:token/accept` | ✓ | `200 { invite }`. Календар: мене додано учасником з роллю із запрошення. Подія: мій статус учасника стає `accepted` |
| POST | `/invites/:token/decline` | ✓ | `200 { invite }` |

Помилки accept/decline: `403` запрошення надіслано на інший email, `409` вже опрацьовано, `410` прострочене, `404` ціль видалено.

`invite`: `{ id, kind: 'event' \| 'calendar', email, status: 'pending' \| 'accepted' \| 'declined' \| 'expired', role, expiresAt, respondedAt, createdAt, invitedBy: { id, name }, event, calendar: { id, name, description, color, isShared } }`.
Запрошення дійсне 7 днів. Посилання в листі: `<CLIENT_URL>/invite/<token>`.

## Drawings

Малюнки користувача поверх дошки на головному екрані. Кожен запис це один штрих; штрихи бачить лише їхній автор.

| Метод | Шлях | Доступ | Тіло / query | Відповідь |
|---|---|---|---|---|
| GET | `/drawings` | ✓ | `?from&to` (обов'язкові, до 62 днів) | `200 { drawings }`: мої штрихи, що перетинають діапазон |
| POST | `/drawings` | ✓ | `{ color, width (1..12), points: [[t, y], ...] (2..2000) }` | `201 { drawing }`; `409`, якщо штрихів уже 3000 |
| DELETE | `/drawings/:id` | ✓ | — | `204`; `404` для чужого або неіснуючого |
| DELETE | `/drawings` | ✓ | `?from&to` | `204`: стирає мої штрихи в діапазоні |

Точка це `[t, y]`: `t` — час у мілісекундах від епохи (горизонтальна вісь дошки це час), `y` — пікселі від верху полотна (0..4000).
Тому малюнок лишається на своєму місці за будь-якого масштабу й на будь-якому екрані. `color` це один із ключів кольорів календаря.

`drawing`: `{ id, color, width, points, createdAt }`.

## Assistant

Помічник на Claude перетворює одну фразу на чернетку події. Сам він нічого не зберігає: клієнт створює подію з чернетки звичайним
`POST /events` і показує користувачеві результат із кнопкою «Скасувати».

| Метод | Шлях | Доступ | Тіло | Відповідь |
|---|---|---|---|---|
| GET | `/assistant` | ✓ | — | `200 { enabled }`: чи є на сервері ключ Claude API |
| POST | `/assistant/draft` | ✓ | `{ text (2..500) }` | `200 { draft }` |

`draft`: `{ title, type, startAt, endAt, allDay, isFloating }`. Правила:

- є дата й час: `startAt` в UTC; для зустрічі `endAt` із тексту або `startAt + defaultArrangementDuration`;
- є дата без часу: запис на весь день (`allDay: true`); зустріч без часу стає нагадуванням;
- дати немає: плаваюча задача (`isFloating: true`, `startAt: null`).

## Telegram

Бот дублює нагадування про події в особистий чат. Чат прив'язується до акаунта одноразовим посиланням: клієнт просить посилання,
користувач відкриває його й натискає «Start», бот отримує код і запам'ятовує чат. Без `TELEGRAM_BOT_TOKEN` модуль вимкнений.

| Метод | Шлях | Доступ | Тіло | Відповідь |
|---|---|---|---|---|
| GET | `/telegram` | ✓ | — | `200 { enabled, botUsername, isConnected, username }` |
| POST | `/telegram/link` | ✓ | — | `201 { url, expiresAt }`: посилання `https://t.me/<бот>?start=<код>`, діє 15 хв і лише один раз |
| DELETE | `/telegram/link` | ✓ | — | `204`: чат відключено |
| POST | `/telegram/test` | ✓ | — | `204`: у чат пішло тестове повідомлення; `409`, якщо чат не підключено |

Помилки: `503` бот не налаштований, `502` Telegram не відповідає, `429` забагато запитів.

Команди бота (вони ж у меню біля поля вводу):

| Команда | Що робить |
|---|---|
| `/start <код>` | підключає чат до акаунта |
| `/today`, `/tomorrow` | розклад на сьогодні або завтра в часовому поясі користувача: інтерактивний HTML-віджет, а якщо Telegram його не прийняв, той самий список текстом |
| `/help` | підказка з командами |
| `/stop` | відключає чат |

На будь-яке інше повідомлення бот відповідає підказкою. Повідомлення оформлені HTML-розміткою Telegram (`parse_mode: HTML`),
а назви й місця подій екрануються.

Під нагадуванням є кнопки: «Відкласти на 10 хв» (нагадає ще раз), для задач ще й «Виконано» (позначає задачу виконаною
з тими самими перевірками прав, що й `PATCH /events/:id`). Якщо `CLIENT_URL` починається з `https://`, додається кнопка
«Відкрити подію»; для локальної адреси посилання йде звичайним текстом, бо Telegram не приймає такі адреси в кнопках.

Віджет розкладу (Bot API 10.4, метод `sendWidget`) це один HTML-файл `backend/src/modules/telegram/agenda.widget.html`
зі стилями й скриптом усередині. Telegram малює його прямо в повідомленні, без доступу до мережі. Обмеження Telegram:
HTML до 32 КБ і до 4 КБ після стиснення, стан до 1024 байтів, запит від віджета до 64 байтів. У віджеті є перемикач
«Сьогодні / Завтра» і чекбокси задач. Запити віджета: `ref:<день>` (оновити), `day:<день>` (перемкнути день),
`done:<день>:<id>` (перемкнути виконання задачі), де день це `t` або `m`.

Станом на 18 листопада 2026 Telegram відхиляє віджети звичайних ботів помилкою `INPUT_MEDIA_WIDGET_NOT_ALLOWED`, тож користувач
отримує текстовий розклад. Після такої відмови бот годину не пробує надсилати віджет, а потім перевіряє знову.

Опис бота, короткий опис і меню команд сервер виставляє сам під час запуску (`setMyDescription`, `setMyShortDescription`,
`setMyCommands`). Аватарка ставиться вручну в @BotFather; файл лежить у `docs/telegram/bot-avatar.png`.

Помилки: `422` текст не схожий на подію, `429` перевищено ліміт (20 запитів за 10 хвилин на користувача) або перевантажений сервіс моделі,
`502` сервіс моделі недоступний, `503` ключа немає або він недійсний.

Модель задається змінною `ASSISTANT_MODEL` (типово `claude-opus-5-5`). Відповідь моделі обмежена JSON-схемою, а дати й час із неї
сервер перевіряє сам і переводить із часового поясу користувача в UTC. Для моделей, які це підтримують, увімкнено серверний запасний
варіант (`fallbacks`): якщо основна модель відмовиться відповідати, той самий запит виконає інша.

## Holidays

| Метод | Шлях | Доступ | Query | Відповідь |
|---|---|---|---|---|
| GET | `/holidays` | ✓ | `?year=2026&country=UA`; за замовчуванням поточний рік і країна з профілю | `200 { country, year, holidays: [{ date: 'YYYY-MM-DD', localName, name }], fetchedAt, isStale }` |

Джерело: `https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}`. Відповідь кешується в MongoDB за парою країна+рік на 30 днів.
Якщо зовнішній сервіс недоступний, віддається застарілий кеш з `isStale: true`; без кешу `502`.
До офіційних свят України сервер додає День святого Миколая (6 грудня): це не вихідний, тому в Nager.Date його немає. Невідома країна або рік поза діапазоном сервісу: `400`.

## Пошта

Листи (запрошення, нагадування, зміни та скасування подій, скидання пароля) надсилає nodemailer. Є три режими, які вибираються змінними `SMTP_*`:

| `SMTP_HOST` | Що відбувається |
|---|---|
| порожній | Бекенд при першому листі створює тестову скриньку [Ethereal](https://ethereal.email) і надсилає листи туди. У консолі з'являється посилання `Переглянути лист: https://ethereal.email/message/…` |
| `smtp.ethereal.email` | Листи йдуть у постійну скриньку Ethereal з `SMTP_USER` і `SMTP_PASS`; їх видно і за посиланням з консолі, і в інтерфейсі Ethereal після входу |
| інший хост | Справжня пошта через SMTP провайдера |

Ethereal лише ловить листи й показує їх у браузері, справжнім адресатам вони не доходять. Посилання на перегляд публічне,
тому цей режим годиться лише для розробки й демо. Якщо Ethereal недоступний (немає інтернету), лист друкується в консоль текстом.
Помилка пошти не ламає запит: запрошення все одно створюється.

## Захист від зловживань

- Вхід, реєстрація та скидання пароля обмежені: `AUTH_RATE_LIMIT_MAX` спроб (типово 30) з однієї IP-адреси за
  `AUTH_RATE_LIMIT_WINDOW_MINUTES` хвилин (типово 10). Далі `429` із заголовком `Retry-After`. `AUTH_RATE_LIMIT_MAX=0` вимикає обмеження.
- Усі тіла, параметри й query проходять Joi-схеми з `stripUnknown`: зайві та службові поля (`creator`, `reminderSentAt`, оператори `$set`, `$ne`)
  відкидаються або дають `400`, до бази вони не доходять.
- Некоректний JSON, зламане кодування адреси, тіло понад 1 МБ, підроблений токен, одночасні однакові запити повертають `4xx`, а не `500`.
  Це перевіряє `backend/tests/robustness.test.js`.

## Приклади

```bash
curl -s http://localhost:4000/api/health
```

```bash
curl -s -c cookies.txt -X POST http://localhost:4000/api/auth/register -H 'Content-Type: application/json' -d '{"email":"asia@mail.com","password":"secret123","name":"Анастасія"}'
```

```bash
curl -s "http://localhost:4000/api/events?from=2026-11-02T00:00:00Z&to=2026-11-09T00:00:00Z" -H "Authorization: Bearer <token>"
```
