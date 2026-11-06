// Дизайн: design/screens/05-month.html
// Календар · Місяць: підсумок «N подій · N задач · N дедлайнів» праворуч (тулбар спільний — у CalendarLayout),
// сітка MonthGrid, бічна панель: темний підсумок місяця, «Свята цього сезону», список календарів.
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useViewDate from '../hooks/useViewDate';
import useAuth from '../hooks/useAuth';
import useEvents from '../hooks/useEvents';
import useCalendars from '../hooks/useCalendars';
import useModals from '../hooks/useModals';
import { groupEventsByDay, weekSummary } from '../utils/eventStats';
import {
  addDays,
  getMonthGridDays,
  startOfMonth,
  toDate,
  weekdayIndex,
  MONTHS_ABBR_UPPER,
  MONTHS_NOMINATIVE,
  WEEKDAYS_LONG,
} from '../utils/dates';
import {
  plural,
  pluralDeadlines,
  pluralEvents,
  pluralInvites,
  pluralReminders,
  pluralTasks,
} from '../utils/text';
import cx from '../utils/cx';
import Card from '../components/ui/Card';
import DarkCard from '../components/ui/DarkCard';
import Chip from '../components/ui/Chip';
import Icon from '../components/ui/Icon';
import MonthGrid from '../components/calendar/MonthGrid';
import styles from './MonthPage.module.css';

// Назва країни для підпису «Країна: …» (user.country — ISO 3166-1 alpha-2, як у Nager.Date)
const COUNTRY_NAMES = { UA: 'Україна' };

const isSameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export default function MonthPage() {
  const { date } = useViewDate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const weekStartsOn = user?.weekStartsOn ?? 1;

  // Сітка показує й «хвости» сусідніх місяців, тому події беремо за весь діапазон сітки
  const { from, to } = useMemo(() => {
    const days = getMonthGridDays(date, weekStartsOn);
    return { from: days[0], to: addDays(days[days.length - 1], 1) };
  }, [date, weekStartsOn]);
  const { events, holidayEvents, pendingInvites, toggleCompleted } = useEvents({ from, to, q });
  const { calendars, byId, toggleVisibility } = useCalendars();
  const { openDetails } = useModals();

  const byDay = useMemo(() => groupEventsByDay(events), [events]);
  const monthEvents = useMemo(
    () => events.filter((e) => isSameMonth(toDate(e.startAt), date)),
    [events, date],
  );
  const summary = useMemo(() => weekSummary(monthEvents), [monthEvents]);
  const eventsCount = summary.arrangements + summary.reminders;

  // Два найближчі свята від початку місяця (перше — підсвічене)
  const seasonHolidays = useMemo(() => {
    const start = startOfMonth(date);
    return holidayEvents
      .filter((h) => toDate(h.startAt) >= start)
      .sort((a, b) => toDate(a.startAt) - toDate(b.startAt))
      .slice(0, 2);
  }, [holidayEvents, date]);

  const metaParts = [pluralDeadlines(summary.deadlines), pluralReminders(summary.reminders)];
  if (pendingInvites.length > 0) {
    const n = pendingInvites.length;
    metaParts.push(`${pluralInvites(n)} ${n === 1 ? 'чекає' : 'чекають'}`);
  }
  const countryName = COUNTRY_NAMES[user?.country] || user?.country || '—';

  return (
    <>
      <div className={styles.summary}>
        {pluralEvents(eventsCount)} · {pluralTasks(summary.tasksTotal)} ·{' '}
        {pluralDeadlines(summary.deadlines)}
      </div>

      <div className={styles.layout}>
        <div className={styles.main}>
          <MonthGrid
            month={date}
            weekStartsOn={weekStartsOn}
            eventsByDay={byDay}
            calendarsById={byId}
            onEventClick={(e) => openDetails(e.id)}
            onToggleComplete={(e) => toggleCompleted(e.id)}
          />
        </div>

        <aside className={styles.side} aria-label="Підсумок місяця">
          <DarkCard
            eyebrow={MONTHS_NOMINATIVE[date.getMonth()]}
            valueSize={28}
            value={
              <>
                {eventsCount}{' '}
                <span className={styles.unit}>
                  {plural(eventsCount, ['подія', 'події', 'подій'])} ·{' '}
                  {pluralTasks(summary.tasksTotal)}
                </span>
              </>
            }
            meta={metaParts.join(' · ')}
          />

          <Card
            title={<span className={styles.cardTitle}>Свята цього сезону</span>}
            action={
              <span className={styles.lock} role="img" aria-label="Тільки читання">
                <Icon name="lock" size={13} />
              </span>
            }
          >
            {seasonHolidays.map((h, i) => {
              const d = toDate(h.startAt);
              return (
                <div key={h.id} className={styles.holiday}>
                  <span className={cx(styles.holidayDate, i === 0 && styles.holidayNext)}>
                    {MONTHS_ABBR_UPPER[d.getMonth()]}
                    <span className={styles.holidayDay}>{d.getDate()}</span>
                  </span>
                  <span className={styles.holidayText}>
                    <span className={styles.holidayName}>{h.title}</span>
                    <span className={styles.holidayMeta}>
                      {WEEKDAYS_LONG[weekdayIndex(d)].toLowerCase()} · вихідний
                    </span>
                  </span>
                </div>
              );
            })}
            {seasonHolidays.length === 0 ? (
              <span className={styles.note}>Найближчих свят немає</span>
            ) : null}
            <span className={styles.note}>
              Країна: {countryName} ·{' '}
              <Link to="/profile" className={styles.link}>
                змінити в профілі
              </Link>
            </span>
          </Card>

          <Card
            title={<span className={styles.cardTitle}>Календарі</span>}
            action={
              <Link to="/calendars" className={styles.link}>
                Керувати
              </Link>
            }
          >
            <div className={styles.calList}>
              {calendars.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  checked={!c.isHidden}
                  onChange={() => toggleVisibility(c.id)}
                  color={c.color}
                  variant="plain"
                  hint={c.isShared ? 'спільний' : undefined}
                />
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
