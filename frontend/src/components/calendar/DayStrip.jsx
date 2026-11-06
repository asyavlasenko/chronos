// Дизайн: 04-day.html (пілюлі 36×44 у тулбарі), 16-mobile.html (52px на всю ширину)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { isSameDay, isToday, weekdayIndex, WEEKDAYS_SHORT } from '../../utils/dates';
import styles from './DayStrip.module.css';

export default function DayStrip({
  days,
  selected,
  onSelect,
  variant = 'toolbar',
  className = '',
}) {
  return (
    <nav className={cx(styles.strip, styles[variant], className)} aria-label="Дні тижня">
      {days.map((d) => {
        const active = isSameDay(d, selected);
        return (
          <button
            key={d.toISOString()}
            type="button"
            aria-current={active ? 'date' : undefined}
            className={cx(
              styles.day,
              active && styles.active,
              isToday(d) && !active && styles.today,
            )}
            onClick={() => onSelect(d)}
          >
            <span className={styles.w}>{WEEKDAYS_SHORT[weekdayIndex(d)].toUpperCase()}</span>
            <span className={styles.n}>{d.getDate()}</span>
          </button>
        );
      })}
    </nav>
  );
}

DayStrip.propTypes = {
  days: PropTypes.arrayOf(PropTypes.instanceOf(Date)).isRequired,
  selected: PropTypes.instanceOf(Date).isRequired,
  onSelect: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['toolbar', 'mobile']),
  className: PropTypes.string,
};
