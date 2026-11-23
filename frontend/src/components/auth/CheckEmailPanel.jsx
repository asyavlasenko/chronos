import { useState } from 'react';
import PropTypes from 'prop-types';
import { parseApiError } from '../../api/errors';
import Icon from '../ui/Icon';
import PillButton from '../ui/PillButton';
import styles from './CheckEmailPanel.module.css';

const RESENT = 'Лист надіслано ще раз';

export default function CheckEmailPanel({ email, previewUrl = null, onResend, onBack }) {
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState(previewUrl);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [isSending, setIsSending] = useState(false);

  const resend = async () => {
    if (isSending) return;
    setIsSending(true);
    setStatus(null);
    setError(null);
    try {
      const data = await onResend(email);
      setCurrentPreviewUrl(data?.previewUrl || null);
      setStatus(RESENT);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={styles.panel}>
      <span className={styles.icon}>
        <Icon name="mail" size={22} />
      </span>
      <div>
        <h1 className={styles.title}>Перевір пошту</h1>
        <p className={styles.text}>
          Ми надіслали лист на <b className={styles.email}>{email}</b>. Натисни кнопку в листі, щоб
          підтвердити email і увійти.
        </p>
      </div>

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className={styles.status}>
          {status}
        </p>
      ) : null}

      <div className={styles.actions}>
        {currentPreviewUrl ? (
          <PillButton size="lg" fullWidth href={currentPreviewUrl} target="_blank" rel="noreferrer">
            Відкрити лист
          </PillButton>
        ) : null}
        <PillButton variant="secondary" size="lg" fullWidth onClick={resend} disabled={isSending}>
          {isSending ? 'Надсилаємо…' : 'Надіслати ще раз'}
        </PillButton>
        <PillButton variant="ghost" size="lg" fullWidth onClick={onBack}>
          Повернутися до входу
        </PillButton>
      </div>
    </div>
  );
}

CheckEmailPanel.propTypes = {
  email: PropTypes.string.isRequired,
  previewUrl: PropTypes.string,
  onResend: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};
