import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { colorVars } from '../../utils/colors';
import { formatDate, formatTime, isToday } from '../../utils/dates';
import Checkbox from '../ui/Checkbox';
import Badge from '../ui/Badge';
import IconButton from '../ui/IconButton';
import PillButton from '../ui/PillButton';
import styles from './TaskRow.module.css';

const PRIORITY_LABELS = { high: 'високий', medium: 'середній', low: 'низький' };

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
  return parts.join(' · ');
}

function badgeFor(task, calendarColor) {
  if (task.isCompleted) return null;
  if (task.isDeadline) {
    return (
      <Badge variant="tint" color={calendarColor} size="sm">
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
  canToggle = true,
  onOpen = null,
  onSchedule = null,
}) {
  const inputId = `task-${task.id}`;
  const done = Boolean(task.isCompleted);
  const hasDate = Boolean(task.startAt);
  const calendarColor = calendar?.color || 'graphite';
  const calendarName = calendar?.name || 'Календар';

  const canSchedule = !done && !hasDate && Boolean(onSchedule);

  return (
    <div className={cx(styles.row, done && styles.done, !canToggle && styles.readOnly)}>
      <Checkbox
        id={inputId}
        checked={done}
        onChange={() => onToggleComplete(task.id)}
        size={18}
        color="graphite"
        disabled={!canToggle}
      />
      <label htmlFor={inputId} className={styles.label}>
        <span className={styles.name}>{task.title}</span>
        <span className={styles.meta}>
          <span className={styles.dot} style={{ background: colorVars(calendarColor).base }} />
          {buildMeta(task, calendarName, timeFormat)}
        </span>
      </label>
      {badgeFor(task, calendarColor)}
      {canSchedule ? (
        <PillButton variant="secondary" size="xxs" onClick={() => onSchedule(task)}>
          Запланувати
        </PillButton>
      ) : null}
      {onOpen ? (
        <IconButton
          icon="chevron-right"
          label={`Відкрити: ${task.title}`}
          size="xs"
          variant="white"
          iconSize={16}
          className={styles.open}
          onClick={() => onOpen(task.id)}
        />
      ) : null}
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
    isDeadline: PropTypes.bool,
  }).isRequired,
  calendar: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    color: PropTypes.string,
  }),
  timeFormat: PropTypes.oneOf(['24h', '12h']),
  onToggleComplete: PropTypes.func.isRequired,
  canToggle: PropTypes.bool,
  onOpen: PropTypes.func,
  onSchedule: PropTypes.func,
};
