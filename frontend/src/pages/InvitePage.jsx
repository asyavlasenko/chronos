// Дизайн: design/screens/15-invite.html
// Публічна сторінка прийняття запрошення з листа (/invite/:token): хто запрошує, деталі події
// або календаря, учасники, «ти вільна» / перетин із власною подією, Прийняти / Відхилити.
import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useEvents from '../hooks/useEvents';
import useCalendars from '../hooks/useCalendars';
import { people } from '../mocks/data';
import { participantsToAvatars } from '../utils/eventStats';
import { colorVars } from '../utils/colors';
import cx from '../utils/cx';
import {
  addDays,
  daysBetween,
  durationMinutes,
  formatDate,
  formatDuration,
  formatTime,
  formatTimeRange,
  intervalsOverlap,
  pluralDays,
  startOfDay,
  toDate,
  toDateParam,
} from '../utils/dates';
import Icon from '../components/ui/Icon';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Avatar, { AvatarStack } from '../components/ui/Avatar';
import PillButton from '../components/ui/PillButton';
import styles from './InvitePage.module.css';

const ROLE_LABELS = { owner: 'Власник', editor: 'Редактор', viewer: 'Глядач' };
const URL_RE = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i;

/** «Максим, Оля і ще 1» */
function participantsLabel(participants) {
  const names = participants.map((p) => p.name || p.email);
  if (names.length <= 2) return names.join(' і ');
  return `${names.slice(0, 2).join(', ')} і ще ${names.length - 2}`;
}

/** Перетин із власною зустріччю того дня або остання зустріч перед початком запрошеної. */
function availability(dayEvents, event) {
  const start = toDate(event.startAt);
  const end = event.endAt ? toDate(event.endAt) : start;
  const own = dayEvents.filter((e) => e.id !== event.id && e.type === 'arrangement' && e.endAt);
  const conflict = own.find((e) => intervalsOverlap(start, end, e.startAt, e.endAt)) || null;
  const previous =
    own
      .filter((e) => toDate(e.endAt) <= start)
      .sort((a, b) => toDate(b.endAt) - toDate(a.endAt))[0] || null;
  return { conflict, previous };
}

function Logo() {
  return (
    <Link to="/" className={styles.logo}>
      <span className={styles.logoMark}>
        <Icon name="logo" size={17} strokeWidth={2.4} />
      </span>
      <span className={styles.logoText}>Chronos</span>
    </Link>
  );
}

function DetailRow({ icon = null, align = 'center', children }) {
  return (
    <div className={cx(styles.detail, align === 'start' && styles.detailStart)}>
      {icon ? (
        <span className={styles.detailIcon}>
          <Icon name={icon} size={16} />
        </span>
      ) : null}
      {children}
    </div>
  );
}

DetailRow.propTypes = {
  icon: PropTypes.string,
  align: PropTypes.oneOf(['center', 'start']),
  children: PropTypes.node.isRequired,
};

function LocationLink({ location }) {
  if (URL_RE.test(location)) {
    const href = location.startsWith('http') ? location : `https://${location}`;
    return (
      <a href={href} target="_blank" rel="noreferrer" className={styles.link}>
        {location}
      </a>
    );
  }
  return <span>{location}</span>;
}

LocationLink.propTypes = {
  location: PropTypes.string.isRequired,
};

export default function InvitePage() {
  const { token } = useParams();
  const { user } = useAuth();
  const { invites, respondInvite, events: allEvents } = useEvents();
  const { byId } = useCalendars();
  const timeFormat = user?.timeFormat || '24h';

  const invite = invites.find((i) => i.token === token) || null;
  const event = invite?.kind === 'event' ? invite.event : null;
  const daysLeft = invite?.expiresAt ? daysBetween(new Date(), invite.expiresAt) : null;
  const expired = daysLeft !== null && daysLeft < 0;

  const dayEvents = useMemo(() => {
    if (!event) return [];
    const from = startOfDay(event.startAt);
    const to = addDays(from, 1);
    return allEvents.filter(
      (e) => e.startAt && toDate(e.startAt) >= from && toDate(e.startAt) < to,
    );
  }, [allEvents, event]);

  if (!invite || expired) {
    return (
      <div className={styles.page}>
        <Logo />
        <Card as="section" aria-label="Запрошення" padding="24px" gap={10} className={styles.card}>
          <h1 className={styles.title}>Запрошення не знайдено або прострочене</h1>
          <p className={styles.muted}>
            Перевір посилання з листа або попроси надіслати запрошення ще раз.
          </p>
          <div className={styles.actions}>
            <PillButton to="/" size="lg" className={styles.big}>
              На Огляд
            </PillButton>
          </div>
        </Card>
      </div>
    );
  }

  const calendar = invite.calendar || (event ? byId[event.calendar] : null);
  const calendarColor = calendar ? colorVars(calendar.color).base : null;
  const inviter = invite.invitedBy;
  const isPending = invite.status === 'pending';
  const isAccepted = invite.status === 'accepted';
  const participants = event?.participants || [];
  const description = event?.description || invite.description || '';
  const free = event ? availability(dayEvents, event) : null;

  let freeText = null;
  if (free?.conflict) {
    freeText = `У цей час у тебе «${free.conflict.title}» (${formatTimeRange(
      free.conflict.startAt,
      free.conflict.endAt,
      timeFormat,
    )}).`;
  } else if (free?.previous) {
    freeText = `У цей час ти вільна — попередня подія «${free.previous.title}» закінчується о ${formatTime(
      free.previous.endAt,
      timeFormat,
    )}.`;
  } else if (event) {
    freeText = 'У цей час ти вільна — інших подій того дня немає.';
  }

  const openTo = event ? `/calendar/day?date=${toDateParam(event.startAt)}` : '/calendars';
  const acceptedText = event ? 'Подію додано в календар' : 'Календар додано до твоїх';
  const openLabel = event ? 'Відкрити календар' : 'Відкрити календарі';

  return (
    <div className={styles.page}>
      <Logo />

      <Card as="section" aria-label="Запрошення" padding="24px" gap={16} className={styles.card}>
        <div className={styles.head}>
          <Avatar
            initials={inviter.initials}
            color={inviter.color}
            size={44}
            title={inviter.name}
          />
          <div>
            <span className={styles.lead}>
              {inviter.name} запрошує тебе {event ? 'на подію' : 'в календар'}
            </span>
            <h1 className={styles.title}>{event ? event.title : calendar?.name}</h1>
          </div>
        </div>

        <div className={styles.details}>
          {event ? (
            <DetailRow icon="clock">
              <span>
                <b>{formatDate(event.startAt, 'weekday-long')}</b> ·{' '}
                {formatTimeRange(event.startAt, event.endAt, timeFormat)}
                {event.endAt
                  ? ` · ${formatDuration(durationMinutes(event.startAt, event.endAt))}`
                  : ''}
              </span>
            </DetailRow>
          ) : null}

          {calendar ? (
            <DetailRow>
              <span className={styles.detailIcon}>
                <span className={styles.calDot} style={{ background: calendarColor }} />
              </span>
              <span>
                Календар <b>{calendar.name}</b>
                {calendar.isShared ? ' · спільний' : ''}
              </span>
              {!event && invite.role ? (
                <Badge variant="muted">{ROLE_LABELS[invite.role] || invite.role}</Badge>
              ) : null}
            </DetailRow>
          ) : null}

          {event?.location ? (
            <DetailRow icon={URL_RE.test(event.location) ? 'video' : 'map-pin'}>
              <LocationLink location={event.location} />
            </DetailRow>
          ) : null}

          {description ? (
            <DetailRow icon="text" align="start">
              <p className={styles.description}>{description}</p>
            </DetailRow>
          ) : null}

          {participants.length ? (
            <DetailRow icon="users">
              <AvatarStack
                items={participantsToAvatars(participants, people)}
                size={26}
                max={2}
                ring="var(--card)"
              />
              <span className={styles.muted}>{participantsLabel(participants)}</span>
            </DetailRow>
          ) : null}
        </div>

        {freeText ? (
          <div className={cx(styles.info, free?.conflict && styles.infoDanger)}>
            <Icon name="info" size={16} className={styles.infoIcon} />
            <span>{freeText}</span>
          </div>
        ) : null}

        {isPending ? (
          <div className={styles.actions}>
            <PillButton
              size="lg"
              className={cx(styles.big, styles.accept)}
              onClick={() => respondInvite(invite.id, 'accepted')}
            >
              Прийняти
            </PillButton>
            <PillButton
              variant="secondary"
              size="lg"
              className={styles.big}
              onClick={() => respondInvite(invite.id, 'declined')}
            >
              Відхилити
            </PillButton>
            <span className={styles.actionsHint}>
              {event
                ? "Після прийняття подія з'явиться в календарі"
                : "Після прийняття календар з'явиться у списку"}
            </span>
          </div>
        ) : (
          <div className={styles.result} role="status">
            {isAccepted ? (
              <>
                <span className={styles.resultText}>{acceptedText}</span>
                <Link to={openTo} className={styles.resultLink}>
                  {openLabel}
                </Link>
              </>
            ) : (
              <span className={styles.resultText}>Запрошення відхилено</span>
            )}
          </div>
        )}
      </Card>

      <span className={styles.footnote}>
        Запрошення надіслано на {invite.email}
        {daysLeft !== null ? ` · дійсне ${daysLeft} ${pluralDays(daysLeft)}` : ''}
      </span>
    </div>
  );
}
