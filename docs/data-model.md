# Chronos — модель даних

MongoDB + Mongoose. Усі колекції мають `createdAt`/`updatedAt` (timestamps). Дати — UTC.
Схеми: `backend/src/modules/*/*.model.js`. Перелічення: `backend/src/constants/index.js`.

```
User 1───∞ Calendar (owner)          Calendar 1───∞ Event
User ∞───∞ Calendar (members[])      User 1───∞ Event (creator)
User ∞───∞ Event (participants[])    Invite ──▶ Event | Calendar
HolidayCache (country, year) — незалежна, кеш зовнішнього API
```

## User

| Поле | Тип | Опис |
|---|---|---|
| email | String, unique, lowercase | логін |
| passwordHash | String, select: false | bcryptjs |
| name | String 2..80 | |
| avatarUrl | String \| null | |
| country | String(2), default 'UA' | ISO 3166-1 alpha-2, для свят |
| timezone | String, default 'Europe/Kyiv' | IANA |
| defaultArrangementDuration | Number, default 60 | хвилини, профіль пропонує 30/45/60/90 |
| weekStartsOn | 1 \| 0, default 1 | Пн / Нд |
| timeFormat | '24h' \| '12h' | |
| showWeekNumbers | Boolean, default true | |
| showHolidays | Boolean, default true | видимість віртуального календаря свят |
| notifications | { emailReminders, push, sharedCalendarEmails } | |
| isEmailVerified | Boolean | |
| emailVerificationToken, passwordResetToken, passwordResetExpiresAt | select: false | зберігати хеш токена |
| tokenVersion | Number, default 0 | ++ → усі refresh-токени недійсні («Вийти всюди») |

## Calendar

| Поле | Тип | Опис |
|---|---|---|
| name | String 1..60 | |
| description | String ..300 | |
| color | COLOR_KEY | graphite \| blue \| purple \| green \| orange \| pink |
| owner | ref User, index | |
| isMain | Boolean | головний: створюється при реєстрації, не видаляється, не ховається |
| members[] | [{ user, role, color, isHidden, joinedAt }] | **власник теж тут** з role 'owner' |

Індекси: `{ owner, isMain }` unique partial (isMain: true) — один головний на користувача; `{ 'members.user' }`.
Віртуальне `isShared = members.length > 1`.

`members[].color` — «мій колір подій у цьому календарі» (null = колір календаря).
`members[].isHidden` — приховування **для цього учасника**, не для календаря.

## Event

| Поле | Тип | Опис |
|---|---|---|
| title | String 1..120 | обов'язково |
| description | String ..2000 | |
| type | arrangement \| reminder \| task | обов'язково |
| calendar | ref Calendar | обов'язково |
| creator | ref User | обов'язково |
| startAt | Date \| null | arrangement: початок; reminder: момент; task: дедлайн (null = без дати) |
| endAt | Date \| null | лише arrangement, > startAt; за замовчуванням startAt + defaultArrangementDuration |
| allDay | Boolean | |
| color | COLOR_KEY \| null | null = колір календаря (у спільному — колір учасника-автора) |
| location | String ..200 | адреса, кімната або посилання на Meet |
| reminderMinutesBefore | Number 0..10080, default 10 | |
| isCompleted, completedAt | Boolean, Date | лише task |
| priority | low \| medium \| high | лише task |
| participants[] | [{ user \| null, email, status: pending \| accepted \| declined, invitedAt, respondedAt }] | user null, доки не зареєструвався |

Індекси: `{ calendar, startAt }`, `{ calendar, endAt }`, `{ creator, type }`, text `{ title, description }`, `{ 'participants.user' }`.

Перетин з діапазоном `[from, to)`: `startAt < to && (endAt > from || (endAt == null && startAt >= from))`.

## Invite

| Поле | Тип | Опис |
|---|---|---|
| kind | event \| calendar | |
| token | String, unique | у посиланні `${CLIENT_URL}/invite/${token}`; не віддається в списках |
| email | String | кого запрошено |
| invitedBy | ref User | |
| event / calendar | ref | рівно одне відповідно до kind |
| role | editor \| viewer | лише kind 'calendar' |
| status | pending \| accepted \| declined \| expired | |
| expiresAt | Date | +7 днів; без TTL-індексу (історія лишається) |
| respondedAt | Date \| null | |

Індекси: `{ email, status }`, `{ expiresAt }`, `{ event }`, `{ calendar }`.

## HolidayCache

| Поле | Тип | Опис |
|---|---|---|
| country | String(2) | |
| year | Number | |
| holidays[] | [{ date 'YYYY-MM-DD', localName, name, global, types[] }] | формат Nager.Date |
| fetchedAt | Date | оновлювати, якщо старіше 30 днів |

Індекс: `{ country, year }` unique. Свята **не** зберігаються як Event: фронт показує їх як
віртуальний read-only календар з id `holidays`.

## Відповідність дизайну

- Колір події в сітці: `event.color` → `members[creator].color` (якщо календар спільний) → `calendar.color`.
- Бейджі на екрані «Календарі»: `isMain` → «головний · не видаляється», `isShared` → «спільний»,
  `members[me].isHidden` → «прихований», `holidays` → «тільки читання».
- Групи на екрані «Задачі»: `startAt` сьогодні / цього тижня / `null` («Без дати») / `isCompleted`.
