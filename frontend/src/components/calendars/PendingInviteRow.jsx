import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import Badge from '../ui/Badge';
import Icon from '../ui/Icon';
import { ROLE_LABELS } from './members';
import styles from './PendingInviteRow.module.css';

export default function PendingInviteRow({
  invite,
  variant = 'full',
  disabled = false,
  onCancel,
  as: Tag = 'div',
}) {
  const compact = variant === 'compact';
  const roleLabel = ROLE_LABELS[invite.role] || invite.role;
  const badge = (
    <Badge variant="muted" size="sm">
      очікує
    </Badge>
  );

  return (
    <Tag className={cx(styles.row, compact && styles.compact)}>
      <span className={styles.icon}>
        <Icon name="mail" size={14} />
      </span>
      {compact ? (
        <span className={styles.textCol}>
          <span className={styles.email}>{invite.email}</span>
          <span className={styles.subRow}>
            <span className={styles.sub}>{roleLabel}</span>
            {badge}
          </span>
        </span>
      ) : (
        <>
          <span className={styles.textLine}>
            {invite.email} <span className={styles.sub}>· {roleLabel}</span>
          </span>
          {badge}
        </>
      )}
      <button
        type="button"
        className={styles.cancel}
        aria-label={`Скасувати запрошення для ${invite.email}`}
        disabled={disabled}
        onClick={() => onCancel(invite)}
      >
        Скасувати
      </button>
    </Tag>
  );
}

PendingInviteRow.propTypes = {
  invite: PropTypes.shape({
    id: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    role: PropTypes.string,
  }).isRequired,
  variant: PropTypes.oneOf(['full', 'compact']),
  disabled: PropTypes.bool,
  onCancel: PropTypes.func.isRequired,
  as: PropTypes.elementType,
};
