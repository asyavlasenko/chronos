// Дизайн: design/screens/08-calendars.html
// Рядок календаря: чекбокс «показувати», квадратик кольору, назва + опис, аватари учасників (спільний),
// бейджі (головний / спільний / прихований / тільки читання), кількість подій. Клік по рядку — вибрати календар.
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { colorVars } from '../../utils/colors';
import { calendarShape } from '../../utils/propTypes';
import Checkbox from '../ui/Checkbox';
import Badge from '../ui/Badge';
import Icon from '../ui/Icon';
import { AvatarStack } from '../ui/Avatar';
import styles from './CalendarRow.module.css';

function badgesFor(calendar) {
  const list = [];
  if (calendar.isMain) list.push('головний · не видаляється');
  if (calendar.isShared && calendar.isHidden) list.push('спільний · прихований');
  else if (calendar.isShared) list.push('спільний');
  else if (calendar.isHidden) list.push('прихований');
  return list;
}

export default function CalendarRow({
  calendar,
  members = [],
  selected = false,
  onSelect,
  onToggleVisibility,
}) {
  const { isMain, isHidden, isReadOnly } = calendar;
  return (
    <div
      className={cx(styles.cal, selected && styles.selected, isHidden && styles.hidden)}
      aria-current={selected ? 'true' : undefined}
    >
      <Checkbox
        checked={!isHidden}
        onChange={() => onToggleVisibility(calendar.id)}
        color={calendar.color}
        label={`Показувати ${calendar.name}`}
        disabled={isMain}
      />
      <button type="button" className={styles.body} onClick={() => onSelect(calendar.id)}>
        <span className={styles.sw} style={{ background: colorVars(calendar.color).base }} />
        <span className={styles.text}>
          <span className={styles.nm}>{calendar.name}</span>
          {calendar.description ? <span className={styles.ds}>{calendar.description}</span> : null}
        </span>
        {members.length > 0 ? <AvatarStack items={members} size={22} /> : null}
        {badgesFor(calendar).map((label) => (
          <Badge key={label} variant="muted" size="sm">
            {label}
          </Badge>
        ))}
        {isReadOnly ? (
          <Badge variant="muted" size="sm" className={styles.lockBadge}>
            <Icon name="lock" size={10} strokeWidth={2.4} />
            тільки читання
          </Badge>
        ) : null}
        <span className={styles.count}>{calendar.eventsCount ?? 0}</span>
      </button>
    </div>
  );
}

CalendarRow.propTypes = {
  calendar: calendarShape.isRequired,
  members: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      initials: PropTypes.string.isRequired,
      color: PropTypes.string,
      name: PropTypes.string,
    }),
  ),
  selected: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onToggleVisibility: PropTypes.func.isRequired,
};
