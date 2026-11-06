// Дизайн: design/screens/06-year.html
// Міні-місяць у поданні року — посилання на місяць. Дні з подіями — сірий фон, свята — сині,
// дедлайни — фіолетові, сьогодні — темний; поточний місяць — обведення. Завжди 6 рядків (порожні — поза місяцем).
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import cx from '../../utils/cx';
import {
  getMonthGridDays,
  isToday,
  toDateParam,
  MONTHS_NOMINATIVE,
  WEEKDAYS_SHORT,
} from '../../utils/dates';
import { pluralEvents } from '../../utils/text';
import styles from './YearMiniMonth.module.css';

/** Позначки днів: 'event' | 'holiday' | 'deadline' (за зростанням пріоритету). */
export const DAY_MARKS = ['event', 'holiday', 'deadline'];

/** month — будь-яка дата місяця; marks — Map<'YYYY-MM-DD', 'event'|'holiday'|'deadline'>. */
export default function YearMiniMonth({
  month,
  eventsCount = 0,
  marks = new Map(),
  weekStartsOn = 1,
  current = false,
  className = '',
}) {
  const m = month.getMonth();
  const first = new Date(month.getFullYear(), m, 1);
  const days = getMonthGridDays(first, weekStartsOn);
  const weekdays =
    weekStartsOn === 1 ? WEEKDAYS_SHORT : [WEEKDAYS_SHORT[6], ...WEEKDAYS_SHORT.slice(0, 6)];

  return (
    <Link
      to={`/calendar/month?date=${toDateParam(first)}`}
      className={cx(styles.month, current && styles.cur, className)}
      aria-label={`${MONTHS_NOMINATIVE[m]} ${first.getFullYear()} · ${pluralEvents(eventsCount)}`}
      aria-current={current ? 'date' : undefined}
    >
      <span className={styles.head}>
        <span className={styles.name}>{MONTHS_NOMINATIVE[m]}</span>
        <span className={styles.count}>{pluralEvents(eventsCount)}</span>
      </span>
      <span className={cx(styles.grid, styles.weekdays)}>
        {weekdays.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </span>
      <span className={styles.grid}>
        {days.map((d) => {
          const key = toDateParam(d);
          if (d.getMonth() !== m) return <span key={key} />;
          const mark = marks.get(key);
          return (
            <span
              key={key}
              className={cx(styles.day, mark && styles[mark], isToday(d) && styles.today)}
            >
              {d.getDate()}
            </span>
          );
        })}
      </span>
    </Link>
  );
}

YearMiniMonth.propTypes = {
  month: PropTypes.instanceOf(Date).isRequired,
  eventsCount: PropTypes.number,
  marks: PropTypes.instanceOf(Map),
  weekStartsOn: PropTypes.oneOf([0, 1]),
  current: PropTypes.bool,
  className: PropTypes.string,
};
