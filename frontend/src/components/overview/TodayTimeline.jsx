// Дизайн: design/screens/01-overview.html (картка «Сьогодні»: сітка 44px/год 08:00–20:00, вільні вікна, лінія «зараз»)
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import cx from '../../utils/cx';
import {
  eventToGridPosition,
  formatDate,
  formatRelative,
  formatTime,
  formatTimeRange,
  isToday as isTodayFn,
  nowOffsetMinutes,
} from '../../utils/dates';
import { addMinutes } from '../../utils/eventStats';
import { eventShape, calendarShape } from '../../utils/propTypes';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import HourRuler from '../calendar/HourRuler';
import HourGrid from '../calendar/HourGrid';
import EventBlock from '../calendar/EventBlock';
import FreeSlot from '../calendar/FreeSlot';
import NowLine from '../calendar/NowLine';
import { busyIntervals, findFreeSlots, participantNames } from './overviewUtils';
import styles from './TodayTimeline.module.css';

const HOUR_H = 44;
const START_HOUR = 8;
const END_HOUR = 20;
const GRID_H = (END_HOUR - START_HOUR) * HOUR_H;
const REMINDER_H = 36;

function blockHeight(event, height) {
  if (event.type === 'task') return HOUR_H;
  if (event.type === 'reminder') return REMINDER_H;
  return height;
}

export default function TodayTimeline({
  date,
  events,
  calendarsById,
  now,
  meId = null,
  nextEventId = null,
  slotMinutes = 60,
  onEventClick,
  onSlotClick,
  onToggleComplete,
  className = '',
}) {
  const today = isTodayFn(date);
  const timed = events.filter((e) => e.startAt && !e.allDay);
  const freeSlots = findFreeSlots(date, busyIntervals(timed), {
    startHour: START_HOUR,
    endHour: END_HOUR,
    now,
  });
  const nowMin = today ? nowOffsetMinutes(now, START_HOUR, END_HOUR) : null;

  // «11:00 – 12:00 · Робота · Максим, Оля» — час · календар · учасники (без себе)
  const metaFor = (e) =>
    [
      formatTimeRange(e.startAt, e.endAt),
      calendarsById[e.calendar]?.name,
      participantNames(e.participants, meId),
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <Card
      aria-label="Сьогодні"
      title={today ? 'Сьогодні' : formatDate(date, 'weekday-long')}
      subtitle={formatDate(date, 'weekday-short')}
      action={<Link to="/calendar/day">Відкрити день →</Link>}
      padding="18px 18px 14px"
      className={className}
    >
      <div className={styles.timeline}>
        <HourRuler
          startHour={START_HOUR}
          endHour={END_HOUR}
          hourHeight={HOUR_H}
          width={44}
          fontSize={10}
        />
        <HourGrid
          day={date}
          startHour={START_HOUR}
          endHour={END_HOUR}
          hourHeight={HOUR_H}
          lineColor="var(--line-grid)"
          onSlotClick={(start) => onSlotClick(start, addMinutes(start, slotMinutes))}
          className={styles.grid}
        >
          {timed.map((e) => {
            const { top, height } = eventToGridPosition(e.startAt, e.endAt, {
              gridStartHour: START_HOUR,
              hourHeight: HOUR_H,
            });
            const h = blockHeight(e, height);
            const clampedTop = Math.max(0, Math.min(top, GRID_H - h));
            const isArrangement = e.type === 'arrangement';
            const isNext = e.id === nextEventId;
            return (
              <EventBlock
                key={e.id}
                event={e}
                calendar={calendarsById[e.calendar]}
                variant="overview"
                top={clampedTop}
                height={h}
                left={6}
                width="calc(100% - 12px)"
                meta={isArrangement ? metaFor(e) : null}
                action={
                  isNext ? (
                    <Badge variant="white" className={styles.soon}>
                      {formatRelative(e.startAt, now)}
                    </Badge>
                  ) : null
                }
                className={cx(isArrangement && h <= HOUR_H && styles.compact)}
                onClick={onEventClick}
                onToggleComplete={onToggleComplete}
              />
            );
          })}
          {freeSlots.map((s) => {
            const { top, height } = eventToGridPosition(s.start, s.end, {
              gridStartHour: START_HOUR,
              hourHeight: HOUR_H,
            });
            return (
              <FreeSlot
                key={s.start.toISOString()}
                variant="overview"
                start={s.start}
                end={s.end}
                top={top + 4}
                height={height - 8}
                label={s.fromNow ? `Вільно до ${formatTime(s.end)} · ` : null}
                onClick={onSlotClick}
              />
            );
          })}
          {nowMin !== null ? (
            <NowLine top={(nowMin / 60) * HOUR_H} now={now} showLabel labelLeft={-44} />
          ) : null}
        </HourGrid>
      </div>
    </Card>
  );
}

TodayTimeline.propTypes = {
  date: PropTypes.instanceOf(Date).isRequired,
  events: PropTypes.arrayOf(eventShape).isRequired,
  calendarsById: PropTypes.objectOf(calendarShape).isRequired,
  now: PropTypes.instanceOf(Date).isRequired,
  meId: PropTypes.string,
  nextEventId: PropTypes.string,
  slotMinutes: PropTypes.number,
  onEventClick: PropTypes.func.isRequired,
  onSlotClick: PropTypes.func.isRequired,
  onToggleComplete: PropTypes.func.isRequired,
  className: PropTypes.string,
};
