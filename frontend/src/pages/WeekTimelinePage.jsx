// Дизайн: design/screens/03-week-timeline.html
// Календар · Тиждень (стрічка часу): дні рядками, години колонками, довжина блоку = тривалість,
// вертикальна лінія «зараз» через усі дні; праворуч — «Зараз», список календарів і фільтр типів.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useViewDate from '../hooks/useViewDate';
import useAuth from '../hooks/useAuth';
import useEvents from '../hooks/useEvents';
import useCalendars from '../hooks/useCalendars';
import useModals from '../hooks/useModals';
import { addMinutes, groupEventsByDay, nextUpcoming } from '../utils/eventStats';
import {
  formatDate,
  formatRelative,
  formatTime,
  getViewRange,
  getWeekDays,
  getIsoWeek,
  isToday,
  nowOffsetMinutes,
} from '../utils/dates';
import Card from '../components/ui/Card';
import DarkCard from '../components/ui/DarkCard';
import Chip from '../components/ui/Chip';
import PillButton from '../components/ui/PillButton';
import TimelineRow from '../components/calendar/TimelineRow';
import styles from './WeekTimelinePage.module.css';

const START_HOUR = 8;
const END_HOUR = 20;
const DAY_COL_W = 132;
const TYPE_OPTIONS = [
  { value: 'arrangement', label: 'Зустрічі' },
  { value: 'reminder', label: 'Нагадування' },
  { value: 'task', label: 'Задачі' },
];

/** «Зараз», що оновлюється раз на пів хвилини (для годинника в картці й лінії «зараз»). */
function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
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

export default function WeekTimelinePage() {
  const { date } = useViewDate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const now = useNow();
  const weekStartsOn = user?.weekStartsOn ?? 1;
  const days = useMemo(() => getWeekDays(date, weekStartsOn), [date, weekStartsOn]);
  const { from, to } = useMemo(
    () => getViewRange('week', date, weekStartsOn),
    [date, weekStartsOn],
  );

  const [hiddenTypes, setHiddenTypes] = useState([]);
  const types = useMemo(
    () => [...TYPE_OPTIONS.map((t) => t.value).filter((t) => !hiddenTypes.includes(t)), 'holiday'],
    [hiddenTypes],
  );
  const toggleType = (value) =>
    setHiddenTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value],
    );

  const { events, toggleCompleted } = useEvents({ from, to, q, types });
  const { calendars, byId, toggleVisibility } = useCalendars();
  const { openDetails, openQuickCreate, detailsEventId } = useModals();

  const byDay = useMemo(() => groupEventsByDay(events), [events]);
  const next = useMemo(() => nextUpcoming(events, now), [events, now]);
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  const isCurrentWeek = days.some((d) => isToday(d));
  const nowMin = isCurrentWeek ? nowOffsetMinutes(now, START_HOUR, END_HOUR) : null;
  const nowLeft =
    nowMin === null
      ? null
      : `calc(${DAY_COL_W}px + (100% - ${DAY_COL_W}px) * ${nowMin / ((END_HOUR - START_HOUR) * 60)})`;

  const onSlotClick = (start) =>
    openQuickCreate({
      date: start,
      startAt: start,
      endAt: addMinutes(start, user?.defaultArrangementDuration ?? 60),
    });

  const joinHref = next && next.type === 'arrangement' ? meetingHref(next.location) : null;

  return (
    <div className={styles.layout}>
      <Card
        as="section"
        padding="0"
        gap={0}
        className={styles.board}
        aria-label={`Тиждень ${getIsoWeek(date)}, стрічка часу`}
      >
        <div className={styles.scroller}>
          <div className={styles.inner}>
            <div className={styles.head}>
              <div className={styles.headDay}>День</div>
              <div className={styles.hours}>
                {hours.map((h) => (
                  <span key={h} className={styles.hour}>
                    {String(h).padStart(2, '0')}:00
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.rows}>
              {nowLeft !== null ? (
                <div className={styles.now} style={{ left: nowLeft }} aria-hidden="true">
                  <span className={styles.nowLabel}>{formatTime(now)}</span>
                </div>
              ) : null}
              {days.map((d) => (
                <TimelineRow
                  key={d.toISOString()}
                  date={d}
                  events={byDay.get(d.toDateString()) || []}
                  calendarsById={byId}
                  startHour={START_HOUR}
                  endHour={END_HOUR}
                  now={now}
                  selectedEventId={detailsEventId}
                  onEventClick={(e) => openDetails(e.id)}
                  onSlotClick={onSlotClick}
                  onToggleComplete={(e) => toggleCompleted(e.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.swatchMeeting} />
            Зустріч (довжина = тривалість)
          </span>
          <span className={styles.legendItem}>
            <span className={styles.swatchReminder} />
            Нагадування
          </span>
          <span className={styles.legendItem}>
            <span className={styles.swatchTask} />
            Задача
          </span>
          <span className={styles.legendHint}>Тягни край події, щоб змінити тривалість</span>
        </div>
      </Card>

      <aside className={styles.side}>
        <DarkCard
          eyebrow={`Зараз · ${formatDate(now, 'weekday-day')}`}
          value={formatTime(now)}
          valueSize={22}
        >
          {next ? (
            <>
              <span className={styles.nowNext}>Наступна {formatRelative(next.startAt, now)}</span>
              <span className={styles.nowTitle}>{next.title}</span>
            </>
          ) : (
            <span className={styles.nowNext}>Далі цього тижня нічого не заплановано</span>
          )}
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

        <Card padding="16px" gap={6}>
          <span className={styles.cardTitle}>Календарі</span>
          {calendars.map((c) => (
            <Chip
              key={c.id}
              variant="plain"
              label={c.name}
              checked={!c.isHidden}
              onChange={() => toggleVisibility(c.id)}
              color={c.color}
              hint={c.isShared ? 'спільний' : null}
            />
          ))}
        </Card>

        <Card padding="16px" gap={8}>
          <span className={styles.cardTitle}>Показувати</span>
          <div className={styles.typeFilters}>
            {TYPE_OPTIONS.map((t) => {
              const active = !hiddenTypes.includes(t.value);
              return (
                <PillButton
                  key={t.value}
                  size="xs"
                  variant={active ? 'primary' : 'secondary'}
                  aria-pressed={active}
                  onClick={() => toggleType(t.value)}
                >
                  {t.label}
                </PillButton>
              );
            })}
          </div>
        </Card>
      </aside>
    </div>
  );
}
