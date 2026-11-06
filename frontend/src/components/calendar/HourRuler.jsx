// Дизайн: 02-week-cards.html (колонка 44px, 10px), 04-day.html (52px, 11px), 01-overview.html (44px, 44px/год)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import styles from './HourRuler.module.css';

/** Колонка підписів годин. topOffset — висота шапки над сіткою (щоб вирівняти з картками днів). */
export default function HourRuler({
  startHour = 8,
  endHour = 20,
  hourHeight = 36,
  width = 44,
  fontSize = 10,
  topOffset = 0,
  className = '',
}) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  return (
    <div
      className={cx(styles.ruler, className)}
      style={{ flex: `0 0 ${width}px`, width }}
      aria-hidden="true"
    >
      {topOffset ? <div style={{ height: topOffset }} /> : null}
      <div className={styles.labels}>
        {hours.map((h) => (
          <span key={h} className={styles.label} style={{ height: hourHeight, fontSize }}>
            {String(h).padStart(2, '0')}:00
          </span>
        ))}
      </div>
    </div>
  );
}

HourRuler.propTypes = {
  startHour: PropTypes.number,
  endHour: PropTypes.number,
  hourHeight: PropTypes.number,
  width: PropTypes.number,
  fontSize: PropTypes.number,
  topOffset: PropTypes.number,
  className: PropTypes.string,
};
