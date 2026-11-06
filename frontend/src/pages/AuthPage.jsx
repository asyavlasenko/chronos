// Дизайн: design/screens/13-auth.html
// Вхід / Реєстрація / Скидання пароля: форма ліворуч (таби, email, пароль із «показати», «запам'ятати»),
// промо-картка і нотатка про запрошення праворуч. mode задає роутер: /login · /register · /reset.
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useEvents from '../hooks/useEvents';
import cx from '../utils/cx';
import Icon from '../components/ui/Icon';
import Card from '../components/ui/Card';
import Field from '../components/ui/Field';
import Input from '../components/ui/Input';
import IconButton from '../components/ui/IconButton';
import Checkbox from '../components/ui/Checkbox';
import PillButton from '../components/ui/PillButton';
import styles from './AuthPage.module.css';

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
    footText: 'Немає акаунта?',
    footLink: 'Зареєструватися',
    footTo: '/register',
  },
  register: {
    formLabel: 'Реєстрація',
    title: 'Створи акаунт',
    subtitle: 'Головний календар створиться автоматично.',
    submit: 'Зареєструватися',
    footText: 'Уже є акаунт?',
    footLink: 'Увійти',
    footTo: '/login',
  },
  reset: {
    formLabel: 'Скидання пароля',
    title: 'Скидання пароля',
    subtitle: 'Надішлемо лист із посиланням.',
    submit: 'Надіслати лист',
    footText: 'Згадали пароль?',
    footLink: 'Увійти',
    footTo: '/login',
  },
};

const PROMO = [
  'Зустрічі, нагадування і задачі в одному місці',
  'Спільні календарі з ролями',
  'Запрошення на email',
  'Свята твоєї країни автоматично',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MIN_NAME = 2;

function validate(mode, values) {
  const errors = {};
  if (mode === 'register' && values.name.trim().length < MIN_NAME) {
    errors.name = `Мінімум ${MIN_NAME} символи`;
  }
  if (!EMAIL_RE.test(values.email.trim())) errors.email = 'Некоректний email';
  if (mode !== 'reset' && values.password.length < MIN_PASSWORD) {
    errors.password = `Мінімум ${MIN_PASSWORD} символів`;
  }
  return errors;
}

export default function AuthPage({ mode }) {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const { pendingInvites } = useEvents();
  const [values, setValues] = useState({ name: '', email: '', password: '', remember: true });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const copy = COPY[mode];
  const isReset = mode === 'reset';
  const invite = pendingInvites[0] || null;

  // Під час перемикання режиму помилки й повідомлення попередньої форми не мають лишатися.
  useEffect(() => {
    setErrors({});
    setSent(false);
  }, [mode]);

  const setField = (key) => (e) => {
    const { value } = e.target;
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((er) => ({ ...er, [key]: null }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate(mode, values);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    if (isReset) {
      setSent(true);
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await login({
          email: values.email.trim(),
          password: values.password,
          remember: values.remember,
        });
      } else {
        await register({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
        });
      }
      navigate('/');
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
                  onClick={() => navigate(tab.to)}
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

          {mode === 'register' ? (
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

          {!isReset ? (
            <Field
              label="Пароль"
              htmlFor="auth-password"
              error={errors.password}
              trailing={
                mode === 'login' ? (
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
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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

          {!isReset ? (
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
            {copy.submit}
          </PillButton>

          {sent ? (
            <p role="status" className={styles.status}>
              Якщо такий email існує, лист уже в дорозі
            </p>
          ) : null}

          {!isReset ? (
            <>
              <div className={styles.divider}>або</div>
              <PillButton variant="secondary" size="lg" fullWidth className={styles.big}>
                Продовжити з Google
              </PillButton>
            </>
          ) : null}

          <span className={styles.foot}>
            {copy.footText} <Link to={copy.footTo}>{copy.footLink}</Link>
          </span>
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

          {invite ? (
            <Card padding="16px 18px" gap={0} className={styles.note}>
              <span className={styles.noteIcon}>
                <Icon name="mail" size={18} />
              </span>
              <span className={styles.noteText}>
                <span className={styles.noteTitle}>
                  Тебе запросили в календар «{invite.calendar?.name}»
                </span>
                <span className={styles.noteSub}>Увійди з цим email — запрошення чекатиме.</span>
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
