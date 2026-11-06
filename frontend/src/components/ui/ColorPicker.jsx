// Дизайн: 08-calendars.html (колір календаря, мій колір), 10-event-create.html (колір події)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { COLOR_KEYS, COLOR_LABELS, colorVars } from '../../utils/colors';
import styles from './ColorPicker.module.css';

/**
 * Кружечки 26px; активний — outline 2px --dark offset 2. value — ключ кольору (або null, якщо є inherit).
 * inherit — додатковий перший варіант «Колір календаря» (value null) з переданим кольором.
 */
export default function ColorPicker({
  value = null,
  onChange,
  options = COLOR_KEYS,
  size = 26,
  inherit = null,
  label = 'Колір',
  className = '',
  palette = 'calendar',
  disabled = false,
}) {
  const all = inherit
    ? [
        { key: null, label: inherit.label || 'Колір календаря', color: inherit.color },
        ...options.map((k) => ({ key: k })),
      ]
    : options.map((k) => ({ key: k }));
  return (
    <div role="radiogroup" aria-label={label} className={cx(styles.row, className)}>
      {all.map((opt) => {
        const { key } = opt;
        const checked = key === value;
        const base = key ? colorVars(key, palette).base : colorVars(opt.color || 'graphite').base;
        return (
          <button
            key={key ?? 'inherit'}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={opt.label || COLOR_LABELS[key] || key}
            title={opt.label || COLOR_LABELS[key]}
            onClick={() => !disabled && onChange(key)}
            disabled={disabled}
            className={cx(styles.dot, checked && styles.active, !key && styles.inherit)}
            style={{ width: size, height: size, background: base }}
          />
        );
      })}
    </div>
  );
}

ColorPicker.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.string),
  size: PropTypes.number,
  inherit: PropTypes.shape({ label: PropTypes.string, color: PropTypes.string }),
  label: PropTypes.string,
  className: PropTypes.string,
  palette: PropTypes.oneOf(['calendar', 'member']),
  disabled: PropTypes.bool,
};
