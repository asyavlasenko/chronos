// Дизайн: 10-event-create.html (.sel: кнопка з шевроном, h40 r10 13/500), 14-profile.html (h36), 08 (роль учасника)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import Icon from './Icon';
import styles from './Select.module.css';

/** Нативний select, стилізований як кнопка з шевроном. size: md 40 · sm 36 · xs 32. leading — крапка кольору чи іконка. */
export default function Select({
  options,
  value,
  onChange,
  size = 'md',
  leading = null,
  className = '',
  ...rest
}) {
  return (
    <span className={cx(styles.wrap, styles[size], className)}>
      {leading ? <span className={styles.leading}>{leading}</span> : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(styles.select, leading && styles.withLeading)}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={12} strokeWidth={2.6} className={styles.chevron} />
    </span>
  );
}

Select.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      disabled: PropTypes.bool,
    }),
  ).isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  size: PropTypes.oneOf(['md', 'sm', 'xs']),
  leading: PropTypes.node,
  className: PropTypes.string,
};
