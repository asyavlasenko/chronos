import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import cx from '../../utils/cx';
import Icon from './Icon';
import styles from './Toaster.module.css';

const ICONS = { success: 'check', error: 'info', info: 'info' };

export default function Toaster({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div className={styles.stack} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={cx(styles.toast, styles[toast.type])}>
          <Icon name={ICONS[toast.type]} size={15} />
          <span className={styles.message}>{toast.message}</span>
          <button
            type="button"
            className={styles.close}
            aria-label="Закрити сповіщення"
            onClick={() => onDismiss(toast.id)}
          >
            <Icon name="x" size={13} strokeWidth={2.4} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

Toaster.propTypes = {
  toasts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      message: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['info', 'success', 'error']).isRequired,
    }),
  ).isRequired,
  onDismiss: PropTypes.func.isRequired,
};
