// Дизайн: design/screens/06-year.html
// Календар · Рік: легенда праворуч (тулбар спільний — у CalendarLayout), 12 міні-місяців YearMiniMonth,
// бічна панель: темний підсумок року, «Свята України · рік» (джерело Nager.Date).
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import useViewDate from '../hooks/useViewDate';
import useAuth from '../hooks/useAuth';
import useEvents from '../hooks/useEvents';
import useCalendars from '../hooks/useCalendars';
import { formatDate, getViewRange, toDate, toDateParam, MONTHS_NOMINATIVE } from '../utils/dates';
import { plural, pluralEvents } from '../utils/text';
import cx from '../utils/cx';
import Card from '../components/ui/Card';
import DarkCard from '../components/ui/DarkCard';
import Icon from '../components/ui/Icon';
import YearMiniMonth from '../components/calendar/YearMiniMonth';
import styles from './YearPage.module.css';

// Яка позначка дня переважає, якщо в один день кілька подій
const MARK_PRIORITY = { event: 1, holiday: 2, deadline: 3 };

function markOf(event) {
  if (event.type === 'holiday') return 'holiday';
  if (event.type === 'task' && event.isDeadline) return 'deadline';
  return 'event';
}

export default function YearPage() {
  const { date } = useViewDate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const weekStartsOn = user?.weekStartsOn ?? 1;
  const year = date.getFullYear();

  const { from, to } = useMemo(() => getViewRange('year', date), [date]);
  const { events, holidayEvents } = useEvents({ from, to, q });
  const { byId } = useCalendars();

  // Позначки днів для міні-місяців, кількість подій по місяцях (без свят) і загалом за рік
  const { marks, perMonth, total } = useMemo(() => {
    const map = new Map();
    const counts = Array(12).fill(0);
    let sum = 0;
    events.forEach((e) => {
      const d = toDate(e.startAt);
      const key = toDateParam(d);
      const mark = markOf(e);
      if (!map.has(key) || MARK_PRIORITY[mark] > MARK_PRIORITY[map.get(key)]) map.set(key, mark);
      if (e.type !== 'holiday') {
        counts[d.getMonth()] += 1;
        sum += 1;
      }
    });
    return { marks: map, perMonth: counts, total: sum };
  }, [events]);

  const busiest = perMonth.reduce((best, n, i) => (n > perMonth[best] ? i : best), 0);
  const yearHolidays = useMemo(
    () =>
      holidayEvents
        .filter((h) => toDate(h.startAt).getFullYear() === year)
        .sort((a, b) => toDate(a.startAt) - toDate(b.startAt)),
    [holidayEvents, year],
  );
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => new Date(year, i, 1)), [year]);
  const now = new Date();
  const holidaysTitle = byId.holidays?.name || 'Свята';

  const busiestText =
    total > 0
      ? `Найзавантаженіший місяць — ${MONTHS_NOMINATIVE[busiest].toLowerCase()} · ${pluralEvents(perMonth[busiest])}`
      : 'Подій цього року ще немає';

  return (
    <>
      <div className={styles.legend} aria-label="Позначки">
        <span className={styles.legendItem}>
          <span className={cx(styles.dot, styles.dotEvent)} />
          день з подіями
        </span>
        <span className={styles.legendItem}>
          <span className={cx(styles.dot, styles.dotHoliday)} />
          свято
        </span>
        <span className={styles.legendItem}>
          <span className={cx(styles.dot, styles.dotDeadline)} />
          дедлайн
        </span>
      </div>

      <div className={styles.layout}>
        <div className={styles.months}>
          {months.map((m, i) => (
            <YearMiniMonth
              key={toDateParam(m)}
              month={m}
              eventsCount={perMonth[i]}
              marks={marks}
              weekStartsOn={weekStartsOn}
              current={year === now.getFullYear() && i === now.getMonth()}
            />
          ))}
        </div>

        <aside className={styles.side} aria-label="Підсумок року">
          <DarkCard
            eyebrow={String(year)}
            valueSize={28}
            value={
              <>
                {total}{' '}
                <span className={styles.unit}>{plural(total, ['подія', 'події', 'подій'])}</span>
              </>
            }
            meta={busiestText}
          />

          <Card
            title={
              <span className={styles.cardTitle}>
                {holidaysTitle} · {year}
              </span>
            }
            action={
              <span className={styles.lock} role="img" aria-label="Тільки читання">
                <Icon name="lock" size={13} />
              </span>
            }
          >
            {yearHolidays.map((h) => (
              <div key={h.id} className={styles.holiday}>
                <span className={styles.holidayName}>{h.title}</span>
                <span className={styles.holidayDate}>
                  {formatDate(h.startAt, 'day-month-short')}
                </span>
              </div>
            ))}
            {yearHolidays.length === 0 ? (
              <span className={styles.note}>Свят за цей рік ще немає</span>
            ) : null}
            <span className={styles.note}>
              Джерело: Nager.Date · оновлено {formatDate(now, 'day-month-short')}
            </span>
          </Card>
        </aside>
      </div>
    </>
  );
}
