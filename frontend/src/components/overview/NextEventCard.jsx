// Дизайн: design/screens/01-overview.html (темна картка «Наступна»), 16-mobile.html (темний рядок «Наступна · через 48 хв»)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { formatRelative, formatTimeRange } from '../../utils/dates';
import { participantsToAvatars } from '../../utils/eventStats';
import { eventShape } from '../../utils/propTypes';
import DarkCard from '../ui/DarkCard';
import PillButton from '../ui/PillButton';
import { AvatarStack } from '../ui/Avatar';
import { locationHref, locationLabel, peopleShape } from './overviewUtils';
import styles from './NextEventCard.module.css';

const EMPTY_TEXT = 'Сьогодні більше нічого';

/** variant: card (темна картка в сітці) · row (рядок на мобільному). event = null → «Сьогодні більше нічого». */
export default function NextEventCard({
  event = null,
  now,
  people = {},
  variant = 'card',
  onOpen,
  className = '',
}) {
  if (!event) {
    if (variant === 'row') {
      return (
        <section className={cx(styles.row, className)} aria-label="Наступна подія">
          <div className={styles.rowText}>
            <span className={styles.rowEyebrow}>Наступна</span>
            <span className={styles.rowTitle}>{EMPTY_TEXT}</span>
          </div>
        </section>
      );
    }
    return (
      <DarkCard
        eyebrow="Наступна"
        title={EMPTY_TEXT}
        className={cx(styles.next, className)}
        aria-label="Наступна подія"
      />
    );
  }

  const relative = formatRelative(event.startAt, now);
  const meta = [formatTimeRange(event.startAt, event.endAt), locationLabel(event.location)]
    .filter(Boolean)
    .join(' · ');
  const href = locationHref(event.location);
  const avatars = participantsToAvatars(event.participants || [], people);
  const names = avatars.map((a) => a.name).join(', ');
  const buttonProps = href
    ? { href, target: '_blank', rel: 'noreferrer' }
    : { onClick: () => onOpen(event) };
  const buttonLabel = href ? 'Приєднатись' : 'Деталі';

  if (variant === 'row') {
    return (
      <section className={cx(styles.row, className)} aria-label="Наступна подія">
        <div className={styles.rowText}>
          <span className={styles.rowEyebrow}>Наступна · {relative}</span>
          <span className={styles.rowTitle}>{event.title}</span>
          {meta ? <span className={styles.rowMeta}>{meta}</span> : null}
        </div>
        <PillButton variant="white" size="xs" className={styles.rowBtn} {...buttonProps}>
          {buttonLabel}
        </PillButton>
      </section>
    );
  }

  return (
    <DarkCard
      eyebrow="Наступна"
      value={relative}
      title={event.title}
      meta={meta || null}
      className={cx(styles.next, className)}
      aria-label="Наступна подія"
      footer={
        <PillButton variant="white" fullWidth className={styles.join} {...buttonProps}>
          {buttonLabel}
        </PillButton>
      }
    >
      {avatars.length ? (
        <div className={styles.people}>
          <AvatarStack items={avatars} size={22} ring="var(--dark)" />
          <span className={styles.names}>{names}</span>
        </div>
      ) : null}
    </DarkCard>
  );
}

NextEventCard.propTypes = {
  event: eventShape,
  now: PropTypes.instanceOf(Date).isRequired,
  people: peopleShape,
  variant: PropTypes.oneOf(['card', 'row']),
  onOpen: PropTypes.func.isRequired,
  className: PropTypes.string,
};
