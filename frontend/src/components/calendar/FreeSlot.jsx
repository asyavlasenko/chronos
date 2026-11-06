// Дизайн: 02-week-cards.html (у колонці сьогодні: «+ 16:00 – 17:00 вільно», пунктир --accent-dashed),
// 04-day.html / 01-overview.html («Вільно 16:00 – 17:00 · + Додати», пунктир #D1D5DB)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { formatTimeRange } from '../../utils/dates';
import styles from './FreeSlot.module.css';

/** variant: week (компактний синій) · day (12px радіус, 13px) · overview (10px радіус, 12px) · list (без позиціонування, h40). */
export default function FreeSlot({
  start,
  end,
  onClick,
  variant = 'day',
  top = null,
  height = null,
  label = null,
}) {
  const range = formatTimeRange(start, end);
  const style = top !== null ? { top, height } : undefined;
  const text = label || (variant === 'week' ? `+ ${range} вільно` : `Вільно ${range} · `);
  return (
    <button
      type="button"
      className={cx(styles.slot, styles[variant], top !== null && styles.abs)}
      style={style}
      onClick={() => onClick(start, end)}
    >
      {text}
      {variant !== 'week' ? <span className={styles.add}>+ Додати</span> : null}
    </button>
  );
}

FreeSlot.propTypes = {
  start: PropTypes.instanceOf(Date).isRequired,
  end: PropTypes.instanceOf(Date).isRequired,
  onClick: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['week', 'day', 'overview', 'list']),
  top: PropTypes.number,
  height: PropTypes.number,
  label: PropTypes.string,
};
