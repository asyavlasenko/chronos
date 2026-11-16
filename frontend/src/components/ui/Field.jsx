import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import styles from './Field.module.css';

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
