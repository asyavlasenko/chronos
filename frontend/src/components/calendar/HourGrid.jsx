import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { formatDate, gridOffsetToTime } from '../../utils/dates';
import styles from './HourGrid.module.css';

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
  const height = (endHour - startHour) * hourHeight;

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = e.detail === 0 ? 0 : Math.min(Math.max(e.clientY - rect.top, 0), height - 1);
    onSlotClick(gridOffsetToTime(day, offset, { gridStartHour: startHour, hourHeight }));
  };

  return (
    <div
      className={cx(styles.grid, className)}
      style={{
        height,
        backgroundImage: `repeating-linear-gradient(to bottom, ${lineColor} 0, ${lineColor} 1px, transparent 1px, transparent ${hourHeight}px)`,
        ...style,
      }}
    >
      {onSlotClick ? (
        <button
          type="button"
          tabIndex={-1}
          className={styles.slots}
          aria-label={`Створити подію: ${formatDate(day, 'weekday-long')}`}
          onClick={handleClick}
        />
      ) : null}
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
