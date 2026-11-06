# Chronos — команда, гілки, правила

## Розподіл

| Хто | Backend | Frontend | Інше |
|---|---|---|---|
| **@nastia** (тех-лід) | `modules/auth`, `modules/users`, `modules/calendars`, `modules/invites`, `middlewares/auth.js`, `middlewares/calendarAccess.js`, `config/` | — (після auth може взяти AuthPage, ProfilePage, CalendarsPage) | Docker, README, `docs/team.md`, `docs/data-model.md`, рев'ю |
| **@teammate1** | `modules/events`, `modules/holidays`, `utils/mailer.js`, `utils/dates.js`, `middlewares/validate.js`, `middlewares/errorHandler.js`, пошук/фільтри | — | `tests/`, `docs/api.md` |
| **@teammate2** | — | увесь `frontend/`: подання день/тиждень/місяць/рік, модалки, форми, адаптив | скріншоти для README |

Кожна заглушка в коді має `TODO(@власник)` — шукай свої: `grep -rn "TODO(@teammate1)" backend/src`.
CODEOWNERS (`.github/CODEOWNERS`) призначає рев'юера автоматично.

## Порядок робіт (щоб не блокувати одне одного)

1. **Тиждень 1.** @nastia: auth + users (щоб фронт міг логінитись). @teammate1: events CRUD + dates.js.
   @teammate2: `ui/` + `layout/` компоненти за мокапами, AuthPage, роутер з заглушками даних.
2. **Тиждень 2.** @nastia: calendars + sharing + invites. @teammate1: holidays, пошук/фільтри, mailer.
   @teammate2: WeekPage, DayPage, MonthPage, QuickCreateModal, EventDetailsModal.
3. **Тиждень 3.** Інтеграція, YearPage, TasksPage, CalendarsPage, SharedCalendarPage, адаптив, тести, README зі скріншотами.

Контракт API зафіксований у `docs/api.md` — фронт може розроблятись на моках, поки бекенд повертає 501.

## Git-flow

- `main` — захищена: тільки через PR, мінімум 1 approve, без force push, CI (lint) зелений.
- Гілки від `main`: `feature/<area>-<short>`, напр. `feature/auth-login`, `feature/events-crud`,
  `feature/front-week-view`, `fix/events-overlap`, `docs/api-invites`, `chore/eslint`.
- Одна гілка = одна фіча/задача, PR невеликий (до ~400 рядків diff), squash merge.
- Перед PR: `git fetch && git rebase origin/main`, `npm run lint`, `npm test`.

## Conventional commits

```
<type>(<scope>): <короткий опис у наказовому способі>

feat(events): додати фільтр за типами в GET /events
fix(calendars): заборонити приховування головного календаря
docs(api): описати тіла відповідей invites
chore(docker): healthcheck для backend
refactor(front): винести EventBlock у calendar/
test(events): перетин діапазонів
```

Типи: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Scope — модуль або `front`/`docker`/`docs`.

## Правила PR

- Заповнений шаблон `.github/pull_request_template.md`.
- Для фронту — посилання на мокап, який відтворено, і скріншот.
- Для бекенду — приклад запиту/відповіді, оновлений `docs/api.md`.
- Бекенд-логіку пишемо самі; фронтенд-верстку за мокапами генерує Claude (рішення команди 2026-11-06). Кожен має розуміти і вміти пояснити код, який здає (вимога ТЗ).
- Рев'юер перевіряє: стайл-гайд, валідацію, обробку помилок, UTC-дати, відсутність секретів.

## Спільні домовленості

- Формат успішної відповіді API: об'єкт із ресурсом (`{ user }`, `{ events: [] }`), помилки —
  `{ status: 'error', message, details? }`, видалення — `204`.
- Повідомлення помилок і валідації — українською.
- Нові перелічення — тільки через `backend/src/constants/index.js`; кольори — ключі з `COLOR_KEYS`.
- Нові змінні середовища — одразу в `.env.example` і `docker-compose.yml`.
