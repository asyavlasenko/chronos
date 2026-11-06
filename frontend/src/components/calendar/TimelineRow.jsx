// Дизайн: design/screens/03-week-timeline.html
// Рядок дня у стрічці часу: ліворуч посилання на день («Пн 2» + підпис), праворуч 72px-смуга з годинами
// колонками. Довжина блоку = тривалість (left/width у %). Сьогодні — фон --accent-tint-soft, підпис --accent.
import { useRef } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import cx from '../../utils/cx';
import { resolveEventColors } from '../../utils/colors';
import {
  durationMinutes,
  formatHours,
  isToday as isTodayFn,
  toDate,
  toDateParam,
  weekdayIndex,
  WEEKDAYS_SHORT,
} from '../../utils/dates';
import { pluralEvents } from '../../utils/text';
import { eventShape, calendarShape } from '../../utils/propTypes';
import EventBlock from './EventBlock';
import FreeSlot from './FreeSlot';
import styles from './TimelineRow.module.css';

const ROW_H = 72;
const BLOCK_TOP = 8;
const BLOCK_H = 56;
const BLOCK_TOP_COMPACT = 32;
const BLOCK_H_COMPACT = 34;
const REM_TOP = 24;
const REM_TOP_COMPACT = 38;
const TASK_MINUTES = 60;
const FREE_MIN = 60;
const STEP = 30;

/** Хвилини від початку сітки до startAt події (може бути від'ємним — подія почалась раніше за сітку). */
function minutesFromGridStart(value, startHour) {
  const d = toDate(value);
  return d.getHours() * 60 + d.getMinutes() - startHour * 60;
}

/** Підпис під назвою дня: «3 події · 4 год» · «2 події · 1 нагад.» · «сьогодні · 5,5 год» · «дедлайн · 1 подія». */
function daySummary({ today, arrangements, reminders, hasDeadline, busy }) {
  if (today) return `сьогодні · ${formatHours(busy)}`;
  if (hasDeadline) return `дедлайн · ${pluralEvents(arrangements)}`;
  if (arrangements === 0 && reminders === 0) return 'вільно';
  if (reminders > 0) return `${pluralEvents(arrangements)} · ${reminders} нагад.`;
  return `${pluralEvents(arrangements)} · ${formatHours(busy)}`;
}

/** Вільні вікна ≥ 60 хв від «зараз» до кінця сітки (лише для сьогодні, як «+ вільно» у мокапі). */
function findFreeSlots(day, busyEvents, startHour, endHour, now) {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour);
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endHour);
  const stepMs = STEP * 60000;
  let cursor = now > dayStart ? new Date(Math.ceil(now.getTime() / stepMs) * stepMs) : dayStart;
  const slots = [];
  [...busyEvents]
    .sort((a, b) => toDate(a.startAt) - toDate(b.startAt))
    .forEach((e) => {
      const s = toDate(e.startAt);
      const en = e.endAt ? toDate(e.endAt) : new Date(s.getTime() + TASK_MINUTES * 60000);
      if (s - cursor >= FREE_MIN * 60000) slots.push({ start: new Date(cursor), end: new Date(s) });
      if (en > cursor) cursor = en;
    });
  if (dayEnd - cursor >= FREE_MIN * 60000) slots.push({ start: new Date(cursor), end: dayEnd });
  return slots.slice(0, 2);
}

export default function TimelineRow({
  date,
  events,
  calendarsById,
  startHour = 8,
  endHour = 20,
  now = new Date(),
  selectedEventId = null,
  onEventClick,
  onSlotClick,
  onToggleComplete = null,
  showFreeSlots = true,
}) {
  const rowRef = useRef(null);
  const today = isTodayFn(date);
  const totalMinutes = (endHour - startHour) * 60;
  const pct = (minutes) => (minutes / totalMinutes) * 100;

  const allDay = events.filter((e) => e.allDay || !e.startAt);
  const timed = events
    .filter((e) => !e.allDay && e.startAt)
    .filter((e) => {
      const start = minutesFromGridStart(e.startAt, startHour);
      const end = e.endAt ? start + durationMinutes(e.startAt, e.endAt) : start;
      return start < totalMinutes && end >= 0;
    });

  const arrangements = timed.filter((e) => e.type === 'arrangement');
  const reminders = timed.filter((e) => e.type === 'reminder');
  const busy = arrangements.reduce((sum, e) => sum + durationMinutes(e.startAt, e.endAt), 0);
  const hasDeadline = allDay.some((e) => e.type === 'task' && e.isDeadline);
  const summary = daySummary({
    today,
    arrangements: arrangements.length,
    reminders: reminders.length,
    hasDeadline,
    busy,
  });

  const compact = allDay.length > 0;
  const blockTop = compact ? BLOCK_TOP_COMPACT : BLOCK_TOP;
  const blockHeight = compact ? BLOCK_H_COMPACT : BLOCK_H;
  const remTop = compact ? REM_TOP_COMPACT : REM_TOP;

  const freeSlots =
    showFreeSlots && today
      ? findFreeSlots(
          date,
          timed.filter((e) => e.type !== 'reminder'),
          startHour,
          endHour,
          now,
        )
      : [];

  const handleRowClick = (e) => {
    if (e.target !== rowRef.current) return;
    const rect = rowRef.current.getBoundingClientRect();
    const fraction = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const minutes = Math.floor((fraction * totalMinutes) / STEP) * STEP;
    onSlotClick(new Date(date.getFullYear(), date.getMonth(), date.getDate(), startHour, minutes));
  };

  const label = `${WEEKDAYS_SHORT[weekdayIndex(date)]} ${date.getDate()}`;

  return (
    <div className={cx(styles.row, today && styles.today)}>
      <Link
        to={`/calendar/day?date=${toDateParam(date)}`}
        className={styles.dayLink}
        aria-current={today ? 'date' : undefined}
        aria-label={`${label}${today ? ', сьогодні' : ''}: ${summary}`}
      >
        <b className={styles.dayName}>
          {WEEKDAYS_SHORT[weekdayIndex(date)]}{' '}
          <span className={styles.dayNum}>{date.getDate()}</span>
        </b>
        <span className={styles.daySummary}>{summary}</span>
      </Link>

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        ref={rowRef}
        className={styles.track}
        style={{
          height: ROW_H,
          backgroundImage: `repeating-linear-gradient(to right, var(--line-soft) 0, var(--line-soft) 1px, transparent 1px, transparent calc(100% / ${endHour - startHour}))`,
        }}
        onClick={handleRowClick}
      >
        {allDay.length ? (
          <div className={styles.allDayRow}>
            {allDay.map((e) => (
              <button
                key={e.id}
                type="button"
                className={styles.allDay}
                style={{ background: resolveEventColors(e, calendarsById[e.calendar]).base }}
                onClick={() => onEventClick(e)}
              >
                Весь день · {e.title}
              </button>
            ))}
          </div>
        ) : null}

        {timed.map((e) => {
          const startMin = minutesFromGridStart(e.startAt, startHour);
          const left = Math.max(0, pct(startMin));

          if (e.type === 'reminder') {
            const anchorRight = left > 75;
            return (
              <EventBlock
                key={e.id}
                event={e}
                calendar={calendarsById[e.calendar]}
                variant="timeline"
                top={remTop}
                left={anchorRight ? null : `${left}%`}
                selected={e.id === selectedEventId}
                onClick={onEventClick}
                className={cx(styles.rem, anchorRight && styles.remEnd)}
              />
            );
          }

          const minutes = e.endAt ? durationMinutes(e.startAt, e.endAt) : TASK_MINUTES;
          const endMin = Math.min(startMin + minutes, totalMinutes);
          const width = Math.max(pct(endMin) - left, 0);
          return (
            <EventBlock
              key={e.id}
              event={e}
              calendar={calendarsById[e.calendar]}
              variant="timeline"
              top={blockTop}
              height={blockHeight}
              left={`${left}%`}
              width={`${width}%`}
              selected={e.id === selectedEventId}
              onClick={onEventClick}
              onToggleComplete={onToggleComplete}
              className={cx(styles.block, compact && styles.blockCompact)}
            />
          );
        })}

        {freeSlots.map((s) => {
          const left = pct(minutesFromGridStart(s.start, startHour));
          const width = pct(durationMinutes(s.start, s.end));
          return (
            <div
              key={s.start.toISOString()}
              className={styles.freeWrap}
              style={{
                top: blockTop,
                height: blockHeight,
                left: `calc(${left}% + 2px)`,
                width: `calc(${width}% - 4px)`,
              }}
            >
              <FreeSlot
                variant="week"
                start={s.start}
                end={s.end}
                top={0}
                height={blockHeight}
                label="+ вільно"
                onClick={onSlotClick}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

TimelineRow.propTypes = {
  date: PropTypes.instanceOf(Date).isRequired,
  events: PropTypes.arrayOf(eventShape).isRequired,
  calendarsById: PropTypes.objectOf(calendarShape).isRequired,
  startHour: PropTypes.number,
  endHour: PropTypes.number,
  now: PropTypes.instanceOf(Date),
  selectedEventId: PropTypes.string,
  onEventClick: PropTypes.func.isRequired,
  onSlotClick: PropTypes.func.isRequired,
  onToggleComplete: PropTypes.func,
  showFreeSlots: PropTypes.bool,
};
