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
| 409 | конфлікт (email зайнятий, запрошення вже опрацьовано) |
| 410 | термін дії запрошення минув |
| 502 | зовнішній сервіс свят недоступний і кешу немає |

У колонці «Доступ»: `—` публічний, `✓` будь-який авторизований, назва ролі означає мінімальну роль у календарі.

## Health

| Метод | Шлях | Доступ | Відповідь |
|---|---|---|---|
| GET | `/health` | — | `200 { "status": "ok" }` |

## Auth

| Метод | Шлях | Доступ | Тіло | Відповідь |
|---|---|---|---|---|
| POST | `/auth/register` | — | `{ email, password (8..128), name (2..80), country?, timezone? }` | `201 { user, accessToken }` + cookie. Створює головний календар. `409` якщо email зайнятий |
| POST | `/auth/login` | — | `{ email, password, remember? = true }` | `200 { user, accessToken }` + cookie (сесійна, якщо `remember: false`). `401` на невірні дані |
| POST | `/auth/refresh` | cookie | — | `200 { user, accessToken }` + нова cookie. `401` без сесії |
| POST | `/auth/logout` | — | — | `204`, cookie очищено |
| POST | `/auth/password-reset` | — | `{ email }` | `202 { message }` завжди, лист іде лише на існуючий email |
| POST | `/auth/password-reset/confirm` | — | `{ token (64 hex), password }` | `204`; усі старі сесії скасовуються. `400` якщо посилання недійсне |

Посилання в листі скидання: `<CLIENT_URL>/reset?token=<token>`, дійсне 60 хвилин.

## Users

| Метод | Шлях | Доступ | Тіло | Відповідь |
|---|---|---|---|---|
| GET | `/users/me` | ✓ | — | `200 { user }` |
| PATCH | `/users/me` | ✓ | мінімум одне з: `name`, `avatarUrl` (http/https або null), `country`, `timezone`, `defaultArrangementDuration` (5..480), `weekStartsOn` (0\|1), `timeFormat` ('24h'\|'12h'), `showWeekNumbers`, `showHolidays`, `notifications { emailReminders?, push?, sharedCalendarEmails? }` | `200 { user }` |
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
| POST | `/events` | editor у `calendar` | `{ title (1..120), type, calendar, startAt, endAt?, allDay?, color?, location? (..200), description? (..2000), reminderMinutesBefore? (0..10080), priority?, participants?: [email] (до 20) }` | `201 { event }` + листи учасникам |
| GET | `/events/:id` | viewer або учасник події | — | `200 { event }` |
| PATCH | `/events/:id` | owner, або editor для своєї події | ті самі поля + `isCompleted`; мінімум одне | `200 { event }` |
| DELETE | `/events/:id` | owner, або editor для своєї події | — | `204` |
| POST | `/events/:id/invite` | owner, або editor для своєї події | `{ emails: [email] (1..20) }` | `200 { event }` + листи |

Типи подій:

| Тип | `startAt` | `endAt` |
|---|---|---|
| `arrangement` | обов'язковий | пізніше за `startAt`; якщо не передано, сервер ставить `startAt + defaultArrangementDuration` з профілю |
| `reminder` | обов'язковий | завжди `null` |
| `task` | опційний (`null` означає «без дати») | завжди `null`; має `isCompleted`, `completedAt`, `priority` |

Список: `from` і `to` передаються лише разом, `to > from`, діапазон до 400 днів. З діапазоном повертаються події, що його перетинають;
без діапазону всі події, включно із задачами без дати. Приховані календарі виключаються, якщо не передано `includeHidden=true`
або календар не названо в `calendars`. `q` шукає підрядок у назві та описі без урахування регістру. Сортування за `startAt`, ліміт 2000.

Подія, на яку мене запросили з чужого календаря, після прийняття запрошення з'являється у списку з `calendar` = мій головний календар,
`isInvited: true` і `sourceCalendar: { id, name, color }`. Вона доступна лише для читання.

`event`: `{ id, title, description, type, calendar, creator, startAt, endAt, allDay, color, location, reminderMinutesBefore, isCompleted, completedAt, priority, participants: [{ user, name, email, status: 'pending' \| 'accepted' \| 'declined', invitedAt, respondedAt }], isInvited, sourceCalendar, createdAt, updatedAt }`

У `PATCH` поле `participants` є повним новим списком email: нові отримують запрошення, відсутні прибираються.

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

## Holidays

| Метод | Шлях | Доступ | Query | Відповідь |
|---|---|---|---|---|
| GET | `/holidays` | ✓ | `?year=2026&country=UA`; за замовчуванням поточний рік і країна з профілю | `200 { country, year, holidays: [{ date: 'YYYY-MM-DD', localName, name }], fetchedAt, isStale }` |

Джерело: `https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}`. Відповідь кешується в MongoDB за парою країна+рік на 30 днів.
Якщо зовнішній сервіс недоступний, віддається застарілий кеш з `isStale: true`; без кешу `502`. Невідома країна або рік поза діапазоном сервісу: `400`.

## Пошта

Листи (запрошення, скидання пароля) надсилає nodemailer через SMTP зі змінних `SMTP_*`. Якщо `SMTP_HOST` порожній,
лист не надсилається, а друкується в консоль бекенду разом із посиланням. Помилка пошти не ламає запит.

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
