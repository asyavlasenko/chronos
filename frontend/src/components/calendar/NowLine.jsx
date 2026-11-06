// Дизайн: 02-week-cards.html (2px --accent через колонку сьогодні), 04-day.html і 01 (мітка часу зліва)
import PropTypes from 'prop-types';
import { formatTime } from '../../utils/dates';
import styles from './NowLine.module.css';

/** Лінія «зараз». top — зсув у px усередині сітки; showLabel — мітка часу зліва (labelLeft px). */
export default function NowLine({
  top,
  now = new Date(),
  showLabel = false,
  left = 0,
  right = 0,
  labelLeft = -44,
}) {
  return (
    <div className={styles.line} style={{ top, left, right }} aria-hidden="true">
      {showLabel ? (
        <span className={styles.label} style={{ left: labelLeft }}>
          {formatTime(now)}
        </span>
      ) : null}
    </div>
  );
}

NowLine.propTypes = {
  top: PropTypes.number.isRequired,
  now: PropTypes.instanceOf(Date),
  showLabel: PropTypes.bool,
  left: PropTypes.number,
  right: PropTypes.number,
  labelLeft: PropTypes.number,
};
