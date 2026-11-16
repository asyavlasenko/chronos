import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { COLOR_HEX } from '../../utils/colors';
import styles from './Checkbox.module.css';

export default function Checkbox({
  checked,
  onChange,
  size = 16,
  color = 'graphite',
  label = '',
  className = '',
  locked = false,
  ...rest
}) {
  const accent = color === 'accent' ? COLOR_HEX.blue : COLOR_HEX[color] || COLOR_HEX.graphite;
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => {
        if (!locked) onChange(e.target.checked);
      }}
      aria-label={label || undefined}
      aria-disabled={locked || undefined}
      className={cx(styles.box, locked && styles.locked, className)}
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
  locked: PropTypes.bool,
};
