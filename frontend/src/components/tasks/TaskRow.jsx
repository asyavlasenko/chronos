// Дизайн: design/screens/07-tasks.html (.t / .n / .m / .d / .p / .done)
// Рядок задачі: чекбокс 18 · назва + мета (календар · час | дата | дедлайн · ~оцінка) · бейдж пріоритету ·
// праворуч «Відкрити» (задача з датою) або «Запланувати» (без дати). Виконана — сіра, закреслена, без бейджа.
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { colorVars } from '../../utils/colors';
import { formatDate, formatDuration, formatTime, isToday } from '../../utils/dates';
import Checkbox from '../ui/Checkbox';
import Badge from '../ui/Badge';
import IconButton from '../ui/IconButton';
import PillButton from '../ui/PillButton';
import styles from './TaskRow.module.css';

const PRIORITY_LABELS = { high: 'високий', medium: 'середній', low: 'низький' };

/** «Навчання · 17:00 · ~2 год», «Робота · Чт, 5 лист.», «Навчання · дедлайн Нд, 8 лист.», «… · виконано Вт, 3 лист.» */
function buildMeta(task, calendarName, timeFormat) {
  const parts = [calendarName];
  if (task.isCompleted) {
    const when = task.completedAt || task.startAt;
    if (when) parts.push(`виконано ${formatDate(when, 'short')}`);
    return parts.join(' · ');
  }
  if (task.startAt && task.isDeadline) {
    parts.push(`дедлайн ${formatDate(task.startAt, 'short')}`);
  } else if (task.startAt && isToday(task.startAt)) {
    if (!task.allDay) parts.push(formatTime(task.startAt, timeFormat));
  } else if (task.startAt) {
    parts.push(formatDate(task.startAt, 'short'));
  }
  if (task.estimateMinutes) parts.push(`~${formatDuration(task.estimateMinutes)}`);
  if (task.note) parts.push(task.note);
  return parts.join(' · ');
}

/** Бейдж праворуч від назви: «дедлайн» (тінт календаря навчання) або пріоритет; у виконаних — нічого. */
function badgeFor(task) {
  if (task.isCompleted) return null;
  if (task.isDeadline) {
    return (
      <Badge variant="tint" color="purple" size="sm">
        дедлайн
      </Badge>
    );
  }
  if (task.priority === 'high') {
    return (
      <Badge variant="danger" size="sm">
        {PRIORITY_LABELS.high}
      </Badge>
    );
  }
  if (task.priority === 'low') {
    return (
      <Badge variant="muted" size="sm" className={styles.low}>
        {PRIORITY_LABELS.low}
      </Badge>
    );
  }
  return (
    <Badge variant="muted" size="sm">
      {PRIORITY_LABELS.medium}
    </Badge>
  );
}

export default function TaskRow({
  task,
  calendar = null,
  timeFormat = '24h',
  onToggleComplete,
  onOpen = null,
  onSchedule = null,
}) {
  const inputId = `task-${task.id}`;
  const done = Boolean(task.isCompleted);
  const hasDate = Boolean(task.startAt);
  const color = colorVars(calendar?.color || 'graphite');
  const calendarName = calendar?.name || 'Календар';

  let action = null;
  if (!done && hasDate && onOpen) {
    action = (
      <IconButton
        icon="chevron-right"
        label="Відкрити"
        size="xs"
        variant="white"
        iconSize={16}
        className={styles.open}
        onClick={() => onOpen(task.id)}
      />
    );
  } else if (!done && !hasDate && onSchedule) {
    action = (
      <PillButton variant="secondary" size="xxs" onClick={() => onSchedule(task)}>
        Запланувати
      </PillButton>
    );
  }

  return (
    <div className={cx(styles.row, done && styles.done)}>
      <Checkbox
        id={inputId}
        checked={done}
        onChange={() => onToggleComplete(task.id)}
        size={18}
        color="graphite"
      />
      <label htmlFor={inputId} className={styles.label}>
        <span className={styles.name}>{task.title}</span>
        <span className={styles.meta}>
          <span className={styles.dot} style={{ background: color.base }} />
          {buildMeta(task, calendarName, timeFormat)}
        </span>
      </label>
      {badgeFor(task)}
      {action}
    </div>
  );
}

const dateType = PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]);

TaskRow.propTypes = {
  task: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    calendar: PropTypes.string,
    startAt: dateType,
    allDay: PropTypes.bool,
    isCompleted: PropTypes.bool,
    completedAt: dateType,
    priority: PropTypes.oneOf(['low', 'medium', 'high']),
    estimateMinutes: PropTypes.number,
    isDeadline: PropTypes.bool,
    note: PropTypes.string,
  }).isRequired,
  calendar: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    color: PropTypes.string,
  }),
  timeFormat: PropTypes.oneOf(['24h', '12h']),
  onToggleComplete: PropTypes.func.isRequired,
  onOpen: PropTypes.func,
  onSchedule: PropTypes.func,
};
