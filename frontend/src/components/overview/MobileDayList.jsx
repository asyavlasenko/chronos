// Дизайн: design/screens/16-mobile.html (список дня: колонка часу 40px + блоки подій, вільні вікна, задача з чекбоксом)
import PropTypes from 'prop-types';
import { formatTime, toDate } from '../../utils/dates';
import { eventShape, calendarShape } from '../../utils/propTypes';
import EventBlock from '../calendar/EventBlock';
import FreeSlot from '../calendar/FreeSlot';
import { busyIntervals, findFreeSlots, locationLabel, participantNames } from './overviewUtils';
import styles from './MobileDayList.module.css';

export default function MobileDayList({
  date,
  events,
  calendarsById,
  now,
  meId = null,
  highlightId = null,
  onEventClick,
  onSlotClick,
  onToggleComplete,
}) {
  const timed = events.filter((e) => e.startAt && !e.allDay);
  const slots = findFreeSlots(date, busyIntervals(timed), { now });
  const items = [
    ...timed.map((e) => ({ kind: 'event', at: toDate(e.startAt), event: e })),
    ...slots.map((s) => ({ kind: 'slot', at: s.start, slot: s })),
  ].sort((a, b) => a.at - b.at);

  // «Робота · Google Meet · Максим, Оля»; задача — «задача · Навчання»
  const metaFor = (e) => {
    const cal = calendarsById[e.calendar]?.name;
    if (e.type === 'task') return ['задача', cal].filter(Boolean).join(' · ');
    return [cal, locationLabel(e.location), participantNames(e.participants, meId)]
      .filter(Boolean)
      .join(' · ');
  };

  if (!items.length) return <p className={styles.empty}>Подій немає</p>;

  return (
    <div className={styles.list}>
      {items.map((it) => {
        if (it.kind === 'slot') {
          return (
            <FreeSlot
              key={`slot-${it.at.toISOString()}`}
              variant="list"
              start={it.slot.start}
              end={it.slot.end}
              label={it.slot.fromNow ? `Вільно до ${formatTime(it.slot.end)} · ` : null}
              onClick={onSlotClick}
            />
          );
        }
        const e = it.event;
        return (
          <div key={e.id} className={styles.row}>
            <span className={styles.time}>
              <span>{formatTime(e.startAt)}</span>
              {e.endAt ? <span className={styles.end}>{formatTime(e.endAt)}</span> : null}
            </span>
            <EventBlock
              event={e}
              calendar={calendarsById[e.calendar]}
              variant="mobile"
              meta={metaFor(e)}
              selected={e.id === highlightId}
              onClick={onEventClick}
              onToggleComplete={onToggleComplete}
              className={styles.block}
            />
          </div>
        );
      })}
    </div>
  );
}

MobileDayList.propTypes = {
  date: PropTypes.instanceOf(Date).isRequired,
  events: PropTypes.arrayOf(eventShape).isRequired,
  calendarsById: PropTypes.objectOf(calendarShape).isRequired,
  now: PropTypes.instanceOf(Date).isRequired,
  meId: PropTypes.string,
  highlightId: PropTypes.string,
  onEventClick: PropTypes.func.isRequired,
  onSlotClick: PropTypes.func.isRequired,
  onToggleComplete: PropTypes.func.isRequired,
};
