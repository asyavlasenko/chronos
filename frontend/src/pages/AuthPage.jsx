import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { parseApiError } from '../api/errors';
import cx from '../utils/cx';
import Icon from '../components/ui/Icon';
import Card from '../components/ui/Card';
import Field from '../components/ui/Field';
import Input from '../components/ui/Input';
import IconButton from '../components/ui/IconButton';
import Checkbox from '../components/ui/Checkbox';
import PillButton from '../components/ui/PillButton';
import PageLoader from '../components/ui/PageLoader';
import CheckEmailPanel from '../components/auth/CheckEmailPanel';
import styles from './AuthPage.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const MIN_PASSWORD = 8;
const MIN_NAME = 2;

const RESET_SENT = 'Якщо такий email існує, лист уже в дорозі';
const RESET_DONE = 'Пароль змінено, увійди з новим';
const LINK_INVALID = 'Посилання недійсне або прострочене';
const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

const TABS = [
  { mode: 'login', to: '/login', label: 'Вхід' },
  { mode: 'register', to: '/register', label: 'Реєстрація' },
];

const COPY = {
  login: {
    formLabel: 'Вхід',
    title: 'З поверненням',
    subtitle: 'Увійди, щоб побачити свої календарі та запрошення.',
    submit: 'Увійти',
    busy: 'Входимо…',
    footText: 'Немає акаунта?',
    footLink: 'Зареєструватися',
    footTo: '/register',
  },
  register: {
    formLabel: 'Реєстрація',
    title: 'Створи акаунт',
    subtitle: 'Головний календар створиться автоматично.',
    submit: 'Зареєструватися',
    busy: 'Створюємо акаунт…',
    footText: 'Уже є акаунт?',
    footLink: 'Увійти',
    footTo: '/login',
  },
  reset: {
    formLabel: 'Скидання пароля',
    title: 'Скидання пароля',
    subtitle: 'Надішлемо лист із посиланням.',
    submit: 'Надіслати лист',
    busy: 'Надсилаємо…',
    footText: 'Згадали пароль?',
    footLink: 'Увійти',
    footTo: '/login',
  },
  confirm: {
    formLabel: 'Новий пароль',
    title: 'Новий пароль',
    subtitle: `Придумай пароль, щонайменше ${MIN_PASSWORD} символів.`,
    submit: 'Зберегти пароль',
    busy: 'Зберігаємо…',
    footText: 'Посилання не працює?',
    footLink: 'Надіслати нове',
    footTo: '/reset',
  },
};

const FIELDS = {
  login: ['email', 'password'],
  register: ['name', 'email', 'password'],
  reset: ['email'],
  confirm: ['password', 'passwordRepeat'],
};

const PROMO = [
  'Зустрічі, нагадування і задачі в одному місці',
  'Спільні календарі з ролями',
  'Запрошення на email',
  'Свята твоєї країни автоматично',
];

function validate(view, values) {
  const errors = {};
  const needsStrongPassword = view === 'register' || view === 'confirm';
  if (view === 'register' && values.name.trim().length < MIN_NAME) {
    errors.name = `Мінімум ${MIN_NAME} символи`;
  }
  if (view !== 'confirm' && !EMAIL_RE.test(values.email.trim())) {
    errors.email = 'Некоректний email';
  }
  if (view === 'login' && !values.password) {
    errors.password = 'Введи пароль';
  }
  if (needsStrongPassword && values.password.length < MIN_PASSWORD) {
    errors.password = `Мінімум ${MIN_PASSWORD} символів`;
  }
  if (view === 'confirm' && !errors.password && values.passwordRepeat !== values.password) {
    errors.passwordRepeat = 'Паролі не збігаються';
  }
  return errors;
}

function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function detectCountry() {
  try {
    const { region } = new Intl.Locale(navigator.language);
    return COUNTRY_RE.test(region || '') ? region : undefined;
  } catch {
    return undefined;
  }
}

function pathOf(from) {
  if (!from?.pathname) return '/';
  return `${from.pathname}${from.search || ''}${from.hash || ''}`;
}

export default function AuthPage({ mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    user,
    isLoading,
    login,
    register,
    resendVerification,
    requestPasswordReset,
    confirmPasswordReset,
  } = useAuth();
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    passwordRepeat: '',
    remember: true,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [sentMessage, setSentMessage] = useState(null);
  const [pendingEmail, setPendingEmail] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const token = searchParams.get('token');
  const view = mode === 'reset' && token ? 'confirm' : mode;
  const copy = COPY[view];
  const isLogin = view === 'login';
  const isConfirm = view === 'confirm';
  const hasEmail = !isConfirm;
  const hasPassword = view !== 'reset';
  const from = location.state?.from;
  const cameFromInvite = Boolean(from?.pathname?.startsWith('/invite/'));
  const carriedState = from ? { from } : undefined;
  const flash = isLogin && !formError ? location.state?.notice : null;

  useEffect(() => {
    setErrors({});
    setFormError(null);
    setSentMessage(null);
    setPendingEmail(null);
  }, [view]);

  if (isLoading) return <PageLoader />;
  if (user && mode !== 'reset') return <Navigate to={pathOf(from)} replace />;

  const setField = (key) => (e) => {
    const { value } = e.target;
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((er) => ({ ...er, [key]: null }));
  };

  const submitters = {
    login: () =>
      login({
        email: values.email.trim(),
        password: values.password,
        remember: values.remember,
      }),
    register: async () => {
      const data = await register({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        timezone: detectTimezone(),
        country: detectCountry(),
        next: from ? pathOf(from) : undefined,
      });
      setPendingEmail({ email: data.email, previewUrl: data.previewUrl || null });
    },
    reset: async () => {
      const data = await requestPasswordReset(values.email.trim());
      setSentMessage(data?.message || RESET_SENT);
    },
    confirm: async () => {
      await confirmPasswordReset({ token, password: values.password });
      setValues((v) => ({ ...v, password: '', passwordRepeat: '' }));
      navigate('/login', { replace: true, state: { notice: RESET_DONE } });
    },
  };

  const backToLogin = () => {
    setPendingEmail(null);
    navigate('/login', { state: carriedState });
  };

  const showServerError = (error) => {
    const parsed = parseApiError(error);
    if (parsed.code === EMAIL_NOT_VERIFIED) {
      setPendingEmail({ email: values.email.trim(), previewUrl: null });
      return;
    }

    const fieldErrors = {};
    FIELDS[view].forEach((key) => {
      if (parsed.fields[key]) fieldErrors[key] = parsed.fields[key];
    });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length === 0) {
      setFormError(parsed.fields.token ? LINK_INVALID : parsed.message);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const nextErrors = validate(view, values);
    setErrors(nextErrors);
    setFormError(null);
    setSentMessage(null);
    if (Object.values(nextErrors).some(Boolean)) return;

    setBusy(true);
    try {
      await submitters[view]();
    } catch (error) {
      showServerError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <Card
          as="form"
          aria-label={copy.formLabel}
          padding="24px"
          gap={16}
          className={styles.form}
          onSubmit={onSubmit}
          noValidate
        >
          <Link to="/" className={styles.logo}>
            <span className={styles.logoMark}>
              <Icon name="logo" size={17} strokeWidth={2.4} />
            </span>
            <span className={styles.logoText}>Chronos</span>
          </Link>

          {pendingEmail ? (
            <CheckEmailPanel
              key={pendingEmail.email}
              email={pendingEmail.email}
              previewUrl={pendingEmail.previewUrl}
              onResend={resendVerification}
              onBack={backToLogin}
            />
          ) : (
            <>
              <div role="tablist" aria-label="Вхід або реєстрація" className={styles.tabs}>
                {TABS.map((tab) => {
                  const active = tab.mode === mode;
                  return (
                    <button
                      key={tab.mode}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={cx(styles.tab, active && styles.tabActive)}
                      onClick={() => navigate(tab.to, { state: carriedState })}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div>
                <h1 className={styles.title}>{copy.title}</h1>
                <span className={styles.subtitle}>{copy.subtitle}</span>
              </div>

              {formError ? (
                <p role="alert" className={cx(styles.banner, styles.bannerError)}>
                  {formError}
                </p>
              ) : null}

              {flash ? (
                <p role="status" className={cx(styles.banner, styles.bannerSuccess)}>
                  {flash}
                </p>
              ) : null}

              {view === 'register' ? (
                <Field label="Ім'я" htmlFor="auth-name" error={errors.name}>
                  <Input
                    id="auth-name"
                    size="lg"
                    type="text"
                    name="name"
                    autoComplete="name"
                    placeholder="Як до тебе звертатися"
                    value={values.name}
                    onChange={setField('name')}
                    invalid={Boolean(errors.name)}
                    aria-invalid={Boolean(errors.name)}
                  />
                </Field>
              ) : null}

              {hasEmail ? (
                <Field label="Email" htmlFor="auth-email" error={errors.email}>
                  <Input
                    id="auth-email"
                    size="lg"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="you@mail.com"
                    value={values.email}
                    onChange={setField('email')}
                    invalid={Boolean(errors.email)}
                    aria-invalid={Boolean(errors.email)}
                  />
                </Field>
              ) : null}

              {hasPassword ? (
                <Field
                  label={isConfirm ? 'Новий пароль' : 'Пароль'}
                  htmlFor="auth-password"
                  error={errors.password}
                  trailing={
                    isLogin ? (
                      <Link to="/reset" className={styles.forgot}>
                        Забули пароль?
                      </Link>
                    ) : null
                  }
                >
                  <Input
                    id="auth-password"
                    size="lg"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    value={values.password}
                    onChange={setField('password')}
                    invalid={Boolean(errors.password)}
                    aria-invalid={Boolean(errors.password)}
                    trailing={
                      <IconButton
                        icon={showPassword ? 'eye-off' : 'eye'}
                        label={showPassword ? 'Сховати пароль' : 'Показати пароль'}
                        size="round"
                        iconSize={16}
                        className={styles.eye}
                        onClick={() => setShowPassword((s) => !s)}
                      />
                    }
                  />
                </Field>
              ) : null}

              {isConfirm ? (
                <Field
                  label="Повтори пароль"
                  htmlFor="auth-password-repeat"
                  error={errors.passwordRepeat}
                >
                  <Input
                    id="auth-password-repeat"
                    size="lg"
                    type={showPassword ? 'text' : 'password'}
                    name="passwordRepeat"
                    autoComplete="new-password"
                    value={values.passwordRepeat}
                    onChange={setField('passwordRepeat')}
                    invalid={Boolean(errors.passwordRepeat)}
                    aria-invalid={Boolean(errors.passwordRepeat)}
                  />
                </Field>
              ) : null}

              {isLogin ? (
                <label htmlFor="auth-remember" className={styles.remember}>
                  <Checkbox
                    id="auth-remember"
                    size={15}
                    checked={values.remember}
                    onChange={(checked) => setValues((v) => ({ ...v, remember: checked }))}
                  />
                  Запам&apos;ятати мене
                </label>
              ) : null}

              <PillButton type="submit" size="lg" fullWidth className={styles.big} disabled={busy}>
                {busy ? copy.busy : copy.submit}
              </PillButton>

              {sentMessage ? (
                <p role="status" className={styles.status}>
                  {sentMessage}
                </p>
              ) : null}

              <span className={styles.foot}>
                {copy.footText}{' '}
                <Link to={copy.footTo} state={carriedState}>
                  {copy.footLink}
                </Link>
              </span>
            </>
          )}
        </Card>

        <div className={styles.side}>
          <Card variant="dark" padding="22px" gap={10} className={styles.promo}>
            <span className={styles.eyebrow}>Chronos</span>
            <span className={styles.promoTitle}>Один календар для навчання, роботи та команди</span>
            <ul className={styles.list}>
              {PROMO.map((text) => (
                <li key={text}>
                  <span className={styles.dot} />
                  {text}
                </li>
              ))}
            </ul>
          </Card>

          {cameFromInvite ? (
            <Card padding="16px 18px" gap={0} className={styles.note}>
              <span className={styles.noteIcon}>
                <Icon name="mail" size={18} />
              </span>
              <span className={styles.noteText}>
                <span className={styles.noteTitle}>Тебе запросили.</span>
                <span className={styles.noteSub}>
                  Увійди або зареєструйся з email, на який прийшло запрошення.
                </span>
              </span>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

AuthPage.propTypes = {
  mode: PropTypes.oneOf(['login', 'register', 'reset']).isRequired,
};
