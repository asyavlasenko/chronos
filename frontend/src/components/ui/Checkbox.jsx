// Дизайн: 07-tasks.html (18px, accent --dark), 01-overview.html (15–16px), 13-auth.html («запам'ятати»)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { COLOR_HEX } from '../../utils/colors';
import styles from './Checkbox.module.css';

/** Нативний чекбокс з accent-color. color — ключ кольору або 'accent'. */
export default function Checkbox({
  checked,
  onChange,
  size = 16,
  color = 'graphite',
  label = '',
  className = '',
  ...rest
}) {
  const accent = color === 'accent' ? COLOR_HEX.blue : COLOR_HEX[color] || COLOR_HEX.graphite;
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={label || undefined}
      className={cx(styles.box, className)}
      style={{ width: size, height: size, accentColor: accent }}
      {...rest}
    />
  );
}

Checkbox.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  size: PropTypes.number,
  color: PropTypes.string,
  label: PropTypes.string,
  className: PropTypes.string,
};
