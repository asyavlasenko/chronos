// Дизайн: 02-week-cards.html (День · Тиждень · Місяць · Рік; Картки | Стрічка часу), 11 (тип події)
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import cx from '../../utils/cx';
import styles from './SegmentedControl.module.css';

/**
 * options: [{ value, label, to? }]. Якщо є to — рендериться посилання (навігація між поданнями).
 * size: md (30px, контейнер 4px) · sm (28px, контейнер 3px). bg: white | muted (#F3F4F6, тип події).
 * stretch — пункти розтягуються на всю ширину (radiogroup у модалці).
 */
export default function SegmentedControl({
  options,
  value,
  onChange = () => {},
  size = 'md',
  bg = 'white',
  stretch = false,
  label = '',
  role = 'tablist',
  className = '',
}) {
  return (
    <nav
      role={role === 'radiogroup' ? 'radiogroup' : undefined}
      aria-label={label || undefined}
      className={cx(styles.wrap, styles[size], styles[bg], stretch && styles.stretch, className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const cls = cx(styles.item, active && styles.active);
        if (opt.to) {
          return (
            <Link
              key={opt.value}
              to={opt.to}
              aria-current={active ? 'page' : undefined}
              className={cls}
            >
              {opt.label}
            </Link>
          );
        }
        return (
          <button
            key={opt.value}
            type="button"
            role={role === 'radiogroup' ? 'radio' : undefined}
            aria-checked={role === 'radiogroup' ? active : undefined}
            aria-pressed={role === 'radiogroup' ? undefined : active}
            className={cls}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </nav>
  );
}

SegmentedControl.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.node.isRequired,
      to: PropTypes.string,
    }),
  ).isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  size: PropTypes.oneOf(['md', 'sm']),
  bg: PropTypes.oneOf(['white', 'muted']),
  stretch: PropTypes.bool,
  label: PropTypes.string,
  role: PropTypes.oneOf(['tablist', 'radiogroup']),
  className: PropTypes.string,
};
