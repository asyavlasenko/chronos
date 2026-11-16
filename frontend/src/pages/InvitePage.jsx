import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation, useParams } from 'react-router-dom';
import * as invitesApi from '../api/invites.api';
import { parseApiError } from '../api/errors';
import useAuth from '../hooks/useAuth';
import useCalendars from '../hooks/useCalendars';
import useEvents from '../hooks/useEvents';
import usePeople from '../hooks/usePeople';
import { participantsToAvatars } from '../utils/eventStats';
import { colorVars } from '../utils/colors';
import { normalizeInvite } from '../utils/normalize';
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
import PageLoader from '../components/ui/PageLoader';
import styles from './InvitePage.module.css';

const ROLE_LABELS = { owner: 'Власник', editor: 'Редактор', viewer: 'Глядач' };
const URL_RE = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i;
const FINAL_ERROR_STATUSES = [404, 409, 410];
const NOT_FOUND_TITLE = 'Запрошення не знайдено';
const NOT_FOUND_HINT = 'Перевір посилання з листа або попроси надіслати запрошення ще раз.';
const LOAD_ERROR_TITLE = 'Не вдалося завантажити запрошення';
const STATUS_TEXT = {
  accepted: 'Запрошення прийнято',
  declined: 'Запрошення відхилено',
  expired: 'Термін дії запрошення минув',
};
const STATUS_FALLBACK = 'Запрошення вже опрацьовано';

function participantsLabel(participants) {
  const names = participants.map((p) => p.name || p.email);
  if (names.length <= 2) return names.join(' і ');
  return `${names.slice(0, 2).join(', ')} і ще ${names.length - 2}`;
}

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

function availabilityText(free, timeFormat) {
  if (free.conflict) {
    const range = formatTimeRange(free.conflict.startAt, free.conflict.endAt, timeFormat);
    return `У цей час у тебе «${free.conflict.title}» (${range}).`;
  }
  if (free.previous) {
    const until = formatTime(free.previous.endAt, timeFormat);
    return `У цей час у тебе вільно — попередня подія «${free.previous.title}» закінчується о ${until}.`;
  }
  return 'У цей час у тебе вільно — інших подій того дня немає.';
}

function eventTimeText(event, timeFormat) {
  if (event.allDay) return 'весь день';
  const range = formatTimeRange(event.startAt, event.endAt, timeFormat);
  const duration = event.endAt ? formatDuration(durationMinutes(event.startAt, event.endAt)) : null;
  return [range, duration].filter(Boolean).join(' · ');
}

function validityText(expiresAt) {
  if (!expiresAt) return null;
  const daysLeft = daysBetween(new Date(), expiresAt);
  if (daysLeft < 0) return null;
  if (daysLeft === 0) return 'дійсне до кінця дня';
  return `дійсне ${daysLeft} ${pluralDays(daysLeft)}`;
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

function MessageCard({ title, text = null, children = null }) {
  return (
    <div className={styles.page}>
      <Logo />
      <Card as="section" aria-label="Запрошення" padding="24px" gap={10} className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        {text ? <p className={styles.muted}>{text}</p> : null}
        {children ? <div className={styles.actions}>{children}</div> : null}
      </Card>
    </div>
  );
}

MessageCard.propTypes = {
  title: PropTypes.string.isRequired,
  text: PropTypes.string,
  children: PropTypes.node,
};

export default function InvitePage() {
  const { token } = useParams();
  const location = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { refresh } = useCalendars();
  const { events: myEvents, isLoading: isEventsLoading } = useEvents({ includeHidden: true });
  const people = usePeople();
  const [load, setLoad] = useState({ phase: 'loading', invite: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    let isActive = true;
    setLoad({ phase: 'loading', invite: null, error: null });
    setActionError(null);
    invitesApi
      .getInvite(token)
      .then((data) => {
        if (isActive) setLoad({ phase: 'ready', invite: normalizeInvite(data), error: null });
      })
      .catch((err) => {
        if (!isActive) return;
        const parsed = parseApiError(err);
        setLoad({
          phase: parsed.status === 404 ? 'notFound' : 'failed',
          invite: null,
          error: parsed.message,
        });
      });
    return () => {
      isActive = false;
    };
  }, [token, reloadKey]);

  const { invite } = load;
  const event = invite?.kind === 'event' ? invite.event : null;

  const dayEvents = useMemo(() => {
    if (!event?.startAt) return [];
    const from = startOfDay(event.startAt);
    const to = addDays(from, 1);
    return myEvents.filter((e) => e.startAt && toDate(e.startAt) >= from && toDate(e.startAt) < to);
  }, [myEvents, event]);

  const respond = async (action) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const request = action === 'accept' ? invitesApi.acceptInvite : invitesApi.declineInvite;
      const updated = normalizeInvite(await request(token));
      setLoad({ phase: 'ready', invite: updated, error: null });
      await refresh();
    } catch (err) {
      setActionError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (isAuthLoading || load.phase === 'loading') return <PageLoader />;

  if (load.phase === 'notFound') {
    return (
      <MessageCard
        title={NOT_FOUND_TITLE}
        text={load.error && load.error !== NOT_FOUND_TITLE ? load.error : NOT_FOUND_HINT}
      >
        <PillButton to="/" size="lg" className={styles.big}>
          На Огляд
        </PillButton>
      </MessageCard>
    );
  }

  if (load.phase === 'failed') {
    return (
      <MessageCard title={LOAD_ERROR_TITLE} text={load.error}>
        <PillButton size="lg" className={styles.big} onClick={() => setReloadKey((k) => k + 1)}>
          Спробувати ще
        </PillButton>
      </MessageCard>
    );
  }

  const timeFormat = user?.timeFormat || '24h';
  const { calendar, invitedBy: inviter } = invite;
  const isPending = invite.status === 'pending';
  const isAccepted = invite.status === 'accepted';
  const isClosedByError = FINAL_ERROR_STATUSES.includes(actionError?.status);
  const participants = event?.participants || [];
  const description = event ? event.description : calendar?.description;
  const target = event ? 'на подію' : 'в календар';
  const lead = inviter?.name
    ? `${inviter.name} запрошує тебе ${target}`
    : `Тебе запрошують ${target}`;
  const authState = { from: location };

  const showAvailability =
    Boolean(user) && isPending && !isEventsLoading && Boolean(event?.startAt) && !event.allDay;
  const free = showAvailability ? availability(dayEvents, event) : null;

  const dayLink = event?.startAt
    ? `/calendar/day?date=${toDateParam(event.startAt)}`
    : '/calendar/week';
  const openTo = event ? dayLink : `/calendars/${calendar?.id}`;
  const validity = isPending ? validityText(invite.expiresAt) : null;

  let footer = null;
  if (!isPending) {
    footer = (
      <div className={styles.result} role="status">
        <span className={styles.resultText}>{STATUS_TEXT[invite.status] || STATUS_FALLBACK}</span>
        {isAccepted && user ? (
          <Link to={openTo} className={styles.resultLink}>
            Відкрити календар
          </Link>
        ) : null}
      </div>
    );
  } else if (!user) {
    footer = (
      <>
        <div className={styles.actions}>
          <PillButton
            to="/login"
            state={authState}
            size="lg"
            className={cx(styles.big, styles.accept)}
          >
            Увійти, щоб відповісти
          </PillButton>
          <PillButton
            to="/register"
            state={authState}
            variant="secondary"
            size="lg"
            className={styles.big}
          >
            Зареєструватися
          </PillButton>
        </div>
        <span className={styles.guestHint}>
          Запрошення прийшло на {invite.email}. Увійди або зареєструйся саме з цим email.
        </span>
      </>
    );
  } else if (!isClosedByError) {
    footer = (
      <div className={styles.actions}>
        <PillButton
          size="lg"
          className={cx(styles.big, styles.accept)}
          disabled={busy}
          onClick={() => respond('accept')}
        >
          Прийняти
        </PillButton>
        <PillButton
          variant="secondary"
          size="lg"
          className={styles.big}
          disabled={busy}
          onClick={() => respond('decline')}
        >
          Відхилити
        </PillButton>
        <span className={styles.actionsHint}>
          {event
            ? "Після прийняття подія з'явиться в календарі"
            : "Після прийняття календар з'явиться у списку"}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Logo />

      <Card as="section" aria-label="Запрошення" padding="24px" gap={16} className={styles.card}>
        <div className={styles.head}>
          <Avatar
            initials={inviter?.initials || '?'}
            color={inviter?.color || 'graphite'}
            size={44}
            title={inviter?.name || ''}
          />
          <div className={styles.headText}>
            <span className={styles.lead}>{lead}</span>
            <h1 className={styles.title}>{event ? event.title : calendar?.name}</h1>
          </div>
        </div>

        <div className={styles.details}>
          {event?.startAt ? (
            <DetailRow icon="clock">
              <span>
                <b>{formatDate(event.startAt, 'weekday-long')}</b> ·{' '}
                {eventTimeText(event, timeFormat)}
              </span>
            </DetailRow>
          ) : null}

          {calendar ? (
            <DetailRow>
              <span className={styles.detailIcon}>
                <span
                  className={styles.calDot}
                  style={{ background: colorVars(calendar.color).base }}
                />
              </span>
              <span>
                Календар <b>{calendar.name}</b>
                {calendar.isShared || !event ? ' · спільний' : ''}
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

        {free ? (
          <div className={cx(styles.info, free.conflict && styles.infoDanger)}>
            <Icon name="info" size={16} className={styles.infoIcon} />
            <span>{availabilityText(free, timeFormat)}</span>
          </div>
        ) : null}

        {actionError ? (
          <div className={cx(styles.info, styles.infoDanger)} role="alert">
            <Icon name="info" size={16} className={styles.infoIcon} />
            <span>{actionError.message}</span>
          </div>
        ) : null}

        {footer}
      </Card>

      <span className={styles.footnote}>
        Запрошення надіслано на {invite.email}
        {validity ? ` · ${validity}` : ''}
      </span>
    </div>
  );
}
