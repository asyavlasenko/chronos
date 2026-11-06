// Дизайн: 02-week-cards.html (картка дня: шапка 70px, сітка 36px/год, події, «+ Додати»; сьогодні — темна шапка + --ring-today)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import {
  eventToGridPosition,
  formatHours,
  isToday as isTodayFn,
  nowOffsetMinutes,
  durationMinutes,
  weekdayIndex,
  WEEKDAYS_SHORT,
  toDate,
} from '../../utils/dates';
import { eventShape, calendarShape } from '../../utils/propTypes';
import HourGrid from './HourGrid';
import EventBlock from './EventBlock';
import FreeSlot from './FreeSlot';
import NowLine from './NowLine';
import Badge from '../ui/Badge';
import styles from './DayCard.module.css';

const HOUR_H = 36;

/** Вільні вікна ≥ 60 хв між подіями дня в межах сітки (лише для сьогодні, як у мокапі). */
function findFreeSlots(day, timed, startHour, endHour, now) {
  const slots = [];
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour);
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endHour);
  let cursor =
    now > dayStart ? new Date(Math.ceil(now.getTime() / (30 * 60000)) * 30 * 60000) : dayStart;
  const sorted = [...timed].sort((a, b) => toDate(a.startAt) - toDate(b.startAt));
  sorted.forEach((e) => {
    const s = toDate(e.startAt);
    const en = e.endAt ? toDate(e.endAt) : s;
    if (s - cursor >= 60 * 60000) slots.push({ start: new Date(cursor), end: new Date(s) });
    if (en > cursor) cursor = en;
  });
  if (dayEnd - cursor >= 60 * 60000) slots.push({ start: new Date(cursor), end: dayEnd });
  return slots.slice(0, 2);
}

export default function DayCard({
  date,
  events,
  calendarsById,
  startHour = 8,
  endHour = 20,
  selectedEventId = null,
  onEventClick,
  onSlotClick,
  onToggleComplete = null,
  showFreeSlots = true,
  authorsById = null,
  className = '',
}) {
  const today = isTodayFn(date);
  const now = new Date();
  const allDay = events.filter((e) => e.allDay || !e.startAt);
  const timed = events.filter((e) => !e.allDay && e.startAt);
  const busyMinutes = timed
    .filter((e) => e.type === 'arrangement')
    .reduce((sum, e) => sum + durationMinutes(e.startAt, e.endAt), 0);
  const deadline = allDay.find((e) => e.type === 'task' && e.isDeadline);
  const holiday = allDay.find((e) => e.type === 'holiday');
  const nowMin = today ? nowOffsetMinutes(now, startHour, endHour) : null;
  const freeSlots =
    showFreeSlots && today ? findFreeSlots(date, timed, startHour, endHour, now) : [];

  return (
    <section
      className={cx(styles.card, today && styles.today, className)}
      aria-label={`${WEEKDAYS_SHORT[weekdayIndex(date)]} ${date.getDate()}${today ? ', сьогодні' : ''}`}
    >
      <div className={styles.head}>
        <div>
          <span className={styles.w}>
            {WEEKDAYS_SHORT[weekdayIndex(date)]}
            {today ? ' · сьогодні' : ''}
          </span>
          <span className={styles.n}>{date.getDate()}</span>
        </div>
        <span className={styles.right}>
          {holiday ? (
            <Badge variant="tint" color="holidays" size="sm">
              {holiday.title}
            </Badge>
          ) : null}
          {deadline ? (
            <Badge
              variant="tint"
              color={calendarsById[deadline.calendar]?.color || 'purple'}
              size="sm"
            >
              Дедлайн
            </Badge>
          ) : null}
          {!holiday && !deadline && busyMinutes > 0 ? (
            <span className={styles.h}>{formatHours(busyMinutes)}</span>
          ) : null}
        </span>
      </div>

      <HourGrid
        day={date}
        startHour={startHour}
        endHour={endHour}
        hourHeight={HOUR_H}
        className={styles.grid}
        onSlotClick={onSlotClick}
      >
        {timed.map((e) => {
          const { top, height } = eventToGridPosition(e.startAt, e.endAt, {
            gridStartHour: startHour,
            hourHeight: HOUR_H,
          });
          const author =
            authorsById && e.creator && e.creator !== 'u-me' ? authorsById[e.creator] : null;
          let blockHeight = 22;
          if (e.type === 'arrangement') blockHeight = height;
          else if (e.type === 'task') blockHeight = HOUR_H;
          const gridHeight = (endHour - startHour) * HOUR_H;
          const clampedTop = Math.max(0, Math.min(top, gridHeight - blockHeight));
          return (
            <EventBlock
              key={e.id}
              event={e}
              calendar={calendarsById[e.calendar]}
              variant="week"
              top={clampedTop}
              height={blockHeight}
              selected={e.id === selectedEventId}
              author={author}
              onClick={onEventClick}
              onToggleComplete={onToggleComplete}
            />
          );
        })}
        {freeSlots.map((s) => {
          const { top, height } = eventToGridPosition(s.start, s.end, {
            gridStartHour: startHour,
            hourHeight: HOUR_H,
          });
          return (
            <FreeSlot
              key={s.start.toISOString()}
              variant="week"
              start={s.start}
              end={s.end}
              top={top + 2}
              height={Math.min(height - 4, 32)}
              onClick={onSlotClick}
            />
          );
        })}
        {nowMin !== null ? <NowLine top={(nowMin / 60) * HOUR_H} left={-8} right={-8} /> : null}
      </HourGrid>

      <button
        type="button"
        className={cx(styles.add, today && styles.addToday)}
        onClick={() =>
          onSlotClick(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9))
        }
      >
        + Додати
      </button>
    </section>
  );
}

DayCard.propTypes = {
  date: PropTypes.instanceOf(Date).isRequired,
  events: PropTypes.arrayOf(eventShape).isRequired,
  calendarsById: PropTypes.objectOf(calendarShape).isRequired,
  startHour: PropTypes.number,
  endHour: PropTypes.number,
  selectedEventId: PropTypes.string,
  onEventClick: PropTypes.func.isRequired,
  onSlotClick: PropTypes.func.isRequired,
  onToggleComplete: PropTypes.func,
  showFreeSlots: PropTypes.bool,
  authorsById: PropTypes.objectOf(
    PropTypes.shape({
      initials: PropTypes.string,
      name: PropTypes.string,
      color: PropTypes.string,
    }),
  ),
  className: PropTypes.string,
};
