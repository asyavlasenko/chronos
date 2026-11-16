import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { formatTimeRange } from '../../utils/dates';
import styles from './FreeSlot.module.css';

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
