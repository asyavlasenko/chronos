// Дизайн: design/screens/12-event-details.html
// Деталі події (?event=<id>, 560px, top 90): бейдж календаря, Редагувати/Видалити, час, посилання,
// нагадування, опис, учасники зі статусами, запросити по email. Свято — лише назва, дата й примітка.
import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import useModals from '../hooks/useModals';
import useEvents from '../hooks/useEvents';
import useCalendars from '../hooks/useCalendars';
import useAuth from '../hooks/useAuth';
import { people } from '../mocks/data';
import cx from '../utils/cx';
import {
  durationMinutes,
  formatDate,
  formatDuration,
  formatRelative,
  formatTime,
  formatTimeRange,
  toDate,
} from '../utils/dates';
import { participantsToAvatars } from '../utils/eventStats';
import { plural } from '../utils/text';
import { eventShape } from '../utils/propTypes';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import Avatar from '../components/ui/Avatar';
import Checkbox from '../components/ui/Checkbox';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import PillButton from '../components/ui/PillButton';
import IconButton from '../components/ui/IconButton';
import Icon from '../components/ui/Icon';
import {
  REMINDER_OPTIONS,
  TYPE_LABELS,
  isValidEmail,
  looksLikeUrl,
  participantFromEmail,
  reminderLabel,
  reminderToValue,
  valueToReminder,
  withProtocol,
} from './eventFormUtils';
import styles from './EventDetailsModal.module.css';

const STATUS = {
  accepted: { variant: 'success', label: 'прийняв', plural: ['прийняв', 'прийняли', 'прийняли'] },
  pending: { variant: 'muted', label: 'очікує', plural: ['очікує', 'очікують', 'очікують'] },
  declined: {
    variant: 'danger',
    label: 'відхилив',
    plural: ['відхилив', 'відхилили', 'відхилили'],
  },
};
const HOLIDAY_NOTE = 'Державне свято · календар «Свята України» (тільки читання)';
const CLOSE_ID = 'ev-details-close';

/** «2 прийняли · 1 очікує» за статусами (без організатора). */
function statusSummary(participants) {
  return Object.keys(STATUS)
    .map((key) => {
      const n = participants.filter((p) => p.status === key).length;
      return n ? `${n} ${plural(n, STATUS[key].plural)}` : null;
    })
    .filter(Boolean)
    .join(' · ');
}

/** Рядки учасників: організатор (creator) завжди перший, навіть якщо його немає в participants. */
function participantRows(event) {
  const list = event.participants || [];
  if (!event.creator || list.some((p) => p.user === event.creator)) return list;
  const person = people[event.creator];
  return [
    {
      user: event.creator,
      name: person?.name || 'Організатор',
      email: person?.email || '',
      status: 'accepted',
    },
    ...list,
  ];
}

function EventDetails({ event, onClose }) {
  const { byId } = useCalendars();
  const { user } = useAuth();
  const { deleteEvent, updateEvent, toggleCompleted } = useEvents();
  const [editingReminder, setEditingReminder] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState(null);

  // Modal сам фокусує першу кнопку (це «Видалити»); безпечніше починати з «Закрити».
  useEffect(() => {
    const t = setTimeout(() => document.getElementById(CLOSE_ID)?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  const calendar = byId[event.calendar] || null;
  const calendarColor = calendar?.color || 'graphite';
  const isHoliday = event.type === 'holiday';
  const isTask = event.type === 'task';
  const start = event.startAt ? toDate(event.startAt) : null;
  const end = event.endAt ? toDate(event.endAt) : null;

  // «Четвер, 5 листопада · 11:00 – 12:00 · 60 хв» + «через 48 хв» окремо (акцент)
  let metaParts = [];
  if (!start) metaParts = [isTask ? 'Без дедлайну' : 'Дата не вказана'];
  else if (isHoliday) metaParts = [formatDate(start, 'weekday-long'), 'весь день'];
  else if (isTask) {
    metaParts = [
      `Дедлайн: ${formatDate(start, 'weekday-long')}`,
      !event.allDay && formatTime(start),
    ];
  } else if (event.allDay) metaParts = [formatDate(start, 'weekday-long'), 'весь день'];
  else {
    metaParts = [
      formatDate(start, 'weekday-long'),
      formatTimeRange(start, end),
      end && formatDuration(durationMinutes(start, end)),
    ];
  }
  const showRelative = start && !isHoliday && !isTask && !event.allDay;
  const relative = showRelative ? formatRelative(start) : '';

  const rows = useMemo(() => participantRows(event), [event]);
  const avatars = useMemo(() => participantsToAvatars(rows, people), [rows]);
  const guests = rows.filter((p) => p.user !== event.creator);
  const summary = statusSummary(guests);

  const isUrl = looksLikeUrl(event.location);
  const href = isUrl ? withProtocol(event.location.trim()) : null;

  const onDelete = () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Видалити подію «${event.title}»?`)) return;
    deleteEvent(event.id);
    onClose();
  };

  const onReminderChange = (value) => {
    updateEvent(event.id, { reminderMinutesBefore: valueToReminder(value) });
    setEditingReminder(false);
  };

  const onInvite = (e) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setInviteError('Некоректний email');
      return;
    }
    if (rows.some((p) => p.email === email)) {
      setInviteError('Уже серед учасників');
      return;
    }
    updateEvent(event.id, (prev) => ({
      participants: [...(prev.participants || []), participantFromEmail(email)],
    }));
    setInviteEmail('');
    setInviteError(null);
  };

  return (
    <>
      <div className={styles.head}>
        <Badge
          variant="tint"
          color={calendarColor}
          dot={calendarColor}
          dotShape="square"
          className={styles.calBadge}
        >
          {calendar?.name || 'Календар'} · {TYPE_LABELS[event.type]}
        </Badge>
        <span className={styles.actions}>
          {isHoliday ? null : (
            <>
              <PillButton
                variant="secondary"
                size="xs"
                icon="pencil"
                iconSize={13}
                to={`/events/${event.id}`}
              >
                Редагувати
              </PillButton>
              <PillButton variant="danger" size="xs" icon="trash" iconSize={13} onClick={onDelete}>
                Видалити
              </PillButton>
            </>
          )}
          <IconButton
            id={CLOSE_ID}
            icon="x"
            label="Закрити"
            size="round"
            variant="muted"
            iconSize={14}
            onClick={onClose}
          />
        </span>
      </div>

      <div>
        <h1 className={styles.title}>{event.title}</h1>
        <span className={styles.meta}>
          {metaParts.filter(Boolean).join(' · ')}
          {relative ? (
            <>
              {' · '}
              <span className={cx(styles.rel, relative === 'минула' && styles.relPast)}>
                {relative}
              </span>
            </>
          ) : null}
        </span>
        {isTask ? (
          <label htmlFor="ev-done" className={styles.done}>
            <Checkbox
              id="ev-done"
              checked={Boolean(event.isCompleted)}
              onChange={() => toggleCompleted(event.id)}
              size={16}
            />
            Виконано
          </label>
        ) : null}
      </div>

      {isHoliday ? (
        <p className={styles.holidayNote}>{HOLIDAY_NOTE}</p>
      ) : (
        <div className={styles.rows}>
          {event.location ? (
            <div className={styles.row}>
              <Icon name={isUrl ? 'video' : 'map-pin'} size={16} className={styles.rowIcon} />
              {isUrl ? (
                <a href={href} target="_blank" rel="noreferrer" className={styles.link}>
                  {event.location}
                </a>
              ) : (
                <span>{event.location}</span>
              )}
              {isUrl ? (
                <PillButton
                  size="xs"
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.join}
                >
                  Приєднатись
                </PillButton>
              ) : null}
            </div>
          ) : null}

          <div className={styles.row}>
            <Icon name="bell" size={16} className={styles.rowIcon} />
            {editingReminder ? (
              <Select
                size="xs"
                aria-label="Нагадати"
                options={REMINDER_OPTIONS}
                value={reminderToValue(event.reminderMinutesBefore)}
                onChange={onReminderChange}
              />
            ) : (
              <span>{reminderLabel(event.reminderMinutesBefore)}</span>
            )}
            <PillButton
              variant="accent"
              size="xs"
              className={styles.change}
              onClick={() => setEditingReminder((v) => !v)}
            >
              {editingReminder ? 'Готово' : 'Змінити'}
            </PillButton>
          </div>

          {event.description ? (
            <div className={cx(styles.row, styles.rowTop)}>
              <Icon name="text" size={16} className={cx(styles.rowIcon, styles.rowIconTop)} />
              <p className={styles.desc}>{event.description}</p>
            </div>
          ) : null}
        </div>
      )}

      {isHoliday ? null : (
        <div className={styles.people}>
          <div className={styles.peopleHead}>
            <span className={styles.eyebrow}>Учасники · {rows.length}</span>
            {summary ? <span className={styles.summary}>{summary}</span> : null}
          </div>
          {rows.map((p, i) => {
            const isMe = p.user === user?.id;
            const isOrganizer = Boolean(p.user) && p.user === event.creator;
            const status = !isOrganizer && STATUS[p.status];
            return (
              <div key={p.user || p.email} className={styles.row}>
                <Avatar initials={avatars[i].initials} color={avatars[i].color} size={26} />
                <span className={styles.person}>
                  {isMe ? 'Ти' : p.name || avatars[i].name}
                  <span className={styles.muted}> · {isOrganizer ? 'організатор' : p.email}</span>
                </span>
                {status ? <Badge variant={status.variant}>{status.label}</Badge> : null}
              </div>
            );
          })}
          <form className={styles.invite} onSubmit={onInvite} noValidate>
            <Input
              type="email"
              size="sm"
              placeholder="Запросити ще по email"
              aria-label="Email для запрошення"
              value={inviteEmail}
              invalid={Boolean(inviteError)}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                if (inviteError) setInviteError(null);
              }}
              className={styles.inviteInput}
            />
            <PillButton type="submit" variant="secondary" shape="rounded" size="sm">
              Надіслати
            </PillButton>
          </form>
          {inviteError ? (
            <span className={styles.error} role="alert">
              {inviteError}
            </span>
          ) : null}
        </div>
      )}
    </>
  );
}

EventDetails.propTypes = {
  event: eventShape.isRequired,
  onClose: PropTypes.func.isRequired,
};

/** Відкрита, коли в URL є ?event=<id> і подія існує (у т.ч. свято). Якщо id є, а події немає — закриваємо. */
export default function EventDetailsModal() {
  const { detailsEventId, closeDetails } = useModals();
  const { getEvent, holidayEvents } = useEvents();
  const event = useMemo(() => {
    if (!detailsEventId) return null;
    return getEvent(detailsEventId) || holidayEvents.find((e) => e.id === detailsEventId) || null;
  }, [detailsEventId, getEvent, holidayEvents]);

  useEffect(() => {
    if (detailsEventId && !event) closeDetails();
  }, [detailsEventId, event, closeDetails]);

  if (!event) return null;
  return (
    <Modal
      open
      onClose={closeDetails}
      label={event.title}
      width={560}
      top={90}
      padding={22}
      gap={16}
    >
      <EventDetails key={event.id} event={event} onClose={closeDetails} />
    </Modal>
  );
}
