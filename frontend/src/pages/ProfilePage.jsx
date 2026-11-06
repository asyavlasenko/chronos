// Дизайн: design/screens/14-profile.html
// Профіль: акаунт, налаштування календаря (країна, часовий пояс, тривалість зустрічі, початок тижня,
// формат часу, номери тижнів), сповіщення, безпека; праворуч — головний календар і статистика.
import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useCalendars from '../hooks/useCalendars';
import useEvents from '../hooks/useEvents';
import { getViewRange, MONTHS_GENITIVE, toDate } from '../utils/dates';
import { initials, plural } from '../utils/text';
import Icon from '../components/ui/Icon';
import Card from '../components/ui/Card';
import Avatar from '../components/ui/Avatar';
import Field from '../components/ui/Field';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import SegmentedControl from '../components/ui/SegmentedControl';
import Toggle from '../components/ui/Toggle';
import PillButton from '../components/ui/PillButton';
import styles from './ProfilePage.module.css';

const COUNTRIES = [
  { value: 'UA', label: 'Україна' },
  { value: 'PL', label: 'Польща' },
  { value: 'DE', label: 'Німеччина' },
  { value: 'US', label: 'США' },
];

const TIMEZONES = [
  { value: 'Europe/Kyiv', label: 'Київ (UTC+02:00)' },
  { value: 'Europe/Warsaw', label: 'Варшава (UTC+01:00)' },
  { value: 'Europe/Berlin', label: 'Берлін (UTC+01:00)' },
  { value: 'Europe/London', label: 'Лондон (UTC+00:00)' },
  { value: 'America/New_York', label: 'Нью-Йорк (UTC−05:00)' },
];

const DURATIONS = ['30', '45', '60', '90'].map((v) => ({ value: v, label: `${v} хв` }));
const WEEK_STARTS = [
  { value: '1', label: 'Понеділок' },
  { value: '0', label: 'Неділя' },
];
const TIME_FORMATS = [
  { value: '24h', label: '24 год' },
  { value: '12h', label: '12 год' },
];

const MIN_PASSWORD = 8;

/** Поля профілю, які редагуються на цій сторінці (формат = PATCH /users/me). */
const toForm = (user) => ({
  country: user.country || 'UA',
  timezone: user.timezone || 'Europe/Kyiv',
  defaultArrangementDuration: user.defaultArrangementDuration ?? 60,
  weekStartsOn: user.weekStartsOn ?? 1,
  timeFormat: user.timeFormat || '24h',
  showWeekNumbers: Boolean(user.showWeekNumbers),
  notifications: {
    emailReminders: true,
    push: false,
    sharedCalendarEmails: true,
    ...user.notifications,
  },
});

/** «Змінено 2 місяці тому» за датою останньої зміни пароля. */
function passwordChangedLabel(changedAt) {
  if (!changedAt) return 'Ще не змінювався';
  const d = toDate(changedAt);
  const now = new Date();
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (months <= 0) return 'Змінено цього місяця';
  return `Змінено ${months} ${plural(months, ['місяць', 'місяці', 'місяців'])} тому`;
}

/** «вересня 2026» для рядка «З нами з». */
function memberSinceLabel(createdAt) {
  if (!createdAt) return '—';
  const d = toDate(createdAt);
  return `${MONTHS_GENITIVE[d.getMonth()]} ${d.getFullYear()}`;
}

function Row({ title, hint = null, children }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowText}>
        <b className={styles.rowTitle}>{title}</b>
        {hint ? <span className={styles.rowHint}>{hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

Row.propTypes = {
  title: PropTypes.node.isRequired,
  hint: PropTypes.node,
  children: PropTypes.node.isRequired,
};

function SectionHead({ title }) {
  return (
    <div className={styles.sectionHead}>
      <h2 className={styles.sectionTitle}>{title}</h2>
    </div>
  );
}

SectionHead.propTypes = {
  title: PropTypes.string.isRequired,
};

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const { calendars } = useCalendars();
  const monthRange = useMemo(() => getViewRange('month', new Date()), []);
  const { events } = useEvents(monthRange);

  const [form, setForm] = useState(() => toForm(user || {}));
  const [saved, setSaved] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [passwordError, setPasswordError] = useState(null);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [sessionsEnded, setSessionsEnded] = useState(false);

  const mainCalendar = calendars.find((c) => c.isMain) || null;
  const stats = useMemo(
    () => ({
      calendars: calendars.length,
      shared: calendars.filter((c) => c.isShared).length,
      monthEvents: events.filter((e) => e.type !== 'holiday').length,
    }),
    [calendars, events],
  );

  if (!user) return null;

  const patch = (changes) => {
    setForm((f) => ({ ...f, ...changes }));
    setSaved(false);
  };
  const patchNotifications = (changes) =>
    patch({ notifications: { ...form.notifications, ...changes } });

  const onSave = () => {
    updateUser(form);
    setSaved(true);
  };

  const onPasswordSubmit = (e) => {
    e.preventDefault();
    if (passwords.next.length < MIN_PASSWORD) {
      setPasswordError(`Мінімум ${MIN_PASSWORD} символів`);
      return;
    }
    // TODO(@teammate2): PATCH /users/me/password; зараз — заглушка
    setPasswordError(null);
    setPasswords({ current: '', next: '' });
    setPasswordOpen(false);
    setPasswordChanged(true);
  };

  const emailStatus = user.isEmailVerified ? 'email підтверджено' : 'email не підтверджено';
  let passwordHint = passwordChangedLabel(user.passwordChangedAt);
  if (passwordChanged) passwordHint = 'Щойно змінено';

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <Card as="section" aria-label="Акаунт" padding="20px" gap={0} className={styles.account}>
          <Avatar initials={initials(user.name)} color="graphite" size={64} title={user.name} />
          <div className={styles.accountText}>
            <h1 className={styles.name}>{user.name}</h1>
            <span className={styles.email}>
              {user.email} · {emailStatus}
            </span>
          </div>
          <PillButton variant="secondary" size="sm" className={styles.photoBtn}>
            Змінити фото
          </PillButton>
        </Card>

        <Card as="section" aria-label="Календар" padding="0" gap={0} className={styles.section}>
          <SectionHead title="Календар" />
          <Row title="Країна" hint="Від неї залежить календар державних свят">
            <Select
              size="sm"
              aria-label="Країна"
              leading={<Icon name="globe" size={14} />}
              options={COUNTRIES}
              value={form.country}
              onChange={(country) => patch({ country })}
            />
          </Row>
          <Row title="Часовий пояс" hint="Події зберігаються в UTC і показуються у твоєму часі">
            <Select
              size="sm"
              aria-label="Часовий пояс"
              options={TIMEZONES}
              value={form.timezone}
              onChange={(timezone) => patch({ timezone })}
            />
          </Row>
          <Row
            title="Тривалість зустрічі за замовчуванням"
            hint="Підставляється, коли створюєш зустріч"
          >
            <SegmentedControl
              role="radiogroup"
              label="Тривалість"
              size="sm"
              bg="muted"
              options={DURATIONS}
              value={String(form.defaultArrangementDuration)}
              onChange={(v) => patch({ defaultArrangementDuration: Number(v) })}
            />
          </Row>
          <Row title="Початок тижня" hint="Нумерація тижнів — за ISO 8601">
            <SegmentedControl
              role="radiogroup"
              label="Початок тижня"
              size="sm"
              bg="muted"
              options={WEEK_STARTS}
              value={String(form.weekStartsOn)}
              onChange={(v) => patch({ weekStartsOn: Number(v) })}
            />
          </Row>
          <Row title="Формат часу">
            <SegmentedControl
              role="radiogroup"
              label="Формат часу"
              size="sm"
              bg="muted"
              options={TIME_FORMATS}
              value={form.timeFormat}
              onChange={(timeFormat) => patch({ timeFormat })}
            />
          </Row>
          <Row title="Показувати номери тижнів" hint="У тижневому й місячному поданні">
            <Toggle
              label="Показувати номери тижнів"
              checked={form.showWeekNumbers}
              onChange={(showWeekNumbers) => patch({ showWeekNumbers })}
            />
          </Row>
        </Card>

        <Card as="section" aria-label="Сповіщення" padding="0" gap={0} className={styles.section}>
          <SectionHead title="Сповіщення" />
          <Row title="Нагадування на email" hint="За 10 хв до події, якщо не вказано інше">
            <Toggle
              label="Нагадування на email"
              checked={form.notifications.emailReminders}
              onChange={(emailReminders) => patchNotifications({ emailReminders })}
            />
          </Row>
          <Row title="Push у браузері" hint="Потрібен дозвіл браузера">
            <Toggle
              label="Push у браузері"
              checked={form.notifications.push}
              onChange={(push) => patchNotifications({ push })}
            />
          </Row>
          <Row
            title="Запрошення та зміни у спільних календарях"
            hint="Лист, коли тебе запрошують або змінюють подію"
          >
            <Toggle
              label="Листи про запрошення"
              checked={form.notifications.sharedCalendarEmails}
              onChange={(sharedCalendarEmails) => patchNotifications({ sharedCalendarEmails })}
            />
          </Row>
        </Card>

        <Card as="section" aria-label="Безпека" padding="0" gap={0} className={styles.section}>
          <SectionHead title="Безпека" />
          <Row title="Пароль" hint={passwordHint}>
            <PillButton
              variant="secondary"
              size="sm"
              shape="rounded"
              className={styles.rowCtl}
              aria-expanded={passwordOpen}
              onClick={() => setPasswordOpen((v) => !v)}
            >
              Змінити пароль
            </PillButton>
          </Row>
          {passwordOpen ? (
            <form
              className={styles.passwordForm}
              aria-label="Зміна пароля"
              onSubmit={onPasswordSubmit}
              noValidate
            >
              <Field label="Поточний пароль" htmlFor="pw-current">
                <Input
                  id="pw-current"
                  size="sm"
                  type="password"
                  autoComplete="current-password"
                  value={passwords.current}
                  onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
                />
              </Field>
              <Field label="Новий пароль" htmlFor="pw-next" error={passwordError}>
                <Input
                  id="pw-next"
                  size="sm"
                  type="password"
                  autoComplete="new-password"
                  value={passwords.next}
                  invalid={Boolean(passwordError)}
                  aria-invalid={Boolean(passwordError)}
                  onChange={(e) => {
                    const { value } = e.target;
                    setPasswords((p) => ({ ...p, next: value }));
                    setPasswordError(null);
                  }}
                />
              </Field>
              <div className={styles.passwordActions}>
                <PillButton type="submit" size="sm">
                  Зберегти
                </PillButton>
                <PillButton variant="ghost" size="sm" onClick={() => setPasswordOpen(false)}>
                  Скасувати
                </PillButton>
              </div>
            </form>
          ) : null}
          <Row
            title="Вийти на всіх пристроях"
            hint={
              sessionsEnded
                ? 'Сесії на інших пристроях завершено'
                : 'Завершить сесії на телефоні та інших браузерах'
            }
          >
            <PillButton
              variant="danger"
              size="sm"
              shape="rounded"
              className={styles.rowCtl}
              onClick={() => setSessionsEnded(true)}
            >
              Вийти всюди
            </PillButton>
          </Row>
        </Card>

        <div className={styles.actions}>
          <PillButton className={styles.save} onClick={onSave}>
            Зберегти зміни
          </PillButton>
          {saved ? (
            <span role="status" className={styles.saved}>
              Збережено
            </span>
          ) : null}
          <Link to="/login" onClick={() => logout()} className={styles.logout}>
            Вийти з акаунта
          </Link>
        </div>
      </div>

      <aside className={styles.side}>
        <Card variant="dark" padding="18px" gap={6}>
          <span className={styles.heroEyebrow}>Головний календар</span>
          <span className={styles.heroName}>{mainCalendar?.name || 'Основний'}</span>
          <span className={styles.heroText}>
            Створений разом з акаунтом. Його не можна видалити чи сховати — сюди потрапляють події
            без вибраного календаря.
          </span>
        </Card>
        <Card padding="18px" gap={8}>
          <span className={styles.statsTitle}>Статистика</span>
          <div className={styles.stat}>
            <span>Календарів</span>
            <b>{stats.calendars}</b>
          </div>
          <div className={styles.stat}>
            <span>Подій цього місяця</span>
            <b>{stats.monthEvents}</b>
          </div>
          <div className={styles.stat}>
            <span>Спільних календарів</span>
            <b>{stats.shared}</b>
          </div>
          <div className={styles.stat}>
            <span>З нами з</span>
            <b>{memberSinceLabel(user.createdAt)}</b>
          </div>
        </Card>
      </aside>
    </div>
  );
}
