// Дизайн: 02-week-cards.html (.grid: лінії кожні 36px --line-soft), 04-day.html (64px, --line-grid)
import { useRef } from 'react';
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { gridOffsetToTime } from '../../utils/dates';
import styles from './HourGrid.module.css';

/**
 * Контейнер годинної сітки: висота = (endHour − startHour) × hourHeight, фон — горизонтальні лінії.
 * Діти позиціонуються абсолютно (EventBlock/FreeSlot/NowLine). Клік по порожньому місцю → onSlotClick(Date).
 */
export default function HourGrid({
  day,
  startHour = 8,
  endHour = 20,
  hourHeight = 36,
  lineColor = 'var(--line-soft)',
  onSlotClick = null,
  children = null,
  className = '',
  style = {},
}) {
  const ref = useRef(null);
  const height = (endHour - startHour) * hourHeight;

  const handleClick = (e) => {
    if (!onSlotClick || e.target !== ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    onSlotClick(gridOffsetToTime(day, offset, { gridStartHour: startHour, hourHeight }));
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      ref={ref}
      className={cx(styles.grid, onSlotClick && styles.clickable, className)}
      style={{
        height,
        backgroundImage: `repeating-linear-gradient(to bottom, ${lineColor} 0, ${lineColor} 1px, transparent 1px, transparent ${hourHeight}px)`,
        ...style,
      }}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}

HourGrid.propTypes = {
  day: PropTypes.instanceOf(Date).isRequired,
  startHour: PropTypes.number,
  endHour: PropTypes.number,
  hourHeight: PropTypes.number,
  lineColor: PropTypes.string,
  onSlotClick: PropTypes.func,
  children: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.shape({}),
};
