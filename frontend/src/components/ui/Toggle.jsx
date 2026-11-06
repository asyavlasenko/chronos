// Дизайн: 14-profile.html (перемикачі сповіщень і номерів тижнів)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import styles from './Toggle.module.css';

export default function Toggle({ checked, onChange, label, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(styles.toggle, checked && styles.on, className)}
    >
      <span className={styles.knob} />
    </button>
  );
}

Toggle.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};
