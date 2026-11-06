// Дизайн: design/screens/04-day.html
// Календар · День: сітка 64px/год з великими блоками (опис, аватари, «Приєднатись · 48 хв»), вільні вікна
// пунктиром, лінія «зараз»; праворуч — «Наступна», міні-місяць і «Далі цього тижня».
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useViewDate from '../hooks/useViewDate';
import useAuth from '../hooks/useAuth';
import useEvents from '../hooks/useEvents';
import useCalendars from '../hooks/useCalendars';
import useModals from '../hooks/useModals';
import { people } from '../mocks/data';
import {
  addMinutes,
  currentEvent,
  groupEventsByDay,
  nextUpcoming,
  participantsToAvatars,
} from '../utils/eventStats';
import {
  addMonths,
  durationMinutes,
  eventToGridPosition,
  formatDate,
  formatHours,
  formatRelative,
  formatTime,
  formatTimeRange,
  getViewRange,
  getWeekDays,
  isSameDay,
  isToday as isTodayFn,
  nowOffsetMinutes,
  startOfDay,
  startOfMonth,
  toDate,
  toDateParam,
} from '../utils/dates';
import { pluralEvents, pluralTasks } from '../utils/text';
import { resolveEventColors } from '../utils/colors';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import DarkCard from '../components/ui/DarkCard';
import PillButton from '../components/ui/PillButton';
import HourRuler from '../components/calendar/HourRuler';
import HourGrid from '../components/calendar/HourGrid';
import EventBlock from '../components/calendar/EventBlock';
import FreeSlot from '../components/calendar/FreeSlot';
import NowLine from '../components/calendar/NowLine';
import MiniMonth from '../components/calendar/MiniMonth';
import styles from './DayPage.module.css';

const START_HOUR = 8;
const END_HOUR = 20;
const HOUR_H = 64;
const GRID_H = (END_HOUR - START_HOUR) * HOUR_H;
const TASK_H = 56;
const REMINDER_H = 36;
const TASK_MINUTES = 60;
const FREE_MIN = 60;

/** «Зараз», що оновлюється раз на пів хвилини (лінія «зараз», «через 48 хв»). */
function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** «Google Meet» для meet.google.com/…, «Zoom» для zoom.us/…, інакше — як є. */
function locationLabel(location) {
  if (!location) return '';
  if (/meet\.google\.com/.test(location)) return 'Google Meet';
  if (/zoom\.us/.test(location)) return 'Zoom';
  if (/teams\.microsoft\.com/.test(location)) return 'Teams';
  return location;
}

/** Посилання для «Приєднатись»: meet.google.com/… або будь-який http(s)-адрес у полі «місце». */
function meetingHref(location) {
  if (!location) return null;
  if (/^https?:\/\//.test(location)) return location;
  if (/^(meet\.google\.com|zoom\.us|teams\.microsoft\.com)\//.test(location)) {
    return `https://${location}`;
  }
  return null;
}

/** Вільні вікна ≥ 60 хв між зайнятими інтервалами дня в межах сітки (задача без кінця — 60 хв). */
function findFreeSlots(day, busyEvents, startHour, endHour) {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour);
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endHour);
  const slots = [];
  let cursor = dayStart;
  [...busyEvents]
    .sort((a, b) => toDate(a.startAt) - toDate(b.startAt))
    .forEach((e) => {
      const s = toDate(e.startAt);
      const en = e.endAt ? toDate(e.endAt) : new Date(s.getTime() + TASK_MINUTES * 60000);
      if (s - cursor >= FREE_MIN * 60000) slots.push({ start: new Date(cursor), end: new Date(s) });
      if (en > cursor) cursor = en;
    });
  if (dayEnd - cursor >= FREE_MIN * 60000) slots.push({ start: new Date(cursor), end: dayEnd });
  return slots;
}

/** Підпис «Приєднатись · 48 хв» / «Приєднатись · зараз» для найближчої або поточної зустрічі. */
function joinLabel(event, now) {
  const relative = formatRelative(event.startAt, now).replace(/^через /, '');
  return `Приєднатись · ${relative}`;
}

export default function DayPage() {
  const { date, setDate } = useViewDate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const now = useNow();
  const weekStartsOn = user?.weekStartsOn ?? 1;
  const today = isTodayFn(date);
  const isPast = date < startOfDay(now) && !today;

  // Події тижня: з них — сітка дня і список «Далі цього тижня»
  const weekRange = useMemo(() => getViewRange('week', date, weekStartsOn), [date, weekStartsOn]);
  const { events: weekEvents, toggleCompleted } = useEvents({ ...weekRange, q });
  const { byId } = useCalendars();
  const { openDetails, openQuickCreate, detailsEventId } = useModals();

  // Міні-місяць: окремий курсор місяця, дні з подіями — з подій цього місяця
  const [month, setMonth] = useState(() => startOfMonth(date));
  useEffect(() => {
    setMonth(startOfMonth(date));
  }, [date]);
  const monthRange = useMemo(() => ({ from: month, to: addMonths(month, 1) }), [month]);
  const { events: monthEvents } = useEvents(monthRange);
  const markedDays = useMemo(
    () => new Set(monthEvents.filter((e) => e.startAt).map((e) => toDateParam(e.startAt))),
    [monthEvents],
  );

  const weekByDay = useMemo(() => groupEventsByDay(weekEvents), [weekEvents]);
  const dayEvents = weekByDay.get(date.toDateString()) || [];
  const allDay = dayEvents.filter((e) => e.allDay || !e.startAt);
  const timed = dayEvents.filter((e) => !e.allDay && e.startAt);
  const arrangements = timed.filter((e) => e.type === 'arrangement');
  const reminders = timed.filter((e) => e.type === 'reminder');
  const tasks = dayEvents.filter((e) => e.type === 'task');

  // Найближча/поточна зустріч (лише сьогодні) — «Приєднатись · 48 хв» і обведення
  const nextArrangement = arrangements
    .filter((e) => toDate(e.startAt) > now)
    .sort((a, b) => toDate(a.startAt) - toDate(b.startAt))[0];
  const highlight = today ? currentEvent(arrangements, now) || nextArrangement || null : null;

  // Вільні вікна: не для минулих днів; сьогодні — лише ті, що ще не минули
  let freeSlots = [];
  if (!isPast) {
    freeSlots = findFreeSlots(
      date,
      timed.filter((e) => e.type !== 'reminder'),
      START_HOUR,
      END_HOUR,
    ).filter((s) => !today || s.end > now);
  }
  const freeMinutes = freeSlots.reduce((sum, s) => sum + durationMinutes(s.start, s.end), 0);

  const nowMin = today ? nowOffsetMinutes(now, START_HOUR, END_HOUR) : null;
  const next = nextUpcoming(dayEvents, now);
  const joinHref = next && next.type === 'arrangement' ? meetingHref(next.location) : null;

  const restOfWeek = getWeekDays(date, weekStartsOn)
    .filter((d) => d > date)
    .map((d) => ({ day: d, events: weekByDay.get(d.toDateString()) || [] }))
    .filter((row) => row.events.length > 0);

  const summaryParts = [pluralEvents(arrangements.length + reminders.length)];
  if (tasks.length) summaryParts.push(pluralTasks(tasks.length));
  const summaryText = [
    today ? 'Сьогодні' : formatDate(date, 'weekday-long'),
    summaryParts.join(', '),
    freeMinutes > 0 ? `вільно ${formatHours(freeMinutes)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const defaultDuration = user?.defaultArrangementDuration ?? 60;
  const onSlotClick = (start) =>
    openQuickCreate({ date: start, startAt: start, endAt: addMinutes(start, defaultDuration) });
  const onFreeSlotClick = (start, end) =>
    openQuickCreate({
      date: start,
      startAt: start,
      endAt: addMinutes(start, Math.min(defaultDuration, durationMinutes(start, end))),
    });

  const arrangementMeta = (e) => {
    const cal = byId[e.calendar];
    const place = locationLabel(e.location);
    return [formatTimeRange(e.startAt, e.endAt), cal?.name, place || null]
      .filter(Boolean)
      .join(' · ');
  };

  /** Чіп події для «Далі цього тижня» і подій «весь день»: дедлайн — темний чіп кольору календаря. */
  const renderChip = (e) => {
    if (e.type === 'task' && e.isDeadline) {
      return (
        <button
          key={e.id}
          type="button"
          className={styles.deadlineChip}
          style={{ background: resolveEventColors(e, byId[e.calendar]).base }}
          onClick={() => openDetails(e.id)}
        >
          {e.title}
        </button>
      );
    }
    return (
      <EventBlock
        key={e.id}
        event={e}
        calendar={byId[e.calendar]}
        variant="chip"
        onClick={() => openDetails(e.id)}
        onToggleComplete={() => toggleCompleted(e.id)}
      />
    );
  };

  return (
    <div className={styles.layout}>
      <Card
        as="section"
        radius={20}
        padding="20px 22px 22px"
        gap={14}
        className={styles.main}
        aria-label={formatDate(date, 'weekday-long')}
      >
        <div className={styles.summary}>
          <span className={styles.summaryText}>{summaryText}</span>
          <span className={styles.spacer} />
          <span className={styles.badges}>
            <Badge variant="muted">Зустрічі {arrangements.length}</Badge>
            <Badge variant="muted">Задачі {tasks.length}</Badge>
            <Badge variant="muted">Нагадувань {reminders.length}</Badge>
          </span>
        </div>

        {allDay.length ? (
          <div className={styles.allDayRow}>
            <span className={styles.allDayLabel}>Весь день</span>
            <span className={styles.chips}>{allDay.map(renderChip)}</span>
          </div>
        ) : null}

        <div className={styles.gridWrap}>
          <div className={styles.grid}>
            <HourRuler
              startHour={START_HOUR}
              endHour={END_HOUR}
              hourHeight={HOUR_H}
              width={52}
              fontSize={11}
            />
            <HourGrid
              day={date}
              startHour={START_HOUR}
              endHour={END_HOUR}
              hourHeight={HOUR_H}
              lineColor="var(--line-grid)"
              onSlotClick={onSlotClick}
              className={styles.hours}
            >
              {freeSlots.map((s, i) => {
                const { top, height } = eventToGridPosition(s.start, s.end, {
                  gridStartHour: START_HOUR,
                  hourHeight: HOUR_H,
                });
                const morning = i === 0 && s.start.getHours() === START_HOUR;
                return (
                  <FreeSlot
                    key={s.start.toISOString()}
                    variant="day"
                    start={s.start}
                    end={s.end}
                    top={top + 4}
                    height={height - 8}
                    label={morning ? `Ранок вільний до ${formatTime(s.end)} ·` : null}
                    onClick={onFreeSlotClick}
                  />
                );
              })}

              {timed.map((e) => {
                const { top, height } = eventToGridPosition(e.startAt, e.endAt, {
                  gridStartHour: START_HOUR,
                  hourHeight: HOUR_H,
                });
                const cal = byId[e.calendar];
                let blockHeight = height;
                if (e.type === 'task') blockHeight = TASK_H;
                else if (e.type === 'reminder') blockHeight = REMINDER_H;
                const clampedTop = Math.max(0, Math.min(top, GRID_H - blockHeight));
                const isHighlight = highlight?.id === e.id;

                if (e.type === 'task') {
                  return (
                    <EventBlock
                      key={e.id}
                      event={e}
                      calendar={cal}
                      variant="day"
                      top={clampedTop}
                      height={blockHeight}
                      meta={[`задача · ${formatTime(e.startAt)}`, cal?.name]
                        .filter(Boolean)
                        .join(' · ')}
                      selected={e.id === detailsEventId}
                      onClick={() => openDetails(e.id)}
                      onToggleComplete={() => toggleCompleted(e.id)}
                    />
                  );
                }
                if (e.type === 'reminder') {
                  return (
                    <EventBlock
                      key={e.id}
                      event={e}
                      calendar={cal}
                      variant="day"
                      top={clampedTop}
                      height={blockHeight}
                      selected={e.id === detailsEventId}
                      onClick={() => openDetails(e.id)}
                    />
                  );
                }
                const avatars = participantsToAvatars(e.participants, people);
                return (
                  <EventBlock
                    key={e.id}
                    event={e}
                    calendar={cal}
                    variant="day"
                    top={clampedTop}
                    height={blockHeight}
                    meta={arrangementMeta(e)}
                    description={e.description || null}
                    participants={avatars.length ? avatars : null}
                    action={
                      isHighlight ? (
                        <Badge variant="dark" size="lg">
                          {joinLabel(e, now)}
                        </Badge>
                      ) : null
                    }
                    selected={isHighlight || e.id === detailsEventId}
                    onClick={() => openDetails(e.id)}
                  />
                );
              })}

              {nowMin !== null ? (
                <NowLine
                  top={(nowMin / 60) * HOUR_H}
                  now={now}
                  showLabel
                  left={-8}
                  labelLeft={-44}
                />
              ) : null}
            </HourGrid>
          </div>
        </div>
      </Card>

      <aside className={styles.side}>
        <DarkCard
          eyebrow="Наступна"
          value={next ? formatRelative(next.startAt, now) : null}
          valueSize={28}
          title={next ? next.title : 'Нічого не заплановано'}
          meta={
            next
              ? [formatTimeRange(next.startAt, next.endAt), locationLabel(next.location) || null]
                  .filter(Boolean)
                  .join(' · ')
              : null
          }
        >
          {next && next.type === 'arrangement' ? (
            <PillButton
              variant="white"
              size="sm"
              fullWidth
              className={styles.join}
              href={joinHref || undefined}
              target={joinHref ? '_blank' : undefined}
              rel={joinHref ? 'noreferrer' : undefined}
              onClick={joinHref ? undefined : () => openDetails(next.id)}
            >
              Приєднатись
            </PillButton>
          ) : null}
        </DarkCard>

        <Card radius={20} padding="18px" gap={0}>
          <MiniMonth
            month={month}
            selected={date}
            onSelect={setDate}
            onMonthChange={setMonth}
            markedDays={markedDays}
            weekStartsOn={weekStartsOn}
          />
        </Card>

        <Card radius={20} padding="18px" gap={0}>
          <span className={styles.sideTitle}>Далі цього тижня</span>
          {restOfWeek.length ? (
            <ul className={styles.upcoming}>
              {restOfWeek.map(({ day, events }) => (
                <li key={day.toISOString()} className={styles.upcomingRow}>
                  <span className={styles.upcomingDay}>{formatDate(day, 'weekday-day')}</span>
                  <span className={styles.chips}>{events.map(renderChip)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span className={styles.empty}>
              {isSameDay(date, getWeekDays(date, weekStartsOn)[6])
                ? 'Це останній день тижня'
                : 'Решта тижня вільна'}
            </span>
          )}
        </Card>
      </aside>
    </div>
  );
}
