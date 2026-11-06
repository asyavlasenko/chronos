// Дизайн: 04-day.html (міні-місяць у бічній панелі: 30px пілюлі, дні з подіями — сірий фон, вибраний — темний)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import {
  addMonths,
  formatDate,
  getMonthGridDays,
  isSameDay,
  toDateParam,
  WEEKDAYS_SHORT,
} from '../../utils/dates';
import IconButton from '../ui/IconButton';
import styles from './MiniMonth.module.css';

/** month — будь-яка дата місяця; markedDays — Set рядків 'YYYY-MM-DD' з подіями. */
export default function MiniMonth({
  month,
  selected = null,
  onSelect,
  onMonthChange = null,
  markedDays = new Set(),
  weekStartsOn = 1,
  className = '',
}) {
  const days = getMonthGridDays(month, weekStartsOn);
  const weekdays =
    weekStartsOn === 1 ? WEEKDAYS_SHORT : [WEEKDAYS_SHORT[6], ...WEEKDAYS_SHORT.slice(0, 6)];
  const rows = days.slice(35).some((d) => d.getMonth() === month.getMonth())
    ? days
    : days.slice(0, 35);
  return (
    <div className={cx(styles.wrap, className)}>
      <div className={styles.head}>
        <span className={styles.title}>{formatDate(month, 'month-year')}</span>
        {onMonthChange ? (
          <span className={styles.arrows}>
            <IconButton
              icon="chevron-left"
              label="Попередній місяць"
              size="xs"
              variant="muted"
              iconSize={12}
              onClick={() => onMonthChange(addMonths(month, -1))}
            />
            <IconButton
              icon="chevron-right"
              label="Наступний місяць"
              size="xs"
              variant="muted"
              iconSize={12}
              onClick={() => onMonthChange(addMonths(month, 1))}
            />
          </span>
        ) : null}
      </div>
      <div className={styles.weekdays}>
        {weekdays.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className={styles.days}>
        {rows.map((d) => {
          const outside = d.getMonth() !== month.getMonth();
          const active = selected && isSameDay(d, selected);
          const marked = markedDays.has(toDateParam(d));
          return (
            <button
              key={d.toISOString()}
              type="button"
              className={cx(
                styles.day,
                outside && styles.outside,
                marked && styles.marked,
                active && styles.active,
              )}
              onClick={() => onSelect(d)}
              aria-label={formatDate(d, 'weekday-long')}
              aria-current={active ? 'date' : undefined}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

MiniMonth.propTypes = {
  month: PropTypes.instanceOf(Date).isRequired,
  selected: PropTypes.instanceOf(Date),
  onSelect: PropTypes.func.isRequired,
  onMonthChange: PropTypes.func,
  markedDays: PropTypes.instanceOf(Set),
  weekStartsOn: PropTypes.oneOf([0, 1]),
  className: PropTypes.string,
};
