import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { parseApiError } from '../api/errors';
import useAuth from '../hooks/useAuth';
import Card from '../components/ui/Card';
import Field from '../components/ui/Field';
import Icon from '../components/ui/Icon';
import Input from '../components/ui/Input';
import PageLoader from '../components/ui/PageLoader';
import PillButton from '../components/ui/PillButton';
import styles from './VerifyEmailPage.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_PATH_RE = /^\/(?!\/)\S*$/;
const SENT = 'Якщо цей email чекає підтвердження, новий лист уже в дорозі';

export default function VerifyEmailPage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyEmail, resendVerification } = useAuth();
  const [failure, setFailure] = useState(null);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(null);
  const [sent, setSent] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const started = useRef(false);

  const next = searchParams.get('next');
  const target = next && SAFE_PATH_RE.test(next) ? next : '/';

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    verifyEmail(token)
      .then(() => navigate(target, { replace: true }))
      .catch((err) => setFailure(parseApiError(err).message));
  }, [token, target, verifyEmail, navigate]);

  if (!failure) return <PageLoader label="Підтверджуємо email…" />;

  const resend = async (event) => {
    event.preventDefault();
    if (isSending) return;
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError('Вкажи email, з яким реєструвався');
      return;
    }

    setIsSending(true);
    setEmailError(null);
    setSent(null);
    try {
      const data = await resendVerification(email.trim());
      setSent({ message: SENT, previewUrl: data?.previewUrl || null });
    } catch (err) {
      setEmailError(parseApiError(err).message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={styles.page}>
      <Card
        as="form"
        aria-label="Підтвердження email"
        padding="24px"
        gap={16}
        className={styles.card}
        onSubmit={resend}
        noValidate
      >
        <Link to="/login" className={styles.logo}>
          <span className={styles.logoMark}>
            <Icon name="logo" size={17} strokeWidth={2.4} />
          </span>
          <span className={styles.logoText}>Chronos</span>
        </Link>

        <div>
          <h1 className={styles.title}>Не вдалося підтвердити email</h1>
          <p className={styles.text}>{failure}</p>
        </div>

        <Field label="Email" htmlFor="verify-email" error={emailError}>
          <Input
            id="verify-email"
            size="lg"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@mail.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            invalid={Boolean(emailError)}
          />
        </Field>

        {sent ? (
          <p role="status" className={styles.status}>
            {sent.message}
          </p>
        ) : null}

        <PillButton type="submit" size="lg" fullWidth disabled={isSending}>
          {isSending ? 'Надсилаємо…' : 'Надіслати новий лист'}
        </PillButton>
        {sent?.previewUrl ? (
          <PillButton
            variant="secondary"
            size="lg"
            fullWidth
            href={sent.previewUrl}
            target="_blank"
            rel="noreferrer"
          >
            Відкрити лист
          </PillButton>
        ) : null}

        <span className={styles.foot}>
          Уже підтвердив? <Link to="/login">Увійти</Link>
        </span>
      </Card>
    </div>
  );
}
