// Дизайн: 02-week-cards.html (пілюлі День · Тиждень · Місяць · Рік, стрілки, заголовок, «Сьогодні»,
// праворуч Картки | Стрічка часу), 04-day.html (праворуч — смужка днів тижня)
import PropTypes from 'prop-types';
import useViewDate from '../../hooks/useViewDate';
import useAuth from '../../hooks/useAuth';
import {
  addDays,
  addMonths,
  addYears,
  formatDate,
  formatWeekRange,
  getIsoWeek,
  getWeekDays,
} from '../../utils/dates';
import SegmentedControl from '../ui/SegmentedControl';
import IconButton from '../ui/IconButton';
import PillButton from '../ui/PillButton';
import DayStrip from '../calendar/DayStrip';
import styles from './CalendarToolbar.module.css';

const PREV_LABEL = {
  day: 'Попередній день',
  week: 'Попередній тиждень',
  month: 'Попередній місяць',
  year: 'Попередній рік',
};
const NEXT_LABEL = {
  day: 'Наступний день',
  week: 'Наступний тиждень',
  month: 'Наступний місяць',
  year: 'Наступний рік',
};

function shift(date, view, dir) {
  if (view === 'day') return addDays(date, dir);
  if (view === 'week') return addDays(date, 7 * dir);
  if (view === 'month') return addMonths(date, dir);
  return addYears(date, dir);
}

export default function CalendarToolbar({ view, mode = 'cards' }) {
  const { date, setDate, dateSearch } = useViewDate();
  const { user } = useAuth();
  const weekStartsOn = user?.weekStartsOn ?? 1;
  const showWeek = user?.showWeekNumbers ?? true;
  const week = getIsoWeek(date);

  let title;
  if (view === 'day') title = formatDate(date, 'weekday-long');
  else if (view === 'week') title = formatWeekRange(date, weekStartsOn);
  else if (view === 'month') title = formatDate(date, 'month-year');
  else title = String(date.getFullYear());

  const weekSuffix = showWeek && (view === 'day' || view === 'week') ? ` · тиждень ${week}` : '';

  const views = [
    { value: 'day', label: 'День', to: `/calendar/day${dateSearch}` },
    { value: 'week', label: 'Тиждень', to: `/calendar/week${dateSearch}` },
    { value: 'month', label: 'Місяць', to: `/calendar/month${dateSearch}` },
    { value: 'year', label: 'Рік', to: `/calendar/year${dateSearch}` },
  ];

  return (
    <div className={styles.toolbar}>
      <SegmentedControl options={views} value={view} label="Вигляд" />
      <IconButton
        icon="chevron-left"
        label={PREV_LABEL[view]}
        onClick={() => setDate(shift(date, view, -1))}
      />
      <h1 className={styles.title}>
        {title}
        {weekSuffix ? <span className={styles.titleMuted}>{weekSuffix}</span> : null}
      </h1>
      <IconButton
        icon="chevron-right"
        label={NEXT_LABEL[view]}
        onClick={() => setDate(shift(date, view, 1))}
      />
      <PillButton variant="white" size="sm" onClick={() => setDate(new Date())}>
        Сьогодні
      </PillButton>
      <span className={styles.spacer} />
      {view === 'week' ? (
        <SegmentedControl
          size="sm"
          label="Подання тижня"
          value={mode}
          options={[
            { value: 'cards', label: 'Картки', to: `/calendar/week${dateSearch}` },
            {
              value: 'timeline',
              label: 'Стрічка часу',
              to: `/calendar/week/timeline${dateSearch}`,
            },
          ]}
        />
      ) : null}
      {view === 'day' ? (
        <DayStrip days={getWeekDays(date, weekStartsOn)} selected={date} onSelect={setDate} />
      ) : null}
    </div>
  );
}

CalendarToolbar.propTypes = {
  view: PropTypes.oneOf(['day', 'week', 'month', 'year']).isRequired,
  mode: PropTypes.oneOf(['cards', 'timeline']),
};
