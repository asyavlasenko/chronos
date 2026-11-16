import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { formatDate, formatTimeRange } from '../../utils/dates';
import { inviteShape } from '../../utils/propTypes';
import Card from '../ui/Card';
import PillButton from '../ui/PillButton';
import styles from './InvitesCard.module.css';

function inviteTitle(invite) {
  if (invite.kind === 'calendar') return invite.calendar?.name || 'Календар';
  return invite.event?.title || 'Подія';
}

function inviteMeta(invite) {
  const by = invite.invitedBy?.name ? `запрошує ${invite.invitedBy.name}` : null;
  if (invite.kind === 'event') {
    const { startAt, endAt, allDay } = invite.event || {};
    const date = startAt ? formatDate(startAt, 'short') : 'подія';
    const time = startAt && !allDay ? formatTimeRange(startAt, endAt) : null;
    return [date, time, by].filter(Boolean).join(' · ');
  }
  return ['спільний календар', by].filter(Boolean).join(' · ');
}

export default function InvitesCard({ invites, onRespond, className = '' }) {
  const [busyId, setBusyId] = useState(null);

  const respond = async (id, status) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await onRespond(id, status);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card
      aria-label="Запрошення"
      title="Запрошення"
      action={invites.length ? <span className={styles.count}>{invites.length}</span> : null}
      gap={8}
      className={className}
    >
      {invites.map((inv) => (
        <div key={inv.id} className={styles.invite}>
          <Link to={`/invite/${inv.token}`} className={styles.title}>
            {inviteTitle(inv)}
          </Link>
          <span className={styles.meta}>{inviteMeta(inv)}</span>
          <div className={styles.actions}>
            <PillButton
              shape="rounded"
              size="xs"
              disabled={busyId === inv.id}
              onClick={() => respond(inv.id, 'accepted')}
            >
              Прийняти
            </PillButton>
            <PillButton
              variant="secondary"
              shape="rounded"
              size="xs"
              disabled={busyId === inv.id}
              onClick={() => respond(inv.id, 'declined')}
            >
              Відхилити
            </PillButton>
          </div>
        </div>
      ))}
      {!invites.length ? <span className={styles.meta}>Немає нових запрошень</span> : null}
    </Card>
  );
}

InvitesCard.propTypes = {
  invites: PropTypes.arrayOf(inviteShape).isRequired,
  onRespond: PropTypes.func.isRequired,
  className: PropTypes.string,
};
