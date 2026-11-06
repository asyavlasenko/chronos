// Дизайн: design/screens/01-overview.html (картка «Свята України»: замок read-only, найближчі свята з плиткою дати)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { formatRelative, MONTHS_ABBR_UPPER, startOfDay, toDate } from '../../utils/dates';
import { eventShape } from '../../utils/propTypes';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import styles from './HolidayList.module.css';

export default function HolidayList({ holidays, now, title = 'Свята України', className = '' }) {
  // «через N днів» рахуємо від початку дня, бо свято — подія на весь день
  const today = startOfDay(now);
  return (
    <Card
      aria-label="Свята"
      title={title}
      action={
        <span className={styles.lock} role="img" aria-label="Тільки читання">
          <Icon name="lock" size={13} />
        </span>
      }
      gap={10}
      className={className}
    >
      {holidays.map((h, i) => {
        const d = toDate(h.startAt);
        return (
          <div key={h.id} className={styles.row}>
            <span className={cx(styles.date, i === 0 && styles.dateNext)}>
              {MONTHS_ABBR_UPPER[d.getMonth()]}
              <span className={styles.day}>{d.getDate()}</span>
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{h.title}</span>
              <span className={styles.when}>{formatRelative(d, today)}</span>
            </span>
          </div>
        );
      })}
      {!holidays.length ? <span className={styles.when}>Найближчих свят немає</span> : null}
    </Card>
  );
}

HolidayList.propTypes = {
  holidays: PropTypes.arrayOf(eventShape).isRequired,
  now: PropTypes.instanceOf(Date).isRequired,
  title: PropTypes.node,
  className: PropTypes.string,
};
