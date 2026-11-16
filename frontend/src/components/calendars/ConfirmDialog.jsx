import PropTypes from 'prop-types';
import Modal from '../ui/Modal';
import PillButton from '../ui/PillButton';
import styles from './ConfirmDialog.module.css';

export default function ConfirmDialog({
  open,
  title,
  text = null,
  confirmLabel = 'Підтвердити',
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal open={open} onClose={onCancel} label={title} width={400} top={180} gap={10}>
      <h2 className={styles.title}>{title}</h2>
      {text ? <p className={styles.text}>{text}</p> : null}
      <div className={styles.actions}>
        <PillButton variant="secondary" size="sm" disabled={busy} onClick={onCancel}>
          Скасувати
        </PillButton>
        <PillButton variant="danger" size="sm" disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </PillButton>
      </div>
    </Modal>
  );
}

ConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  text: PropTypes.node,
  confirmLabel: PropTypes.string,
  busy: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
