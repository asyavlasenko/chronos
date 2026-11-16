import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import cx from '../../utils/cx';
import {
  addDays,
  formatDate,
  getIsoWeek,
  getMonthGridDays,
  isToday,
  toDateParam,
  WEEKDAYS_SHORT,
} from '../../utils/dates';
import { calendarShape, eventShape } from '../../utils/propTypes';
import EventBlock from './EventBlock';
import styles from './MonthGrid.module.css';

const dayLink = (d) => `/calendar/day?date=${toDateParam(d)}`;

function MonthCell({
  day,
  month,
  events,
  calendarsById,
  maxPerDay,
  onEventClick = null,
  onToggleComplete = null,
  canComplete = null,
}) {
  const outside = day.getMonth() !== month.getMonth();
  const today = isToday(day);
  const shown = events.slice(0, maxPerDay);
  const hidden = events.length - shown.length;

  return (
    <div
      className={cx(styles.cell, today && styles.today)}
      aria-current={today ? 'date' : undefined}
    >
      <Link
        to={dayLink(day)}
        className={cx(styles.num, outside && styles.numOutside, today && styles.numToday)}
        aria-label={formatDate(day, 'weekday-long')}
      >
        {day.getDate()}
      </Link>
      {shown.map((e) => (
        <EventBlock
          key={e.id}
          event={e}
          calendar={calendarsById[e.calendar] || null}
          variant="list"
          onClick={onEventClick}
          onToggleComplete={onToggleComplete}
          completable={canComplete ? canComplete(e) : true}
          className={cx(
            styles.row,
            outside && styles.rowOutside,
            e.type === 'holiday' && styles.rowHoliday,
            e.type === 'task' && e.isDeadline && styles.rowDeadline,
          )}
        />
      ))}
      {hidden > 0 ? (
        <Link to={dayLink(day)} className={styles.more}>
          + ще {hidden}
        </Link>
      ) : null}
    </div>
  );
}

MonthCell.propTypes = {
  day: PropTypes.instanceOf(Date).isRequired,
  month: PropTypes.instanceOf(Date).isRequired,
  events: PropTypes.arrayOf(eventShape).isRequired,
  calendarsById: PropTypes.objectOf(calendarShape).isRequired,
  maxPerDay: PropTypes.number.isRequired,
  onEventClick: PropTypes.func,
  onToggleComplete: PropTypes.func,
  canComplete: PropTypes.func,
};

export default function MonthGrid({
  month,
  eventsByDay = new Map(),
  calendarsById = {},
  weekStartsOn = 1,
  maxPerDay = 3,
  onEventClick = null,
  onToggleComplete = null,
  canComplete = null,
  className = '',
}) {
  const days = getMonthGridDays(month, weekStartsOn);
  const visible = days.slice(35).some((d) => d.getMonth() === month.getMonth())
    ? days
    : days.slice(0, 35);
  const rows = Array.from({ length: visible.length / 7 }, (_, i) =>
    visible.slice(i * 7, i * 7 + 7),
  );
  const weekdays =
    weekStartsOn === 1 ? WEEKDAYS_SHORT : [WEEKDAYS_SHORT[6], ...WEEKDAYS_SHORT.slice(0, 6)];

  return (
    <section aria-label={formatDate(month, 'month-year')} className={cx(styles.grid, className)}>
      <div className={styles.head}>
        <span className={styles.wnHead}>тжд</span>
        {weekdays.map((w) => (
          <span key={w} className={styles.weekday}>
            {w}
          </span>
        ))}
      </div>
      {rows.map((row, i) => {
        const monday = weekStartsOn === 1 ? row[0] : addDays(row[0], 1);
        const week = getIsoWeek(monday);
        return (
          <div key={toDateParam(row[0])} className={cx(styles.week, i === 5 && styles.weekShort)}>
            <Link
              to={`/calendar/week?date=${toDateParam(monday)}`}
              className={styles.wn}
              aria-label={`Тиждень ${week}`}
            >
              {week}
            </Link>
            {row.map((d) => (
              <MonthCell
                key={toDateParam(d)}
                day={d}
                month={month}
                events={eventsByDay.get(d.toDateString()) || []}
                calendarsById={calendarsById}
                maxPerDay={maxPerDay}
                onEventClick={onEventClick}
                onToggleComplete={onToggleComplete}
                canComplete={canComplete}
              />
            ))}
          </div>
        );
      })}
    </section>
  );
}

MonthGrid.propTypes = {
  month: PropTypes.instanceOf(Date).isRequired,
  eventsByDay: PropTypes.instanceOf(Map),
  calendarsById: PropTypes.objectOf(calendarShape),
  weekStartsOn: PropTypes.oneOf([0, 1]),
  maxPerDay: PropTypes.number,
  onEventClick: PropTypes.func,
  onToggleComplete: PropTypes.func,
  canComplete: PropTypes.func,
  className: PropTypes.string,
};
