// Дизайн: design/screens/01-overview.html (десктоп), 16-mobile.html (мобільний)
// Огляд: привітання, таймлайн сьогодні, «Наступна», задачі тижня, навантаження тижня, спільні календарі,
// запрошення, свята, список календарів. На мобільному (≤768px) — смужка днів, темний рядок «Наступна», список дня.
import { useEffect, useMemo, useState } from 'react';
import useAuth from '../hooks/useAuth';
import useEvents from '../hooks/useEvents';
import useCalendars from '../hooks/useCalendars';
import useModals from '../hooks/useModals';
import { people } from '../mocks/data';
import {
  addDays,
  formatDate,
  formatWeekRange,
  getIsoWeek,
  getViewRange,
  getWeekDays,
  isToday,
  parseDateParam,
  toDate,
} from '../utils/dates';
import { busyMinutes, groupEventsByDay, nextUpcoming, weekSummary } from '../utils/eventStats';
import { greeting, pluralEvents, pluralHoursLong, pluralTasks } from '../utils/text';
import DayStrip from '../components/calendar/DayStrip';
import TodayTimeline from '../components/overview/TodayTimeline';
import NextEventCard from '../components/overview/NextEventCard';
import TasksCard from '../components/overview/TasksCard';
import WeekLoadChart from '../components/overview/WeekLoadChart';
import SharedCalendarsCard from '../components/overview/SharedCalendarsCard';
import InvitesCard from '../components/overview/InvitesCard';
import HolidayList from '../components/overview/HolidayList';
import CalendarsCard from '../components/overview/CalendarsCard';
import MobileDayList from '../components/overview/MobileDayList';
import styles from './OverviewPage.module.css';

const TICK_MS = 60000;
const HOLIDAYS_SHOWN = 2;

/** «Зараз», оновлюється щохвилини — для лінії часу, «через N хв» і вільних вікон. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

const isTimedEvent = (e) => e.type === 'arrangement' || e.type === 'reminder';

export default function OverviewPage() {
  const { user } = useAuth();
  const now = useNow();
  const todayKey = formatDate(now, 'iso');
  const today = useMemo(() => parseDateParam(todayKey), [todayKey]);
  const weekStartsOn = user?.weekStartsOn ?? 1;
  const [selectedDay, setSelectedDay] = useState(today);

  const days = useMemo(() => getWeekDays(today, weekStartsOn), [today, weekStartsOn]);
  const { from, to } = useMemo(
    () => getViewRange('week', today, weekStartsOn),
    [today, weekStartsOn],
  );
  const { events, holidayEvents, pendingInvites, respondInvite, toggleCompleted } = useEvents({
    from,
    to,
  });
  const { calendars, byId, toggleVisibility } = useCalendars();
  const { openDetails, openQuickCreate } = useModals();

  const byDay = useMemo(() => groupEventsByDay(events), [events]);
  const todayEvents = useMemo(() => byDay.get(today.toDateString()) || [], [byDay, today]);
  const selectedEvents = byDay.get(selectedDay.toDateString()) || [];
  const summary = useMemo(() => weekSummary(events), [events]);
  const next = useMemo(() => nextUpcoming(todayEvents, now), [todayEvents, now]);
  const weekTasks = useMemo(() => events.filter((e) => e.type === 'task'), [events]);
  const load = useMemo(
    () => days.map((d) => ({ date: d, minutes: busyMinutes(byDay.get(d.toDateString()) || []) })),
    [days, byDay],
  );
  const upcomingHolidays = useMemo(() => {
    const tomorrow = addDays(today, 1);
    return holidayEvents
      .filter((h) => toDate(h.startAt) >= tomorrow)
      .sort((a, b) => toDate(a.startAt) - toDate(b.startAt))
      .slice(0, HOLIDAYS_SHOWN);
  }, [holidayEvents, today]);
  const sharedCalendars = calendars.filter((c) => c.isShared && !c.isHidden);
  const userCalendars = calendars.filter((c) => !c.isReadOnly);

  const onEventClick = (e) => openDetails(e.id);
  const onSlotClick = (start, end) => openQuickCreate({ date: start, startAt: start, endAt: end });
  const onToggleComplete = (e) => toggleCompleted(e.id);

  const week = getIsoWeek(today);
  const showWeek = user?.showWeekNumbers ?? true;
  const hello = `${greeting(now)}, ${user?.firstName || user?.name || ''}`;
  const dateLine = [formatDate(today, 'weekday-long'), showWeek ? `тиждень ${week}` : null]
    .filter(Boolean)
    .join(' · ');
  const todayLine = `${pluralEvents(summary.todayEvents)} та ${pluralTasks(summary.todayTasks)} сьогодні`;
  const weekRange = formatWeekRange(today, weekStartsOn).replace(/\s\d{4}$/, '');
  const busyHours = Math.round(summary.busyMinutes / 60);
  const selectedEventsCount = selectedEvents.filter(isTimedEvent).length;
  const selectedTasksCount = selectedEvents.filter((e) => e.type === 'task').length;

  return (
    <>
      <div className={styles.desktop}>
        <div className={styles.greeting}>
          <h1 className={styles.h1}>{hello}</h1>
          <span className={styles.sub}>
            {dateLine} · {todayLine}
          </span>
        </div>

        <div className={styles.grid}>
          <TodayTimeline
            className={styles.today}
            date={today}
            events={todayEvents}
            calendarsById={byId}
            now={now}
            meId={user?.id}
            nextEventId={next?.id}
            slotMinutes={user?.defaultArrangementDuration ?? 60}
            onEventClick={onEventClick}
            onSlotClick={onSlotClick}
            onToggleComplete={onToggleComplete}
          />
          <NextEventCard event={next} now={now} people={people} onOpen={onEventClick} />
          <TasksCard tasks={weekTasks} onToggleComplete={onToggleComplete} onOpen={onEventClick} />
          <WeekLoadChart
            className={styles.week}
            days={load}
            title={`Тиждень ${week}`}
            subtitle={`${weekRange} · ${pluralHoursLong(busyHours)} зайнято`}
          />
          <SharedCalendarsCard calendars={sharedCalendars} people={people} />
          <InvitesCard invites={pendingInvites} onRespond={respondInvite} />
          <HolidayList
            holidays={upcomingHolidays}
            now={now}
            title={byId.holidays?.name || 'Свята України'}
          />
          <CalendarsCard calendars={userCalendars} onToggle={toggleVisibility} />
        </div>
      </div>

      <div className={styles.mobile}>
        <div className={styles.mHead}>
          <span className={styles.mDate}>{dateLine}</span>
          <h1 className={styles.mH1}>{hello}</h1>
        </div>
        <DayStrip variant="mobile" days={days} selected={selectedDay} onSelect={setSelectedDay} />
        <NextEventCard variant="row" event={next} now={now} people={people} onOpen={onEventClick} />
        <div className={styles.mListHead}>
          <h2 className={styles.mH2}>
            {isToday(selectedDay) ? 'Сьогодні' : formatDate(selectedDay, 'weekday-long')}
          </h2>
          <span className={styles.mCount}>
            {pluralEvents(selectedEventsCount)} · {pluralTasks(selectedTasksCount)}
          </span>
        </div>
        <MobileDayList
          date={selectedDay}
          events={selectedEvents}
          calendarsById={byId}
          now={now}
          meId={user?.id}
          highlightId={next?.id}
          onEventClick={onEventClick}
          onSlotClick={onSlotClick}
          onToggleComplete={onToggleComplete}
        />
      </div>
    </>
  );
}
