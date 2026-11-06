# Chronos — алгоритм роботи програми

Вимога ТЗ (розділ Document): опис алгоритму всієї програми. Тут — верхньорівневий потік даних і
ключові сценарії. Деталі ендпоінтів — у [api.md](api.md), моделі — у [data-model.md](data-model.md).

## Архітектура

```
Браузер (React SPA) ──/api──▶ nginx ──▶ Express API ──▶ MongoDB
                                            │
                                            ├──▶ Nager.Date (свята, кеш у БД)
                                            └──▶ SMTP (nodemailer: запрошення, скидання пароля)
```

- Фронт тримає **access-токен у пам'яті**, refresh — у httpOnly cookie. Кожен запит до API йде з
  `Authorization: Bearer`. На 401 клієнт один раз робить `POST /auth/refresh` і повторює запит.
- Усі дати в БД і в API — **UTC, ISO 8601**. Фронт показує їх у часовому поясі з профілю.

## Сценарії

### 1. Реєстрація
1. `POST /auth/register` → валідація → хеш пароля → створити `User`.
2. У тій самій операції створити `Calendar { isMain: true, owner, members: [{ user, role: 'owner' }] }`.
3. Видати пару токенів; фронт переходить на Огляд.

<!-- TODO(@nastia): уточнити після реалізації -->

### 2. Завантаження подання календаря
1. Фронт обчислює межі подання (`utils/dates.getViewRange`) з `?date=` і налаштування `weekStartsOn` → `from`, `to` в UTC.
2. `GET /events?from&to&calendars&types&q` → бекенд відбирає календарі, де користувач є учасником і не сховав їх,
   шукає події з перетином діапазону, застосовує фільтри.
3. Паралельно `GET /holidays?year` → свята з кешу (або з Nager.Date, якщо кеш старіший за 30 днів).
4. Фронт об'єднує події та свята, розкладає по днях, позиціонує блоки: `top = (start − gridStart) × hourHeight`,
   `height = duration × hourHeight`.

<!-- TODO(@teammate1, @teammate2) -->

### 3. Створення події (два способи)
- Клік на вільний слот → `QuickCreateModal` з підставленими датою/часом → `POST /events` без переходу.
- Кнопка «Створити» → сторінка `/events/new` → та сама `POST /events`.
- Для arrangement без `endAt` бекенд ставить `startAt + defaultArrangementDuration` з профілю.
- Для кожного email в `participants` створюється `Invite(kind 'event')` і надсилається лист.

### 4. Спільний календар і права
1. Власник: `POST /calendars/:id/share { email, role }` → `Invite(kind 'calendar')` + лист.
2. Запрошений відкриває `/invite/:token` → `POST /invites/:token/accept` → додається в `members[]` з роллю.
3. Кожен запит до календаря/подій проходить `calendarAccess(minRole)`: роль береться з `members[]`,
   owner ≥ editor ≥ viewer. Editor змінює лише свої події, owner — будь-які.
4. Кожен учасник має свій `members[].color` — ним фарбуються його події для всіх.

### 5. Приховування і видалення календаря
- Сховати = `PATCH /calendars/:id/visibility { isHidden: true }` → змінюється лише запис поточного учасника.
- Видалити може лише owner; головний (`isMain`) не видаляється й не ховається (403).

### 6. Свята
`getHolidays(country, year)`: кеш `HolidayCache{country, year}` → якщо немає або застарів, запит до Nager.Date →
upsert у кеш. Якщо зовнішній API недоступний, повертається застарілий кеш. Країна — з профілю користувача.

<!-- TODO: доповнювати сценарії в міру реалізації (скидання пароля, пошук, задачі, адаптив) -->
