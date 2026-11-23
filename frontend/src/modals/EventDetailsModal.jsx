import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { parseApiError } from '../api/errors';
import useModals from '../hooks/useModals';
import useEvents from '../hooks/useEvents';
import useCalendars from '../hooks/useCalendars';
import useAuth from '../hooks/useAuth';
import usePeople from '../hooks/usePeople';
import useToast from '../hooks/useToast';
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
  TYPE_LABELS,
  canModifyEvent,
  isValidEmail,
  looksLikeUrl,
  normalizeEmail,
  reminderLabel,
  reminderOptions,
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
const CLOSE_ID = 'ev-details-close';
const CANCEL_DELETE_ID = 'ev-details-cancel-delete';
const HOLIDAY_ID_PREFIX = 'holiday-';

function statusSummary(participants) {
  return Object.keys(STATUS)
    .map((key) => {
      const n = participants.filter((p) => p.status === key).length;
      return n ? `${n} ${plural(n, STATUS[key].plural)}` : null;
    })
    .filter(Boolean)
    .join(' · ');
}

function participantRows(event, people) {
  const list = event.participants || [];
  if (!event.creator || list.some((p) => p.user === event.creator)) return list;
  const person = people[event.creator];
  return [
    {
      user: event.creator,
      name: person?.name || event.creatorName || '',
      email: person?.email || '',
      status: 'accepted',
    },
    ...list,
  ];
}

function metaParts(event) {
  const start = event.startAt ? toDate(event.startAt) : null;
  const end = event.endAt ? toDate(event.endAt) : null;
  const isTask = event.type === 'task';

  if (event.isFloating) {
    return [
      'Без дедлайну',
      event.createdAt && `додано ${formatDate(event.createdAt, 'day-month')}`,
    ];
  }
  if (!start) return ['Дата не вказана'];
  if (isTask) {
    return [`Дедлайн: ${formatDate(start, 'weekday-long')}`, !event.allDay && formatTime(start)];
  }
  if (event.type === 'holiday' || event.allDay) {
    return [formatDate(start, 'weekday-long'), 'весь день'];
  }
  return [
    formatDate(start, 'weekday-long'),
    formatTimeRange(start, end),
    end && formatDuration(durationMinutes(start, end)),
  ];
}

function sourceText(event) {
  const name = event.sourceCalendar?.name;
  return name ? `Подія з календаря «${name}»` : 'Подія з чужого календаря';
}

function EventDetails({ event, onClose }) {
  const { byId } = useCalendars();
  const { user } = useAuth();
  const people = usePeople();
  const { notifySuccess } = useToast();
  const { deleteEvent, updateEvent, toggleCompleted, inviteToEvent } = useEvents();
  const [editingReminder, setEditingReminder] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState(null);
  const [isInviting, setIsInviting] = useState(false);
  const isMounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (confirmingDelete) document.getElementById(CANCEL_DELETE_ID)?.focus();
  }, [confirmingDelete]);

  const calendar = byId[event.calendar] || null;
  const calendarColor = calendar?.color || 'graphite';
  const isHoliday = event.type === 'holiday';
  const isTask = event.type === 'task';
  const canEdit = canModifyEvent(event, calendar, user?.id);
  const showRelative = Boolean(event.startAt) && !isHoliday && !isTask && !event.allDay;
  const relative = showRelative ? formatRelative(event.startAt) : '';

  const rows = useMemo(() => participantRows(event, people), [event, people]);
  const avatars = useMemo(() => participantsToAvatars(rows, people), [rows, people]);
  const guests = rows.filter((p) => p.user !== event.creator);
  const summary = statusSummary(guests);
  const reminderValue = reminderToValue(event.reminderMinutesBefore);

  const hasRows =
    !isHoliday &&
    (!event.isFloating || event.isInvited || Boolean(event.location || event.description));

  const isUrl = looksLikeUrl(event.location);
  const href = isUrl ? withProtocol(event.location.trim()) : null;

  const onDelete = () => {
    deleteEvent(event.id);
    onClose();
  };

  const onReminderChange = (value) => {
    updateEvent(event.id, { reminderMinutesBefore: valueToReminder(value) });
    setEditingReminder(false);
  };

  const onInvite = async (e) => {
    e.preventDefault();
    if (inFlight.current) return;

    const email = normalizeEmail(inviteEmail);
    if (!isValidEmail(email)) {
      setInviteError('Некоректний email');
      return;
    }
    if (email === normalizeEmail(user?.email)) {
      setInviteError('Свій email додавати не потрібно');
      return;
    }
    if (rows.some((p) => p.email === email)) {
      setInviteError('Уже серед учасників');
      return;
    }

    inFlight.current = true;
    setIsInviting(true);
    setInviteError(null);
    try {
      await inviteToEvent(event.id, [email]);
      notifySuccess(`Запрошення надіслано на ${email}`);
      if (isMounted.current) setInviteEmail('');
    } catch (err) {
      const { message, fields } = parseApiError(err);
      if (isMounted.current) setInviteError(Object.values(fields)[0] || message);
    } finally {
      inFlight.current = false;
      if (isMounted.current) setIsInviting(false);
    }
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
          {canEdit && confirmingDelete ? (
            <>
              <span className={styles.confirm}>Видалити подію?</span>
              <PillButton variant="danger" size="xs" icon="trash" iconSize={13} onClick={onDelete}>
                Так, видалити
              </PillButton>
              <PillButton
                id={CANCEL_DELETE_ID}
                variant="secondary"
                size="xs"
                onClick={() => setConfirmingDelete(false)}
              >
                Скасувати
              </PillButton>
            </>
          ) : null}
          {canEdit && !confirmingDelete ? (
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
              <PillButton
                variant="danger"
                size="xs"
                icon="trash"
                iconSize={13}
                onClick={() => setConfirmingDelete(true)}
              >
                Видалити
              </PillButton>
            </>
          ) : null}
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
          {metaParts(event).filter(Boolean).join(' · ')}
          {relative ? (
            <>
              {' · '}
              <span className={cx(styles.rel, relative === 'минула' && styles.relPast)}>
                {relative}
              </span>
            </>
          ) : null}
        </span>
        {isTask && canEdit ? (
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
        {isTask && !canEdit && event.isCompleted ? (
          <span className={styles.doneBadge}>
            <Badge variant="success">виконано</Badge>
          </span>
        ) : null}
      </div>

      {isHoliday ? (
        <p className={styles.holidayNote}>
          Державне свято · календар «{calendar?.name || 'Свята'}» (тільки читання)
        </p>
      ) : null}
      {hasRows ? (
        <div className={styles.rows}>
          {event.isInvited ? (
            <div className={styles.row}>
              <Icon name="calendar" size={16} className={styles.rowIcon} />
              <span>{sourceText(event)}</span>
            </div>
          ) : null}

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

          {event.isFloating ? null : (
            <div className={styles.row}>
              <Icon name="bell" size={16} className={styles.rowIcon} />
              {canEdit && editingReminder ? (
                <Select
                  size="xs"
                  aria-label="Нагадати"
                  options={reminderOptions(reminderValue)}
                  value={reminderValue}
                  onChange={onReminderChange}
                />
              ) : (
                <span>{reminderLabel(event.reminderMinutesBefore)}</span>
              )}
              {canEdit ? (
                <PillButton
                  variant="accent"
                  size="xs"
                  className={styles.change}
                  onClick={() => setEditingReminder((v) => !v)}
                >
                  {editingReminder ? 'Готово' : 'Змінити'}
                </PillButton>
              ) : null}
            </div>
          )}

          {event.description ? (
            <div className={cx(styles.row, styles.rowTop)}>
              <Icon name="text" size={16} className={cx(styles.rowIcon, styles.rowIconTop)} />
              <p className={styles.desc}>{event.description}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {isHoliday ? null : (
        <div className={styles.people}>
          <div className={styles.peopleHead}>
            <span className={styles.eyebrow}>Учасники · {rows.length}</span>
            {summary ? <span className={styles.summary}>{summary}</span> : null}
          </div>
          {rows.map((p, i) => {
            const person = p.user ? people[p.user] : null;
            const isOrganizer = Boolean(p.user) && p.user === event.creator;
            const name = person?.isMe ? 'Ти' : p.name || person?.name || '';
            const note = isOrganizer ? 'організатор' : p.email;
            const status = !isOrganizer && STATUS[p.status];
            return (
              <div key={p.user || p.email} className={styles.row}>
                {avatars[i].initials ? (
                  <Avatar initials={avatars[i].initials} color={avatars[i].color} size={26} />
                ) : (
                  <span className={styles.anon} aria-hidden="true">
                    <Icon name="user" size={14} />
                  </span>
                )}
                <span className={styles.person}>
                  {name || (isOrganizer ? 'Організатор' : p.email)}
                  {name ? <span className={styles.muted}> · {note}</span> : null}
                </span>
                {status ? <Badge variant={status.variant}>{status.label}</Badge> : null}
              </div>
            );
          })}
          {canEdit ? (
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
              <PillButton
                type="submit"
                variant="secondary"
                shape="rounded"
                size="sm"
                disabled={isInviting}
              >
                {isInviting ? 'Надсилаємо…' : 'Надіслати'}
              </PillButton>
            </form>
          ) : null}
          {canEdit && inviteError ? (
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

export default function EventDetailsModal() {
  const { detailsEventId, closeDetails } = useModals();
  const { getEvent, holidayEvents, isLoading } = useEvents();
  const event = useMemo(() => {
    if (!detailsEventId) return null;
    return getEvent(detailsEventId) || holidayEvents.find((e) => e.id === detailsEventId) || null;
  }, [detailsEventId, getEvent, holidayEvents]);
  const isStale =
    Boolean(detailsEventId) &&
    !event &&
    !isLoading &&
    !detailsEventId.startsWith(HOLIDAY_ID_PREFIX);

  useEffect(() => {
    if (isStale) closeDetails();
  }, [isStale, closeDetails]);

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
      initialFocus={`#${CLOSE_ID}`}
    >
      <EventDetails key={event.id} event={event} onClose={closeDetails} />
    </Modal>
  );
}
