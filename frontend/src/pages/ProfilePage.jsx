import { useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useCalendars from '../hooks/useCalendars';
import useEvents from '../hooks/useEvents';
import useTelegram from '../hooks/useTelegram';
import { parseApiError } from '../api/errors';
import { getViewRange, MONTHS_GENITIVE, toDate } from '../utils/dates';
import { initials } from '../utils/text';
import { AVATAR_ACCEPT, toAvatarDataUrl } from '../utils/image';
import Icon from '../components/ui/Icon';
import Card from '../components/ui/Card';
import Avatar from '../components/ui/Avatar';
import Field from '../components/ui/Field';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import SegmentedControl from '../components/ui/SegmentedControl';
import Toggle from '../components/ui/Toggle';
import PillButton from '../components/ui/PillButton';
import ThemePicker from '../components/profile/ThemePicker';
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
const EMPTY_PASSWORDS = { current: '', next: '' };

const toForm = (user) => ({
  name: user.name || '',
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

function memberSinceLabel(createdAt) {
  if (!createdAt) return '—';
  const d = toDate(createdAt);
  return `${MONTHS_GENITIVE[d.getMonth()]} ${d.getFullYear()}`;
}

function Row({ title, hint = null, error = null, children }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowText}>
        <b className={styles.rowTitle}>{title}</b>
        {error ? (
          <span role="alert" className={styles.rowError}>
            {error}
          </span>
        ) : null}
        {!error && hint ? <span className={styles.rowHint}>{hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

Row.propTypes = {
  title: PropTypes.node.isRequired,
  hint: PropTypes.node,
  error: PropTypes.node,
  children: PropTypes.node.isRequired,
};

function telegramHint({ status, isWaiting }) {
  if (isWaiting) return `Натисни «Start» у боті @${status.botUsername}, сторінка оновиться сама`;
  if (!status.isConnected) return 'Бот надсилатиме нагадування в особисті повідомлення';
  return status.username ? `Підключено: @${status.username}` : 'Підключено';
}

function TelegramRow() {
  const { status, pending, isWaiting, connect, disconnect, sendTest, cancel } = useTelegram();

  if (!status?.enabled) return null;

  return (
    <Row title="Нагадування в Telegram" hint={telegramHint({ status, isWaiting })}>
      <span className={styles.rowActions}>
        {status.isConnected ? (
          <>
            <PillButton
              variant="secondary"
              size="sm"
              disabled={pending !== null}
              onClick={sendTest}
            >
              Перевірити
            </PillButton>
            <PillButton variant="ghost" size="sm" disabled={pending !== null} onClick={disconnect}>
              Відключити
            </PillButton>
          </>
        ) : null}
        {!status.isConnected && isWaiting ? (
          <PillButton variant="ghost" size="sm" onClick={cancel}>
            Скасувати
          </PillButton>
        ) : null}
        {!status.isConnected && !isWaiting ? (
          <PillButton variant="secondary" size="sm" disabled={pending !== null} onClick={connect}>
            Підключити
          </PillButton>
        ) : null}
      </span>
    </Row>
  );
}

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
  const navigate = useNavigate();
  const { user, logout, updateUser, changePassword, logoutEverywhere } = useAuth();
  const { calendars } = useCalendars();
  const monthRange = useMemo(() => getViewRange('month', new Date()), []);
  const { events } = useEvents(monthRange);

  const [form, setForm] = useState(() => toForm(user || {}));
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [sessionsError, setSessionsError] = useState(null);
  const fileInputRef = useRef(null);

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
    setFieldErrors({});
    setStatus(null);
  };
  const patchNotifications = (changes) =>
    patch({ notifications: { ...form.notifications, ...changes } });

  const onSave = async () => {
    setPending('save');
    setFieldErrors({});
    setStatus(null);
    try {
      const nextUser = await updateUser({ ...form, name: form.name.trim() });
      setForm(toForm(nextUser));
      setStatus({ type: 'success', text: 'Збережено' });
    } catch (error) {
      const parsed = parseApiError(error);
      setFieldErrors(parsed.fields);
      setStatus({ type: 'error', text: parsed.message });
    } finally {
      setPending(null);
    }
  };

  const saveAvatar = async (avatarUrl) => {
    setPending('avatar');
    setStatus(null);
    try {
      await updateUser({ avatarUrl });
      setStatus({ type: 'success', text: avatarUrl ? 'Фото оновлено' : 'Фото прибрано' });
    } catch (error) {
      setStatus({ type: 'error', text: parseApiError(error).message });
    } finally {
      setPending(null);
    }
  };

  const onAvatarPicked = async (e) => {
    const [file] = e.target.files;
    e.target.value = '';
    if (!file) return;

    try {
      await saveAvatar(await toAvatarDataUrl(file));
    } catch (error) {
      setStatus({ type: 'error', text: error.message });
    }
  };

  const closePasswordForm = () => {
    setPasswordOpen(false);
    setPasswords(EMPTY_PASSWORDS);
    setPasswordErrors({});
  };

  const setPassword = (key, errorKey) => (e) => {
    const { value } = e.target;
    setPasswords((p) => ({ ...p, [key]: value }));
    setPasswordErrors((er) => ({ ...er, [errorKey]: null, form: null }));
  };

  const onPasswordSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!passwords.current) nextErrors.currentPassword = 'Введи поточний пароль';
    if (passwords.next.length < MIN_PASSWORD) {
      nextErrors.newPassword = `Мінімум ${MIN_PASSWORD} символів`;
    }
    setPasswordErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending('password');
    try {
      await changePassword({ currentPassword: passwords.current, newPassword: passwords.next });
      closePasswordForm();
      setPasswordChanged(true);
    } catch (error) {
      const { fields, message } = parseApiError(error);
      const hasFieldError = Boolean(fields.currentPassword || fields.newPassword);
      setPasswordErrors({
        currentPassword: fields.currentPassword,
        newPassword: fields.newPassword,
        form: hasFieldError ? null : message,
      });
    } finally {
      setPending(null);
    }
  };

  const onLogoutEverywhere = async () => {
    setPending('everywhere');
    setSessionsError(null);
    try {
      await logoutEverywhere();
      navigate('/login', { replace: true });
    } catch (error) {
      setSessionsError(parseApiError(error).message);
      setPending(null);
    }
  };

  const onLogout = async () => {
    setPending('logout');
    setStatus(null);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      setStatus({ type: 'error', text: parseApiError(error).message });
      setPending(null);
    }
  };

  const isBusy = pending !== null;
  const emailStatus = user.isEmailVerified ? 'email підтверджено' : 'email не підтверджено';
  const passwordHint = passwordChanged ? 'Щойно змінено' : 'Для зміни потрібен поточний пароль';

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <Card as="section" aria-label="Акаунт" padding="20px" gap={16} className={styles.account}>
          <Avatar
            initials={initials(user.name)}
            color="graphite"
            size={72}
            title={user.name}
            src={user.avatarUrl}
          />
          <div className={styles.accountText}>
            <h1 className={styles.name}>{user.name}</h1>
            <span className={styles.email}>
              {user.email} · {emailStatus}
            </span>
          </div>
          <div className={styles.accountActions}>
            <input
              ref={fileInputRef}
              className={styles.fileInput}
              type="file"
              accept={AVATAR_ACCEPT}
              aria-label="Файл з фото профілю"
              onChange={onAvatarPicked}
            />
            <PillButton
              variant="secondary"
              size="sm"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              {user.avatarUrl ? 'Змінити фото' : 'Додати фото'}
            </PillButton>
            {user.avatarUrl ? (
              <PillButton
                variant="ghost"
                size="sm"
                disabled={isBusy}
                onClick={() => saveAvatar(null)}
              >
                Прибрати
              </PillButton>
            ) : null}
          </div>
        </Card>

        <Card as="section" aria-label="Профіль" padding="0" gap={0} className={styles.section}>
          <SectionHead title="Профіль" />
          <Row
            title="Ім'я"
            hint="Так тебе бачать учасники спільних календарів"
            error={fieldErrors.name}
          >
            <Input
              size="sm"
              aria-label="Ім'я"
              className={styles.nameInput}
              value={form.name}
              maxLength={80}
              invalid={Boolean(fieldErrors.name)}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Row>
        </Card>

        <Card as="section" aria-label="Оформлення" padding="0" gap={0} className={styles.section}>
          <SectionHead title="Оформлення" />
          <ThemePicker />
        </Card>

        <Card as="section" aria-label="Календар" padding="0" gap={0} className={styles.section}>
          <SectionHead title="Календар" />
          <Row
            title="Країна"
            hint="Від неї залежить календар державних свят"
            error={fieldErrors.country}
          >
            <Select
              size="sm"
              aria-label="Країна"
              leading={<Icon name="globe" size={14} />}
              options={COUNTRIES}
              value={form.country}
              onChange={(country) => patch({ country })}
            />
          </Row>
          <Row
            title="Часовий пояс"
            hint="Події зберігаються в UTC і показуються у твоєму часі"
            error={fieldErrors.timezone}
          >
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
            error={fieldErrors.defaultArrangementDuration}
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
          <Row
            title="Початок тижня"
            hint="Нумерація тижнів — за ISO 8601"
            error={fieldErrors.weekStartsOn}
          >
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
          <Row title="Формат часу" error={fieldErrors.timeFormat}>
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
          <Row
            title="Показувати номери тижнів"
            hint="У тижневому й місячному поданні"
            error={fieldErrors.showWeekNumbers}
          >
            <Toggle
              label="Показувати номери тижнів"
              checked={form.showWeekNumbers}
              onChange={(showWeekNumbers) => patch({ showWeekNumbers })}
            />
          </Row>
        </Card>

        <Card as="section" aria-label="Сповіщення" padding="0" gap={0} className={styles.section}>
          <SectionHead title="Сповіщення" />
          <Row
            title="Нагадування на email"
            hint="За 10 хв до події, якщо не вказано інше"
            error={fieldErrors['notifications.emailReminders']}
          >
            <Toggle
              label="Нагадування на email"
              checked={form.notifications.emailReminders}
              onChange={(emailReminders) => patchNotifications({ emailReminders })}
            />
          </Row>
          <Row
            title="Запрошення та зміни у спільних календарях"
            hint="Лист, коли тебе запрошують або змінюють подію"
            error={fieldErrors['notifications.sharedCalendarEmails']}
          >
            <Toggle
              label="Листи про запрошення"
              checked={form.notifications.sharedCalendarEmails}
              onChange={(sharedCalendarEmails) => patchNotifications({ sharedCalendarEmails })}
            />
          </Row>
          <TelegramRow />
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
              onClick={() => (passwordOpen ? closePasswordForm() : setPasswordOpen(true))}
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
              <Field
                label="Поточний пароль"
                htmlFor="pw-current"
                error={passwordErrors.currentPassword}
              >
                <Input
                  id="pw-current"
                  size="sm"
                  type="password"
                  autoComplete="current-password"
                  value={passwords.current}
                  invalid={Boolean(passwordErrors.currentPassword)}
                  aria-invalid={Boolean(passwordErrors.currentPassword)}
                  onChange={setPassword('current', 'currentPassword')}
                />
              </Field>
              <Field label="Новий пароль" htmlFor="pw-next" error={passwordErrors.newPassword}>
                <Input
                  id="pw-next"
                  size="sm"
                  type="password"
                  autoComplete="new-password"
                  value={passwords.next}
                  invalid={Boolean(passwordErrors.newPassword)}
                  aria-invalid={Boolean(passwordErrors.newPassword)}
                  onChange={setPassword('next', 'newPassword')}
                />
              </Field>
              {passwordErrors.form ? (
                <p role="alert" className={styles.passwordError}>
                  {passwordErrors.form}
                </p>
              ) : null}
              <div className={styles.passwordActions}>
                <PillButton type="submit" size="sm" disabled={isBusy}>
                  {pending === 'password' ? 'Зберігаємо…' : 'Зберегти'}
                </PillButton>
                <PillButton variant="ghost" size="sm" onClick={closePasswordForm}>
                  Скасувати
                </PillButton>
              </div>
            </form>
          ) : null}
          <Row
            title="Вийти на всіх пристроях"
            hint="Завершить сесії на цьому та інших пристроях"
            error={sessionsError}
          >
            <PillButton
              variant="danger"
              size="sm"
              shape="rounded"
              className={styles.rowCtl}
              disabled={isBusy}
              onClick={onLogoutEverywhere}
            >
              {pending === 'everywhere' ? 'Виходимо…' : 'Вийти всюди'}
            </PillButton>
          </Row>
        </Card>

        <div className={styles.actions}>
          <PillButton className={styles.save} disabled={isBusy} onClick={onSave}>
            {pending === 'save' ? 'Зберігаємо…' : 'Зберегти зміни'}
          </PillButton>
          {status?.type === 'success' ? (
            <span role="status" className={styles.saved}>
              {status.text}
            </span>
          ) : null}
          {status?.type === 'error' ? (
            <span role="alert" className={styles.failed}>
              {status.text}
            </span>
          ) : null}
          <button type="button" className={styles.logout} disabled={isBusy} onClick={onLogout}>
            {pending === 'logout' ? 'Виходимо…' : 'Вийти з акаунта'}
          </button>
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
