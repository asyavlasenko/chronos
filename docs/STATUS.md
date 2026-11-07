# Chronos — стан проєкту

Оновлено: 2026-11-07. Що вже працює, що лишилось до Act: Basic, і в якому порядку це робити.
Чекліст вимог ТЗ — у [00-cbl-progress.md](00-cbl-progress.md), контракт API — в [api.md](api.md).

## Зроблено

### Інфраструктура
- [x] Монорепо `backend/` + `frontend/`, ESLint (Airbnb) і Prettier в обох частинах, лінт і збірка зелені.
- [x] Dockerfile для backend (dev/production стадії, non-root) і frontend (Vite build → nginx з проксі `/api` і SPA-fallback).
- [x] `docker-compose.yml` (mongo + backend + frontend, healthcheck-и) і `docker-compose.dev.yml` (hot reload).
- [x] `.env.example`, `.gitignore`, `.editorconfig`, CODEOWNERS, шаблон PR.
- [x] Репозиторій на GitHub: `asyavlasenko/chronos`.

### Backend (каркас, без бізнес-логіки)
- [x] Express-застосунок: helmet, cors, json, cookie-parser, `GET /api/health`, 404, централізований error handler.
- [x] Підключення Mongoose з повторними спробами, graceful shutdown, обробники необроблених помилок.
- [x] Моделі з індексами й timestamps: `User`, `Calendar` (members[] з ролями), `Event` (3 типи), `Invite`, `HolidayCache`.
- [x] Усі маршрути з `docs/api.md` зареєстровані, контролери повертають `501 TODO(@власник)`.
- [x] Middleware `validate` (Joi) працює; `auth` і `calendarAccess` — заглушки з описом алгоритму.
- [x] Утиліти `ApiError`, `asyncHandler`; заглушки `mailer`, `dates`.
- [x] Smoke-тест Jest + supertest для `/api/health` і 404.

### Frontend (повністю зверстано, працює на мок-даних)
- [x] UI-кит: кнопки, бейджі, чіпи, сегменти, картки, модалка, аватари, перемикачі, форми (`frontend/README.md`).
- [x] Календарні примітиви: годинна сітка з кліком по слоту, блоки трьох типів подій, лінія «зараз», вільні вікна, картка дня, міні-місяць, сітка місяця.
- [x] Усі 16 екранів з `design/screens`: Огляд, День, Тиждень (картки і стрічка часу), Місяць, Рік, Задачі, Календарі, Спільний календар, Нова/редагувати подію, Вхід/Реєстрація/Скидання, Профіль, Запрошення, 404, мобільна версія.
- [x] Модалки швидкого створення і деталей події; валідація форм з повідомленнями українською.
- [x] Поведінка на локальному стані: створення/редагування/видалення подій, виконання задач, приховування календарів, зміна ролей і кольорів учасників, прийняття запрошень.
- [x] Стан подання в URL (`?date=`, `?event=`), пошук з хедера (`?q=`), фільтри за календарями й типами.
- [x] Адаптив: бічні панелі ≤1000px, мобільна навігація, FAB і модалки знизу ≤768px.

### Документація
- [x] README зі скріншотами, запуском, структурою і командою.
- [x] `docs/`: CBL-прогрес (шаблон з чеклістом Basic), API, модель даних, алгоритм (заготовка), команда і git-flow.

## Треба зробити (Act: Basic)

Порядок — за залежностями: без auth фронт не підключити до API, без calendars немає прав для events.

### Backend — @nastia
- [ ] `auth`: реєстрація (bcrypt, створення головного календаря в тій самій операції), вхід, refresh з ротацією, logout, скидання пароля через лист. JWT access + refresh у httpOnly cookie.
- [ ] `middlewares/auth.js`: перевірка Bearer-токена замість заглушки. **Зараз пропускає всі запити — прибрати до першого деплою.**
- [ ] `users`: `GET/PATCH /me`, зміна пароля, «вийти всюди» через `tokenVersion`.
- [ ] `calendars`: CRUD, заборона видалити/сховати `isMain`, `visibility` як налаштування учасника, `share` → `Invite`, зміна ролі і видалення учасника.
- [ ] `middlewares/calendarAccess.js` і `assertCalendarRole` для перевірки owner/editor/viewer.
- [ ] `invites`: перегляд за токеном, accept/decline для подій і календарів, термін 7 днів.
- [ ] Joi-схеми у всіх `*.validation.js` (зараз `.unknown(true)`): прибрати після опису полів.

### Backend — @teammate1
- [ ] `events`: CRUD, `GET /events?from&to&calendars&types&q` з перетином діапазону і text-пошуком, дефолтна тривалість зустрічі з профілю, права editor/owner, `POST /:id/invite`.
- [ ] `holidays`: запит до Nager.Date, кеш у `HolidayCache` по `country+year`, застарілий кеш при недоступності API.
- [ ] `utils/mailer.js`: nodemailer-транспорт, листи запрошення і скидання пароля (не блокувати відповідь API при помилці SMTP).
- [ ] `utils/dates.js`: ISO-тиждень, межі подань, перетин інтервалів.
- [ ] `errorHandler`: мапінг помилок Mongoose (ValidationError, CastError, 11000) і JWT на 400/409/401.
- [ ] Тести: auth, calendars, events (supertest + тестова Mongo або mongodb-memory-server).

### Frontend — @teammate2
- [ ] Підключити провайдери до API: `AuthProvider` (refresh при старті, interceptor на 401), `CalendarsProvider`, `EventsProvider` (події, свята, запрошення) через `src/api/*`.
- [ ] `RequireAuth`: редірект на `/login`, стан завантаження.
- [ ] Стани завантаження і помилок на сторінках (скелетони, повідомлення).
- [ ] Прибрати `src/mocks/data.js` після переходу на API (лишити для тестів).
- [ ] Дрібниці з мокапів: відмінювання імен у текстах («від Максима»), Google-кнопка на auth — заглушка, «Змінити фото» і зміна пароля в профілі — заглушки.

### Інфраструктура і документація
- [ ] Перевірити `docker compose up --build` на машині з Docker (локально Docker не було).
- [ ] Замінити `@teammate1`, `@teammate2`, `@nastia` на реальні GitHub-логіни (CODEOWNERS, docs, README, `TODO(...)` у коді).
- [ ] Захист гілки `main` на GitHub (PR + 1 approve).
- [ ] CI: GitHub Actions з `npm run lint` і `npm test` для обох частин (опційно, але дешево).
- [ ] `docs/00-cbl-progress.md`: відповіді на guiding questions, записи після кожного етапу.
- [ ] `docs/algorithm.md`: доповнити після реалізації бекенду.
- [ ] README: оновити скріншоти на фінальні, розділ «Запуск» після перевірки Docker.
- [ ] Пост у LinkedIn (етап Share).

## Ідеї для Act: Creative (після Basic)
- [ ] AI-асистент календаря: чат, який створює події та шукає вільний час через виклик інструментів (варіанти провайдерів: Groq/Gemini безкоштовно, Ollama локально, Anthropic платно; єдиний адаптер у форматі OpenAI chat completions).
- [ ] Email-нагадування за N хвилин до події (перемикачі в профілі вже є).
- [ ] Push у браузері.
- [ ] Перетягування і зміна тривалості подій у стрічці часу (підказка в мокапі 03 уже є).
- [ ] Простий чат для спільних подій.

## Відомі обмеження
- Фронт працює лише на мок-даних; дані скидаються при перезавантаженні сторінки.
- Backend без MongoDB не стартує (10 спроб підключення і вихід) — для локальної розробки потрібен Docker або встановлена Mongo.
- Свята в моках — статичний список для України; реальні дані з'являться після реалізації `holidays`.
