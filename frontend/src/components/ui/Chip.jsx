// Дизайн: 02-week-cards.html (фільтри «Календарі:»), 01-overview.html (список календарів)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { COLOR_HEX } from '../../utils/colors';
import styles from './Chip.module.css';

/** Чіп-фільтр з чекбоксом; колір чекбокса — колір календаря. variant: pill (білий) | plain (без фону, у списках). */
export default function Chip({
  label,
  checked,
  onChange,
  color = 'graphite',
  variant = 'pill',
  hint = null,
  disabled = false,
  className = '',
}) {
  return (
    <label className={cx(styles.chip, styles[variant], !checked && styles.muted, className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={styles.box}
        style={{ accentColor: COLOR_HEX[color] || COLOR_HEX.graphite }}
      />
      {label}
      {hint ? <span className={styles.hint}>· {hint}</span> : null}
    </label>
  );
}

Chip.propTypes = {
  label: PropTypes.node.isRequired,
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  color: PropTypes.string,
  variant: PropTypes.oneOf(['pill', 'plain']),
  hint: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};
