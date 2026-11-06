// Дизайн: design/screens/01-overview.html (картка «Тиждень 45»: 7 стовпчиків навантаження, сьогодні — accent)
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import cx from '../../utils/cx';
import { formatDate, formatHours, isToday } from '../../utils/dates';
import Card from '../ui/Card';
import styles from './WeekLoadChart.module.css';

const MAX_BAR_H = 73;
const MIN_BAR_H = 4;

export default function WeekLoadChart({ days, title, subtitle, className = '' }) {
  const max = Math.max(...days.map((d) => d.minutes), 1);
  return (
    <Card
      aria-label="Навантаження тижня"
      title={title}
      subtitle={subtitle}
      action={<Link to="/calendar/week">Відкрити тиждень →</Link>}
      gap={12}
      className={className}
    >
      <div className={styles.bars}>
        {days.map((d) => {
          const today = isToday(d.date);
          const height = d.minutes
            ? Math.max(MIN_BAR_H, Math.round((d.minutes / max) * MAX_BAR_H))
            : MIN_BAR_H;
          return (
            <Link
              key={d.date.toISOString()}
              to={`/calendar/day?date=${formatDate(d.date, 'iso')}`}
              aria-current={today ? 'date' : undefined}
              className={cx(styles.day, today && styles.today)}
            >
              <span className={styles.hours}>{formatHours(d.minutes)}</span>
              <span className={styles.bar} style={{ height }} />
              <span className={styles.label}>{formatDate(d.date, 'weekday-day')}</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

WeekLoadChart.propTypes = {
  days: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.instanceOf(Date).isRequired,
      minutes: PropTypes.number.isRequired,
    }),
  ).isRequired,
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node.isRequired,
  className: PropTypes.string,
};
