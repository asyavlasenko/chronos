// Дизайн: 10-event-create.html (.inp h40 r10 рамка --line 13px), 13-auth.html (h44 14px), 01 (email h32 r8 12px)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import styles from './Input.module.css';

/** size: lg 44 · md 40 · sm 36 · xs 32. invalid — червона рамка. trailing — кнопка всередині (показати пароль). */
export default function Input({
  size = 'md',
  invalid = false,
  trailing = null,
  className = '',
  wrapClassName = '',
  ...rest
}) {
  const input = (
    <input
      className={cx(styles.input, styles[size], invalid && styles.invalid, className)}
      {...rest}
    />
  );
  if (!trailing) return input;
  return (
    <div className={cx(styles.wrap, wrapClassName)}>
      {input}
      <span className={styles.trailing}>{trailing}</span>
    </div>
  );
}

Input.propTypes = {
  size: PropTypes.oneOf(['lg', 'md', 'sm', 'xs']),
  invalid: PropTypes.bool,
  trailing: PropTypes.node,
  className: PropTypes.string,
  wrapClassName: PropTypes.string,
};
