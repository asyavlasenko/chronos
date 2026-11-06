// Дизайн: 10-event-create.html (.lbl 12/600 сірий, .hint 11), 13-auth.html; помилка — 12px --danger під полем
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import styles from './Field.module.css';

/** Обгортка поля: підпис зверху, підказка/помилка знизу. trailing — елемент праворуч від підпису («Забули пароль?»). */
export default function Field({
  label,
  htmlFor = undefined,
  hint = null,
  error = null,
  trailing = null,
  children,
  className = '',
}) {
  return (
    <div className={cx(styles.field, className)}>
      <div className={styles.labelRow}>
        <label htmlFor={htmlFor} className={styles.label}>
          {label}
        </label>
        {trailing}
      </div>
      {children}
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
      {!error && hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}

Field.propTypes = {
  label: PropTypes.node.isRequired,
  htmlFor: PropTypes.string,
  hint: PropTypes.node,
  error: PropTypes.node,
  trailing: PropTypes.node,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};
