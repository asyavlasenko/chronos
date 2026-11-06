// Дизайн: 11-event-quick-modal.html (480px, top 130), 12-event-details.html (560px, top 90)
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import styles from './Modal.module.css';

/**
 * Модалка: overlay --overlay, картка 18px з тінню --shadow-modal. Esc і клік по overlay закривають.
 * width — ширина картки; top — відступ зверху на десктопі; padding — внутрішній відступ картки.
 */
export default function Modal({
  open,
  onClose,
  label,
  children,
  width = 480,
  top = 130,
  padding = 20,
  gap = 14,
  className = '',
  initialFocus = 'input, textarea, select, button',
}) {
  const cardRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = cardRef.current?.querySelector(initialFocus);
    first?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, initialFocus]);

  if (!open) return null;

  return createPortal(
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className={styles.overlay}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ paddingTop: top }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cx(styles.card, className)}
        style={{ width, padding, gap }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

Modal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  width: PropTypes.number,
  top: PropTypes.number,
  padding: PropTypes.number,
  gap: PropTypes.number,
  className: PropTypes.string,
  initialFocus: PropTypes.string,
};
