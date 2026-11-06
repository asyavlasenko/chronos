# Chronos — API

База: `/api`. Формат — JSON. Дати — ISO 8601 в UTC (`2026-11-05T09:00:00.000Z`).
Авторизація: `Authorization: Bearer <accessToken>` (колонка «Auth»: ✓ — потрібен токен, роль — мінімальна роль у календарі).
Refresh-токен — httpOnly cookie `refreshToken`.

**Успіх:** об'єкт із ресурсом (`{ user }`, `{ events: [...] }`), видалення — `204 No Content`.
**Помилка:** `{ "status": "error", "message": "…", "details": [{ "field": "email", "message": "…" }] }`
з кодами `400` валідація, `401` не авторизовано, `403` немає прав, `404` не знайдено, `409` конфлікт, `501` ще не реалізовано.

Стан: усі ендпоінти повертають `501 { message: "TODO(@власник): …" }`, доки власник їх не реалізує.

## Health

| Метод | Шлях | Auth | Відповідь |
|---|---|---|---|
| GET | `/health` | — | `200 { "status": "ok" }` |

## Auth (@nastia)

| Метод | Шлях | Auth | Тіло запиту | Відповідь |
|---|---|---|---|---|
| POST | `/auth/register` | — | `{ email, password, name, country?, timezone? }` | `201 { user, accessToken }` + cookie; створює головний календар |
| POST | `/auth/login` | — | `{ email, password, remember? }` | `200 { user, accessToken }` + cookie |
| POST | `/auth/logout` | ✓ | — | `204`, cookie очищено |
| POST | `/auth/refresh` | cookie | — | `200 { accessToken }` + новий cookie |
| POST | `/auth/password-reset` | — | `{ email }` | `202` (завжди, щоб не розкривати наявність email) |
| POST | `/auth/password-reset/confirm` | — | `{ token, password }` | `204` |

## Users (@nastia)

| Метод | Шлях | Auth | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/users/me` | ✓ | — | `200 { user }` |
| PATCH | `/users/me` | ✓ | `{ name?, avatarUrl?, country?, timezone?, defaultArrangementDuration?, weekStartsOn?, timeFormat?, showWeekNumbers?, showHolidays?, notifications? }` | `200 { user }` |
| POST | `/users/me/password` | ✓ | `{ currentPassword, newPassword }` | `204` |
| POST | `/users/me/logout-everywhere` | ✓ | — | `204` (tokenVersion++) |

`user`: `{ id, email, name, avatarUrl, country, timezone, defaultArrangementDuration, weekStartsOn, timeFormat, showWeekNumbers, showHolidays, notifications, isEmailVerified, createdAt }`

## Calendars (@nastia)

| Метод | Шлях | Auth | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/calendars` | ✓ | — | `200 { calendars: [calendar] }` — усі, де я учасник (з моїми `isHidden`, `myColor`, `myRole`) |
| POST | `/calendars` | ✓ | `{ name, description?, color }` | `201 { calendar }` |
| GET | `/calendars/:id` | viewer | — | `200 { calendar }` з `members[]` (user populated: id, name, email) |
| PATCH | `/calendars/:id` | owner | `{ name?, description?, color? }` | `200 { calendar }` |
| DELETE | `/calendars/:id` | owner | — | `204`; `403` якщо `isMain`; видаляє події та запрошення |
| PATCH | `/calendars/:id/visibility` | viewer | `{ isHidden?, color? }` | `200 { membership }`; `403` для `isMain` при `isHidden: true` |
| POST | `/calendars/:id/share` | owner | `{ email, role: 'editor' \| 'viewer' }` | `201 { invite }` + лист |
| PATCH | `/calendars/:id/members/:userId` | owner | `{ role }` | `200 { calendar }`; власника змінити не можна |
| DELETE | `/calendars/:id/members/:userId` | owner | — | `204` |

`calendar`: `{ id, name, description, color, owner, isMain, isShared, members: [{ user, role, color, isHidden, joinedAt }], myRole, myColor, isHidden, createdAt }`

## Events (@teammate1)

| Метод | Шлях | Auth | Тіло / query | Відповідь |
|---|---|---|---|---|
| GET | `/events` | ✓ | `?from=ISO&to=ISO&calendars=id1,id2&types=arrangement,task&q=текст` | `200 { events: [event] }` — лише видимі (не приховані) календарі |
| POST | `/events` | editor у `calendar` | `{ title, type, calendar, startAt, endAt?, allDay?, color?, location?, description?, reminderMinutesBefore?, priority?, participants?: [email] }` | `201 { event }`; для arrangement без `endAt` → `startAt + defaultArrangementDuration` |
| GET | `/events/:id` | viewer | — | `200 { event }` |
| PATCH | `/events/:id` | editor (свої) / owner | ті самі поля + `isCompleted?` | `200 { event }` |
| DELETE | `/events/:id` | editor (свої) / owner | — | `204` |
| POST | `/events/:id/invite` | editor (свої) / owner | `{ emails: [email] }` | `200 { event }` + листи |

`event`: `{ id, title, description, type, calendar, creator, startAt, endAt, allDay, color, location, reminderMinutesBefore, isCompleted, completedAt, priority, participants: [{ user, email, status, invitedAt, respondedAt }], createdAt, updatedAt }`

Правила валідації: `title` 1..120; `type` ∈ arrangement|reminder|task; `startAt` обов'язково для arrangement і reminder;
`endAt` лише для arrangement і `> startAt`; `to − from` ≤ 366 днів; `q` ≤ 100 символів.

## Invites (@nastia)

| Метод | Шлях | Auth | Тіло | Відповідь |
|---|---|---|---|---|
| GET | `/invites` | ✓ | — | `200 { invites: [invite] }` — вхідні зі `status: pending` для мого email |
| GET | `/invites/:token` | — | — | `200 { invite }` з деталями події/календаря та запрошувачем; `410` якщо прострочено |
| POST | `/invites/:token/accept` | ✓ | — | `200 { invite }`; event → `participants[].status = accepted`, calendar → додано в `members[]` |
| POST | `/invites/:token/decline` | ✓ | — | `200 { invite }` |

`invite`: `{ id, kind, email, invitedBy: { id, name }, event?: { id, title, startAt, endAt, calendar }, calendar?: { id, name, color }, role?, status, expiresAt, createdAt }`

## Holidays (@teammate1)

| Метод | Шлях | Auth | Query | Відповідь |
|---|---|---|---|---|
| GET | `/holidays` | ✓ | `?year=2026&country=UA` (country за замовчуванням — з профілю) | `200 { country, year, holidays: [{ date: 'YYYY-MM-DD', localName, name }] }` |

Джерело: `https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}`. Кеш у `HolidayCache` по `country+year`, оновлення раз на 30 днів; при недоступності API — застарілий кеш.

## Приклади

```bash
curl -s http://localhost:4000/api/health
```

```bash
curl -s -X POST http://localhost:4000/api/auth/register -H 'Content-Type: application/json' -d '{"email":"asia@mail.com","password":"secret123","name":"Анастасія"}'
```

```bash
curl -s "http://localhost:4000/api/events?from=2026-11-02T00:00:00Z&to=2026-11-09T00:00:00Z" -H "Authorization: Bearer <token>"
```
