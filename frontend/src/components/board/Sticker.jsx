import { memo } from 'react';
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { colorVars, resolveEventColorKey, stickerColors } from '../../utils/colors';
import { formatTime, formatTimeRange } from '../../utils/dates';
import { STICKER_HEIGHT, stickerTilt } from '../../utils/board';
import { calendarShape, eventShape } from '../../utils/propTypes';
import Checkbox from '../ui/Checkbox';
import Icon from '../ui/Icon';
import styles from './Sticker.module.css';

function stickerTimeText(event, timeFormat) {
  if (event.allDay || !event.startAt) return '';
  if (event.type === 'arrangement') {
    return formatTimeRange(event.startAt, event.endAt, timeFormat);
  }
  return formatTime(event.startAt, timeFormat);
}

function Sticker({
  event,
  calendar = null,
  left = null,
  top = null,
  width = null,
  timeFormat = '24h',
  canComplete = true,
  onOpen,
  onToggleComplete = null,
  className = '',
}) {
  const isTask = event.type === 'task';
  const isReminder = event.type === 'reminder';
  const isHoliday = event.type === 'holiday';
  const isPlaced = left !== null;
  const colors = isHoliday ? colorVars('holidays') : stickerColors(event, calendar);
  const timeText = stickerTimeText(event, timeFormat);
  const placement = isPlaced ? { left, top, width, height: STICKER_HEIGHT } : {};

  return (
    <div
      className={cx(
        styles.sticker,
        isPlaced ? styles.placed : styles.compact,
        isTask && styles.task,
        event.isCompleted && styles.done,
        className,
      )}
      style={{
        ...placement,
        '--sticker-base': colors.base,
        '--sticker-tint': colors.tint,
        color: colors.text,
        '--sticker-tilt': `${stickerTilt(event.id)}deg`,
      }}
    >
      {isTask ? (
        <Checkbox
          checked={Boolean(event.isCompleted)}
          onChange={() => onToggleComplete?.(event)}
          onClick={(clickEvent) => clickEvent.stopPropagation()}
          size={14}
          color={resolveEventColorKey(event, calendar)}
          label={`Виконано: ${event.title}`}
          disabled={!canComplete}
          className={styles.check}
        />
      ) : null}
      <button
        type="button"
        className={styles.open}
        title={event.title}
        onClick={() => onOpen(event)}
      >
        <span className={styles.title}>{event.title}</span>
        {timeText ? (
          <span className={styles.time}>
            {isReminder ? <Icon name="bell" size={11} strokeWidth={2.4} /> : null}
            {timeText}
          </span>
        ) : null}
      </button>
    </div>
  );
}

Sticker.propTypes = {
  event: eventShape.isRequired,
  calendar: calendarShape,
  left: PropTypes.number,
  top: PropTypes.number,
  width: PropTypes.number,
  timeFormat: PropTypes.oneOf(['24h', '12h']),
  canComplete: PropTypes.bool,
  onOpen: PropTypes.func.isRequired,
  onToggleComplete: PropTypes.func,
  className: PropTypes.string,
};

export default memo(Sticker);
