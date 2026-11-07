# Chronos

Веб-сервіс планування часу (календар) — ucode connect Full Stack challenge.
Стек: Node.js + Express, MongoDB + Mongoose, React (Vite), Docker. Мова інтерфейсу — українська.

## Дизайн (джерело правди)

- Папка `design/`: `design/README.md` (екрани, компоненти, поведінка), `design/tokens.css` (CSS-змінні),
  `design/screens/*.html` (16 статичних мокапів усіх екранів, відкриваються в браузері).
- Перед будь-яким екраном або компонентом відкрий відповідний файл у `design/screens/` і відтвори його
  структуру, відступи, радіуси, кольори точно. Нові кольори не вигадуй — тільки змінні з `design/tokens.css`
  (підключи як `frontend/src/styles/tokens.css`).
- Шрифт Inter (Google Fonts, 400/500/600/700). Іконки — Lucide (тонкий stroke), без емодзі.
- Акцентний синій `--accent` лише для «сьогодні», лінії «зараз», фокусу й посилань. Головні кнопки темні
  (`--dark`), вторинні — білі з рамкою `--line`; усі кнопки й навігація — пілюлі (radius 999).
- Події фарбуються кольором календаря (пара tint/text у tokens.css); у спільному календарі — кольором учасника.
- Три типи подій виглядають по-різному (таблиця в `design/README.md`): зустріч — тінт-блок висотою = тривалість,
  нагадування — біла пілюля з дзвіночком, задача — блок з чекбоксом.
- Навігація: хедер Огляд · Календар · Задачі · Календарі; у календарі перемикач День · Тиждень · Місяць · Рік;
  у тижні додатково Картки | Стрічка часу.
- Два способи створити подію: модалка по кліку на вільний слот (`11-event-quick-modal.html`) і окрема сторінка
  (`10-event-create.html`). Клік на подію — модалка деталей (`12-event-details.html`).
- Мобільна версія — `16-mobile.html` (нижня навігація, FAB «+»).
- Стилі: CSS Modules зі змінними з tokens.css; інлайнові стилі з мокапів переносити в класи, не копіювати як є.

## Правила роботи

- Рішення команди від 2026-11-06: верстку фронтенду (сторінки, компоненти, CSS Modules) за мокапами з `design/`
  генерує Claude; бекенд-логіку (контролери, сервіси, валідацію, тести) пишуть люди, Claude пояснює, робить ревʼю
  і допомагає з дебагом. Памʼятай: ТЗ вимагає, щоб команда розуміла і могла пояснити кожен рядок, який здає.
- Фронт працює на мок-даних із `frontend/src/mocks/data.js` через провайдери в `frontend/src/app/providers/`;
  підключення до API — заміна моків у провайдерах на функції з `frontend/src/api/*`, формат даних уже збігається з `docs/api.md`.
- Довідник UI-кита, хуків і правил верстки — `frontend/README.md`. Нові компоненти — тільки через нього.
- Стайл-гайди: Airbnb (React/JS), Node.js Best Practices, Mongoose style guide, Docker best practices.
- Дати зберігати в UTC (ISO), показувати в локальному часі користувача; номери тижнів — ISO 8601.
- Головний календар створюється при реєстрації; його не можна видалити або сховати.
- Приховування календаря — налаштування користувача (членства), не самого календаря.

## Структура репозиторію

- Монорепо без workspaces: `backend/` і `frontend/` мають власні `package.json`, лінтери й Dockerfile.
- `backend/src/modules/<feature>/` — feature-first: `*.model.js` (Mongoose), `*.routes.js`, `*.controller.js`,
  `*.service.js`, `*.validation.js` (Joi). Усі роутери реєструються в `src/app.js` під `/api/...`.
  Спільне: `src/middlewares/` (auth, validate, errorHandler, notFound, calendarAccess), `src/utils/`
  (ApiError, asyncHandler, dates, mailer), `src/config/` (env, db), `src/constants/`.
- `frontend/src/`: `app/` (App, router, providers, RequireAuth), `api/` (axios-клієнт і функції запитів по модулях),
  `components/{layout,ui,calendar,tasks,calendars}/`, `pages/`, `modals/`, `hooks/`, `utils/`, `styles/`.
  Кожен компонент — пара `Name.jsx` + `Name.module.css`, у шапці файлу коментар `// Дизайн: design/screens/NN-xxx.html`.
- `docs/` — CBL-прогрес, API, модель даних, алгоритм, команда, ТЗ. `design/` — не чіпати, лише читати.
- Docker: `docker-compose.yml` (prod-подібний, nginx + зібраний фронт, порт 3000), `docker-compose.dev.yml`
  (hot reload, Vite на 5173). Змінні з `.env` у корені, зразок — `.env.example`.
- Ключові рішення: ESM усюди; дати в БД — UTC `Date`, в API — ISO 8601 з `Z`, на фронті — локальний час через `Intl`;
  JWT access у пам'яті фронту + refresh у httpOnly cookie; власник календаря теж є записом у `members[]`
  (роль `owner`), права перевіряє `calendarAccess(minRole)`; свята — віртуальний календар `holidays` з кешу
  `HolidayCache` по `country+year`, не події в БД; стан подання календаря — в URL (`?date=`, `?event=`).
