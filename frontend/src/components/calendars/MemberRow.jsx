// Дизайн: design/screens/08-calendars.html (variant 'full': аватар 28, «Ім'я · email» в один рядок, селект ролі, «Прибрати»),
// design/screens/09-shared-calendar.html (variant 'compact': аватар 30, ім'я / email у два рядки, селект ролі без «Прибрати»).
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { memberShape } from '../../utils/propTypes';
import Avatar from '../ui/Avatar';
import Select from '../ui/Select';
import Icon from '../ui/Icon';
import { ROLE_LABELS, ROLE_OPTIONS } from './members';
import styles from './MemberRow.module.css';

/**
 * Учасник календаря. canManage — поточний користувач є власником і може міняти ролі/прибирати.
 * Власник завжди показується як «усі права»; для себе селект не показуємо.
 */
export default function MemberRow({
  member,
  initials,
  color = 'graphite',
  isMe = false,
  canManage = false,
  variant = 'full',
  onRoleChange = null,
  onRemove = null,
  as: Tag = 'div',
}) {
  const compact = variant === 'compact';
  const roleLabel = ROLE_LABELS[member.role] || member.role;
  const displayName = isMe ? 'Ти' : member.name || member.email || '';
  const secondary = isMe ? roleLabel : member.email || roleLabel;
  const isOwner = member.role === 'owner';
  const editable = canManage && !isMe && !isOwner;

  let control = null;
  if (isOwner) {
    control = <span className={styles.rights}>усі права</span>;
  } else if (editable) {
    control = (
      <>
        <Select
          size="xs"
          options={ROLE_OPTIONS}
          value={member.role}
          onChange={(role) => onRoleChange?.(member, role)}
          aria-label={`Роль учасника ${displayName}`}
        />
        {!compact ? (
          <button
            type="button"
            className={styles.remove}
            aria-label={`Прибрати ${displayName}`}
            onClick={() => onRemove?.(member)}
          >
            <Icon name="x" size={14} strokeWidth={2.4} />
          </button>
        ) : null}
      </>
    );
  } else if (!isMe) {
    control = <span className={styles.rights}>{roleLabel}</span>;
  }

  return (
    <Tag className={cx(styles.row, compact && styles.compact)}>
      <Avatar initials={initials} color={color} size={compact ? 30 : 28} title={displayName} />
      {compact ? (
        <span className={styles.textCol}>
          <span className={styles.name}>{displayName}</span>
          <span className={styles.sub}>{secondary}</span>
        </span>
      ) : (
        <span className={styles.textLine}>
          {displayName} <span className={styles.sub}>· {secondary}</span>
        </span>
      )}
      {control}
    </Tag>
  );
}

MemberRow.propTypes = {
  member: memberShape.isRequired,
  initials: PropTypes.string.isRequired,
  color: PropTypes.string,
  isMe: PropTypes.bool,
  canManage: PropTypes.bool,
  variant: PropTypes.oneOf(['full', 'compact']),
  onRoleChange: PropTypes.func,
  onRemove: PropTypes.func,
  as: PropTypes.elementType,
};
