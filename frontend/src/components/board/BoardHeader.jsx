import { memo } from 'react';
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { formatDate, getIsoWeek } from '../../utils/dates';
import { formatHourTick } from '../../utils/board';
import styles from './BoardHeader.module.css';

function BoardHeader({
  days,
  hourTicks,
  hourWidth,
  todayTime = null,
  timeFormat = '24h',
  showWeekNumbers = true,
}) {
  return (
    <div className={styles.header}>
      <div className={styles.days}>
        {days.map((day) => (
          <div
            key={day.date.getTime()}
            className={cx(styles.day, day.date.getTime() === todayTime && styles.today)}
            style={{ width: day.width }}
          >
            <span className={styles.dayLabel}>
              {formatDate(day.date, 'weekday-short')}
              {showWeekNumbers ? (
                <span className={styles.week}> · тиждень {getIsoWeek(day.date)}</span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.hours} aria-hidden="true">
        {hourTicks.map((tick) => (
          <span key={tick.getTime()} className={styles.hour} style={{ width: hourWidth }}>
            {formatHourTick(tick, timeFormat)}
          </span>
        ))}
      </div>
    </div>
  );
}

BoardHeader.propTypes = {
  days: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.instanceOf(Date).isRequired,
      left: PropTypes.number.isRequired,
      width: PropTypes.number.isRequired,
    }),
  ).isRequired,
  hourTicks: PropTypes.arrayOf(PropTypes.instanceOf(Date)).isRequired,
  hourWidth: PropTypes.number.isRequired,
  todayTime: PropTypes.number,
  timeFormat: PropTypes.oneOf(['24h', '12h']),
  showWeekNumbers: PropTypes.bool,
};

export default memo(BoardHeader);
