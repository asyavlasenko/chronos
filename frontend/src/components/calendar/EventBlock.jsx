// Дизайн: 02-week-cards.html (.ev/.rem у картках тижня), 04-day.html (великі блоки 64px/год),
// 01-overview.html (блоки 44px/год), 03-week-timeline.html (стрічка), 05-month.html (рядки), 16-mobile.html
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { resolveEventColors } from '../../utils/colors';
import { formatTime, formatTimeRange } from '../../utils/dates';
import { eventShape, calendarShape } from '../../utils/propTypes';
import Icon from '../ui/Icon';
import Checkbox from '../ui/Checkbox';
import { AvatarStack } from '../ui/Avatar';
import styles from './EventBlock.module.css';

/**
 * Подія у сітці або списку. Вигляд за типом (design/README.md):
 *   arrangement — тінт календаря, висота = тривалість; reminder — біла пілюля з дзвіночком;
 *   task — блок --card-muted з рамкою і чекбоксом; holiday — тінт свят.
 * variant: week · day · overview · timeline · list (рядок «час · крапка · назва») · chip (міні-чіп) · mobile.
 * top/height — абсолютне позиціонування в HourGrid (для week/day/overview/timeline).
 */
export default function EventBlock({
  event,
  calendar = null,
  variant = 'week',
  top = null,
  height = null,
  left = null,
  width = null,
  selected = false,
  meta = null,
  description = null,
  author = null,
  participants = null,
  action = null,
  onClick = null,
  onToggleComplete = null,
  className = '',
}) {
  const colors = resolveEventColors(event, calendar);
  const isTask = event.type === 'task';
  const isReminder = event.type === 'reminder';
  const isHoliday = event.type === 'holiday';
  const positioned = top !== null;
  const posStyle = positioned
    ? {
        top,
        height: height ?? undefined,
        left: left ?? undefined,
        width: width ?? undefined,
        right: left !== null ? 'auto' : undefined,
      }
    : {};

  const timeText =
    event.allDay || !event.startAt ? '' : formatTimeRange(event.startAt, event.endAt);
  const metaText = meta ?? timeText;

  const base = cx(
    styles.block,
    styles[variant],
    positioned && styles.abs,
    selected && styles.selected,
    event.isCompleted && styles.done,
    className,
  );

  // --- Плоскі рядки для місяця: нагадування / задача без фону ---
  if (variant === 'list' && (isTask || isReminder)) {
    return (
      <span
        className={cx(styles.block, styles.listRow, event.isCompleted && styles.done, className)}
      >
        {isTask ? (
          <Checkbox
            checked={Boolean(event.isCompleted)}
            onChange={() => onToggleComplete?.(event)}
            size={11}
            label={`Виконано: ${event.title}`}
            className={styles.listBox}
          />
        ) : (
          <Icon name="bell" size={9} strokeWidth={2.6} className={styles.listIcon} />
        )}
        {!event.allDay && event.startAt ? (
          <span className={styles.listTime}>{formatTime(event.startAt)}</span>
        ) : null}
        <button type="button" className={styles.listTitleBtn} onClick={() => onClick?.(event)}>
          {event.title}
        </button>
      </span>
    );
  }

  // --- Задача: чекбокс + назва ---
  if (isTask) {
    return (
      <div className={cx(base, styles.task)} style={posStyle}>
        <Checkbox
          checked={Boolean(event.isCompleted)}
          onChange={() => onToggleComplete?.(event)}
          size={variant === 'week' || variant === 'list' || variant === 'chip' ? 13 : 18}
          label={`Виконано: ${event.title}`}
          className={styles.taskBox}
        />
        <button type="button" className={styles.taskBody} onClick={() => onClick?.(event)}>
          <span className={styles.title}>{event.title}</span>
          {variant !== 'chip' && variant !== 'list' ? (
            <span className={styles.meta}>
              {meta ?? `задача${timeText ? ` · ${formatTime(event.startAt)}` : ''}`}
            </span>
          ) : null}
        </button>
        {action}
      </div>
    );
  }

  // --- Нагадування: біла пілюля з дзвіночком ---
  if (isReminder) {
    return (
      <button
        type="button"
        className={cx(base, styles.reminder)}
        style={posStyle}
        onClick={() => onClick?.(event)}
      >
        <Icon name="bell" size={variant === 'week' ? 10 : 12} strokeWidth={2.4} />
        {variant === 'timeline' || variant === 'list' ? (
          <span className={styles.remTime}>{formatTime(event.startAt)}</span>
        ) : null}
        <span className={styles.remTitle}>{event.title}</span>
      </button>
    );
  }

  // --- Зустріч / свято: тінт-блок ---
  const style = { ...posStyle, background: colors.tint, color: colors.text };
  if (variant === 'list') {
    return (
      <button type="button" className={cx(base, styles.listRow)} onClick={() => onClick?.(event)}>
        {!event.allDay && event.startAt ? (
          <span className={styles.listTime}>{formatTime(event.startAt)}</span>
        ) : null}
        <span className={styles.listDot} style={{ background: colors.base }} />
        <span className={styles.listTitle}>{event.title}</span>
      </button>
    );
  }
  if (variant === 'chip') {
    return (
      <button
        type="button"
        className={cx(base, styles.chip)}
        style={{ background: colors.tint, color: colors.text }}
        onClick={() => onClick?.(event)}
      >
        {!event.allDay && event.startAt ? `${formatTime(event.startAt)} ` : ''}
        {event.title}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cx(base, isHoliday && styles.holiday)}
      style={style}
      onClick={() => onClick?.(event)}
    >
      <span className={styles.main}>
        <span className={styles.title}>{event.title}</span>
        {metaText ? <span className={styles.meta}>{metaText}</span> : null}
        {description && variant === 'day' ? (
          <span className={styles.desc}>{description}</span>
        ) : null}
      </span>
      {author ? (
        <span className={styles.author} style={{ background: colors.base }} title={author.name}>
          {author.initials}
        </span>
      ) : null}
      {participants && participants.length ? (
        <AvatarStack items={participants} size={24} ring={colors.tint} className={styles.people} />
      ) : null}
      {action ? <span className={styles.action}>{action}</span> : null}
    </button>
  );
}

EventBlock.propTypes = {
  event: eventShape.isRequired,
  calendar: calendarShape,
  variant: PropTypes.oneOf(['week', 'day', 'overview', 'timeline', 'list', 'chip', 'mobile']),
  top: PropTypes.number,
  height: PropTypes.number,
  left: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  selected: PropTypes.bool,
  meta: PropTypes.node,
  description: PropTypes.node,
  author: PropTypes.shape({
    initials: PropTypes.string.isRequired,
    name: PropTypes.string,
    color: PropTypes.string,
  }),
  participants: PropTypes.arrayOf(
    PropTypes.shape({
      initials: PropTypes.string.isRequired,
      color: PropTypes.string,
      name: PropTypes.string,
    }),
  ),
  action: PropTypes.node,
  onClick: PropTypes.func,
  onToggleComplete: PropTypes.func,
  className: PropTypes.string,
};
