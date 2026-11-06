// Дизайн: design/screens/02-week-cards.html
// Календар · Тиждень (картки): чіпи-підсумки, фільтри календарів, 7 карток днів із годинною сіткою 36px/год.
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import useViewDate from '../hooks/useViewDate';
import useAuth from '../hooks/useAuth';
import useEvents from '../hooks/useEvents';
import useCalendars from '../hooks/useCalendars';
import useModals from '../hooks/useModals';
import { people } from '../mocks/data';
import { addMinutes, groupEventsByDay, nextUpcoming, weekSummary } from '../utils/eventStats';
import { formatRelative, getViewRange, getWeekDays, formatHours } from '../utils/dates';
import { pluralEvents } from '../utils/text';
import Badge from '../components/ui/Badge';
import Chip from '../components/ui/Chip';
import HourRuler from '../components/calendar/HourRuler';
import DayCard from '../components/calendar/DayCard';
import styles from './WeekPage.module.css';

const START_HOUR = 8;
const END_HOUR = 20;

export default function WeekPage() {
  const { date } = useViewDate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const weekStartsOn = user?.weekStartsOn ?? 1;
  const days = useMemo(() => getWeekDays(date, weekStartsOn), [date, weekStartsOn]);
  const { from, to } = useMemo(
    () => getViewRange('week', date, weekStartsOn),
    [date, weekStartsOn],
  );
  const { events, toggleCompleted } = useEvents({ from, to, q });
  const { calendars, byId, toggleVisibility } = useCalendars();
  const { openDetails, openQuickCreate, detailsEventId } = useModals();

  const byDay = useMemo(() => groupEventsByDay(events), [events]);
  const summary = useMemo(() => weekSummary(events), [events]);
  const next = useMemo(() => nextUpcoming(events), [events]);
  const todayCount = summary.todayEvents;

  const onSlotClick = (start) =>
    openQuickCreate({
      date: start,
      startAt: start,
      endAt: addMinutes(start, user?.defaultArrangementDuration ?? 60),
    });

  return (
    <>
      <div className={styles.summary}>
        <Badge variant="dark" size="lg" dot="accent">
          Сьогодні {pluralEvents(todayCount)}
          {next ? ` · наступна ${formatRelative(next.startAt)}` : ''}
        </Badge>
        <Badge variant="white" size="lg">
          Задачі&nbsp;
          <b>
            {summary.tasksDone} з {summary.tasksTotal}
          </b>
        </Badge>
        <Badge variant="white" size="lg">
          {formatHours(summary.busyMinutes)} зайнято
        </Badge>
        <span className={styles.spacer} />
        <span className={styles.filterLabel}>Календарі:</span>
        {calendars.map((c) => (
          <Chip
            key={c.id}
            label={c.id === 'holidays' ? 'Свята' : c.name}
            checked={!c.isHidden}
            onChange={() => toggleVisibility(c.id)}
            color={c.color}
          />
        ))}
      </div>

      <div className={styles.days}>
        <HourRuler
          startHour={START_HOUR}
          endHour={END_HOUR}
          hourHeight={36}
          width={44}
          fontSize={10}
          topOffset={70}
        />
        {days.map((d) => (
          <DayCard
            key={d.toISOString()}
            date={d}
            events={byDay.get(d.toDateString()) || []}
            calendarsById={byId}
            startHour={START_HOUR}
            endHour={END_HOUR}
            selectedEventId={detailsEventId}
            onEventClick={(e) => openDetails(e.id)}
            onSlotClick={onSlotClick}
            onToggleComplete={(e) => toggleCompleted(e.id)}
            authorsById={people}
          />
        ))}
      </div>
    </>
  );
}
