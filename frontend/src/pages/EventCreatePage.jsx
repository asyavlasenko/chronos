import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { parseApiError } from '../api/errors';
import useAuth from '../hooks/useAuth';
import useEvents from '../hooks/useEvents';
import useCalendars from '../hooks/useCalendars';
import usePeople from '../hooks/usePeople';
import useToast from '../hooks/useToast';
import cx from '../utils/cx';
import { colorVars } from '../utils/colors';
import {
  addDays,
  formatDate,
  formatTime,
  formatTimeRange,
  intervalsOverlap,
  toDate,
  toDateParam,
} from '../utils/dates';
import { addMinutes, participantsToAvatars } from '../utils/eventStats';
import { pluralEvents } from '../utils/text';
import { calendarShape, eventShape, participantShape } from '../utils/propTypes';
import Card from '../components/ui/Card';
import Field from '../components/ui/Field';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import Checkbox from '../components/ui/Checkbox';
import ColorPicker from '../components/ui/ColorPicker';
import PillButton from '../components/ui/PillButton';
import Icon from '../components/ui/Icon';
import EventBlock from '../components/calendar/EventBlock';
import ParticipantsInput from '../modals/ParticipantsInput';
import {
  DEFAULT_REMINDER,
  PRIORITY_OPTIONS,
  TIME_RE,
  TYPE_OPTIONS,
  TYPE_VALUES,
  calendarOptions,
  canModifyEvent,
  combineDateTime,
  endOfDay,
  isWritableCalendar,
  pickWritableCalendarId,
  reminderOptions,
  reminderToValue,
  roundUpToStep,
  splitApiErrors,
  toTimeParam,
  valueToReminder,
} from '../modals/eventFormUtils';
import styles from './EventCreatePage.module.css';

const PLACEHOLDER_TITLE = 'Назва події';
const TYPE_ICONS = { arrangement: 'calendar', reminder: 'bell', task: 'check-square' };
const FLOATING_SLOT = {
  conflict: false,
  status: 'Зроблю, коли буде настрій',
  text: 'Справа житиме в блоці «Колись» і не потрапить у календар, доки не призначиш їй час.',
};
const COLOR_ORDER = ['blue', 'purple', 'green', 'orange', 'pink', 'graphite'];
const TYPE_PREFIX = { task: 'задача ', reminder: 'нагадування ' };
const PREFILL_KEYS = ['date', 'start', 'end', 'calendar', 'title', 'type'];
const FIELD_MAP = {
  title: 'title',
  type: 'type',
  calendar: 'calendar',
  startAt: 'startAt',
  endAt: 'endAt',
  participants: 'participants',
  location: 'location',
  description: 'description',
  priority: 'priority',
  reminderMinutesBefore: 'reminder',
  color: 'color',
};

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function joinNames(names) {
  if (names.length <= 1) return names.join('');
  if (names.length > 3) return `${names.slice(0, 2).join(', ')} і ще ${names.length - 2}`;
  return `${names.slice(0, -1).join(', ')} і ${names[names.length - 1]}`;
}

function endFromStart(startDate, startTime, duration) {
  const start = combineDateTime(startDate, startTime);
  if (!start) return { endDate: startDate, endTime: '' };
  const end = addMinutes(start, duration);
  return { endDate: toDateParam(end), endTime: toTimeParam(end) };
}

function parsePrefill(search, state) {
  const sp = new URLSearchParams(search);
  const prefill = {};
  PREFILL_KEYS.forEach((key) => {
    const value = sp.get(key);
    if (value) prefill[key] = value;
  });
  if (Array.isArray(state?.participants)) prefill.participants = state.participants;
  return prefill;
}

function initialValues({ event, prefill, duration }) {
  if (event) {
    const isFloating = Boolean(event.isFloating);
    const start = event.startAt && !isFloating ? toDate(event.startAt) : null;
    const end = event.endAt ? toDate(event.endAt) : null;
    return {
      title: event.title,
      type: event.type,
      startDate: start ? toDateParam(start) : '',
      startTime: start && !event.allDay ? toTimeParam(start) : '',
      endDate: end ? toDateParam(end) : '',
      endTime: end && !event.allDay ? toTimeParam(end) : '',
      endTouched: true,
      allDay: Boolean(event.allDay) && !isFloating,
      floating: isFloating,
      calendar: event.calendar,
      color: event.color || null,
      participants: event.participants || [],
      reminder: isFloating ? DEFAULT_REMINDER : reminderToValue(event.reminderMinutesBefore),
      priority: event.priority || 'medium',
      location: event.location || '',
      description: event.description || '',
    };
  }
  const hasStart = TIME_RE.test(prefill.start || '');
  const start =
    combineDateTime(prefill.date, hasStart ? prefill.start : '09:00') || roundUpToStep(new Date());
  const startDate = toDateParam(start);
  const startTime = toTimeParam(start);
  const hasEnd = TIME_RE.test(prefill.end || '');
  const defaults = endFromStart(startDate, startTime, duration);
  return {
    title: prefill.title || '',
    type: TYPE_VALUES.includes(prefill.type) ? prefill.type : 'arrangement',
    startDate,
    startTime,
    endDate: hasEnd ? startDate : defaults.endDate,
    endTime: hasEnd ? prefill.end : defaults.endTime,
    endTouched: hasEnd,
    allDay: false,
    floating: false,
    calendar: prefill.calendar || '',
    color: null,
    participants: prefill.participants || [],
    reminder: DEFAULT_REMINDER,
    priority: 'medium',
    location: '',
    description: '',
  };
}

function rightsNote(calendar, isAuthor) {
  if (calendar.myRole !== 'owner') {
    return 'Змінити чи видалити її зможеш ти як автор, а також власник календаря.';
  }
  return isAuthor
    ? 'Видалити її зможеш ти як автор і власник календаря.'
    : 'Змінити чи видалити її можеш ти як власник календаря, а також її автор.';
}

function visibilityNote({ calendar, userId, people, isAuthor }) {
  if (!calendar) return '';
  if (!calendar.isShared) return `Подію в календарі «${calendar.name}» побачиш лише ти.`;
  const others = (calendar.members || [])
    .filter((m) => m.user !== userId)
    .map((m) => people[m.user]?.name || m.name)
    .filter(Boolean);
  const who = others.length ? joinNames(others) : 'усі учасники';
  const verb = others.length === 1 ? 'побачить' : 'побачать';
  return `У спільному календарі «${calendar.name}» подію ${verb} ${who}. ${rightsNote(calendar, isAuthor)}`;
}

function describeAvailability(a) {
  if (a.allDay) {
    return {
      conflict: false,
      status: 'Подія на весь день',
      text: a.count ? `Цього дня ще ${pluralEvents(a.count)}.` : 'Інших подій цього дня немає.',
    };
  }
  const parts = [];
  if (a.prev) {
    const prevEnd = toDate(a.prev.endAt || a.prev.startAt);
    parts.push(`до ${formatTime(prevEnd)} — ${TYPE_PREFIX[a.prev.type] || ''}«${a.prev.title}»`);
  }
  if (a.next) {
    parts.push(
      `після ${formatTime(a.next.startAt)} — ${TYPE_PREFIX[a.next.type] || ''}«${a.next.title}»`,
    );
  }
  const around = parts.length ? capitalize(`${parts.join(', ')}.`) : '';
  if (a.conflict) {
    return {
      conflict: true,
      status: `Перетин з «${a.conflict.title}» ${formatTimeRange(a.conflict.startAt, a.conflict.endAt)}`,
      text: `${around} Обери інший час або зміни тривалість.`.trim(),
    };
  }
  return {
    conflict: false,
    status: 'Цей час вільний',
    text: around ? `${around} Перетинів немає.` : 'Інших подій цього дня немає.',
  };
}

function lockReason(event, calendar) {
  if (event.isInvited) {
    const source = event.sourceCalendar?.name;
    const where = source ? `Це подія з календаря «${source}», куди` : 'Це подія, на яку';
    return `${where} тебе запросили. Змінювати її може автор або власник календаря.`;
  }
  if (!calendar || calendar.isReadOnly || calendar.myRole === 'viewer') {
    return calendar
      ? `У календарі «${calendar.name}» у тебе права лише на перегляд.`
      : 'У тебе немає доступу до календаря цієї події.';
  }
  return `У спільному календарі «${calendar.name}» редактор може змінювати лише власні події.`;
}

function Notice({ title, text, backTo = '/calendar/week' }) {
  return (
    <Card padding="22px" radius={20} gap={10} className={styles.notFound}>
      <h1 className={styles.h1}>{title}</h1>
      <span className={styles.sub}>{text}</span>
      <Link to={backTo} className={styles.back}>
        <Icon name="chevron-left" size={14} />
        Назад до календаря
      </Link>
    </Card>
  );
}

Notice.propTypes = {
  title: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
  backTo: PropTypes.string,
};

function Preview({ event, calendar = null, meta, avatars, note, eyebrow, slot }) {
  return (
    <aside className={styles.aside}>
      <Card padding="18px" radius={18} gap={10}>
        <span className={styles.eyebrow}>Так це виглядатиме</span>
        <EventBlock
          event={event}
          calendar={calendar}
          variant="day"
          meta={meta}
          participants={avatars}
          className={styles.previewBlock}
        />
        <span className={styles.note}>{note}</span>
      </Card>
      <Card variant="dark" padding="18px" radius={18} gap={6}>
        <span className={styles.darkEyebrow}>{eyebrow}</span>
        <span className={cx(styles.status, slot.conflict && styles.statusConflict)}>
          {slot.status}
        </span>
        <span className={styles.darkText}>{slot.text}</span>
      </Card>
    </aside>
  );
}

Preview.propTypes = {
  event: eventShape.isRequired,
  calendar: calendarShape,
  meta: PropTypes.string.isRequired,
  avatars: PropTypes.arrayOf(
    PropTypes.shape({
      initials: PropTypes.string.isRequired,
      color: PropTypes.string,
      name: PropTypes.string,
    }),
  ).isRequired,
  note: PropTypes.string.isRequired,
  eyebrow: PropTypes.string.isRequired,
  slot: PropTypes.shape({
    conflict: PropTypes.bool,
    status: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
  }).isRequired,
};

function EventForm({ event = null, prefill = {} }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { calendars, byId } = useCalendars();
  const people = usePeople();
  const { notifySuccess } = useToast();
  const duration = user?.defaultArrangementDuration ?? 60;
  const writable = useMemo(() => calendars.filter(isWritableCalendar), [calendars]);
  const [form, setForm] = useState(() => initialValues({ event, prefill, duration }));
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const isEdit = Boolean(event);
  const isTask = form.type === 'task';
  const isArrangement = form.type === 'arrangement';
  const isFloating = isTask && form.floating;
  const hasStartTime = TIME_RE.test(form.startTime);
  const allDay = isFloating || form.allDay || (isTask && !hasStartTime);
  const calendarId = pickWritableCalendarId(calendars, form.calendar);
  const calendar = byId[calendarId] || null;
  const calendarColor = calendar?.color || 'graphite';
  const accent = colorVars(form.color || calendarColor);

  const dayRange = useMemo(() => {
    const from = combineDateTime(form.startDate) || combineDateTime(toDateParam(new Date()));
    return { from, to: addDays(from, 1), includeHidden: true };
  }, [form.startDate]);
  const { events: dayEvents, createEvent, saveEvent } = useEvents(dayRange);

  const startAt = useMemo(
    () => (isFloating ? null : combineDateTime(form.startDate, allDay ? '' : form.startTime)),
    [form.startDate, form.startTime, allDay, isFloating],
  );
  const hasEnd = Boolean(form.endDate || form.endTime);
  const endAt = useMemo(() => {
    if (!isArrangement || !startAt) return null;
    if (allDay) {
      const d = combineDateTime(form.endDate || form.startDate);
      return d ? endOfDay(d) : null;
    }
    if (!TIME_RE.test(form.endTime)) return null;
    return combineDateTime(form.endDate || form.startDate, form.endTime);
  }, [isArrangement, allDay, startAt, form.endDate, form.endTime, form.startDate]);

  const availability = useMemo(() => {
    if (!startAt) return null;
    const others = dayEvents.filter((e) => e.id !== event?.id);
    if (allDay) return { allDay: true, count: others.length };
    const timed = others.filter((e) => e.startAt && !e.allDay && e.type !== 'holiday');
    const until = endAt && endAt > startAt ? endAt : addMinutes(startAt, 1);
    const conflict =
      timed.find(
        (e) =>
          e.type === 'arrangement' &&
          Boolean(e.endAt) &&
          intervalsOverlap(startAt, until, e.startAt, e.endAt),
      ) || null;
    const before = timed.filter((e) => toDate(e.endAt || e.startAt) <= startAt);
    return {
      conflict,
      prev: before[before.length - 1] || null,
      next: timed.find((e) => toDate(e.startAt) >= until) || null,
    };
  }, [startAt, endAt, allDay, dayEvents, event]);

  const preview = useMemo(
    () => ({
      id: event?.id || 'preview',
      type: form.type,
      title: form.title.trim() || PLACEHOLDER_TITLE,
      calendar: calendarId,
      creator: event?.creator || user?.id,
      startAt: startAt || undefined,
      endAt: endAt || undefined,
      allDay,
      color: form.color,
      participants: form.participants,
      isCompleted: Boolean(event?.isCompleted),
    }),
    [event, user, form, calendarId, startAt, endAt, allDay],
  );
  const previewAvatars = useMemo(
    () => participantsToAvatars(form.participants, people),
    [form.participants, people],
  );
  const previewTime = allDay ? 'весь день' : startAt && formatTimeRange(startAt, endAt);
  const previewMeta = [
    isFloating ? 'без дедлайну' : null,
    startAt ? previewTime : null,
    calendar?.name,
    form.participants.map((p) => p.name || p.email).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');

  const clearErrors = (...keys) =>
    setErrors((prev) => {
      const drop = new Set(['form', ...keys]);
      return Object.fromEntries(Object.entries(prev).filter(([key]) => !drop.has(key)));
    });
  const set = (patch, ...errorKeys) => {
    setForm((f) => ({ ...f, ...patch }));
    clearErrors(...errorKeys);
  };
  const onStartChange = (patch) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      if (next.endTouched) return next;
      return { ...next, ...endFromStart(next.startDate, next.startTime, duration) };
    });
    clearErrors('startAt', 'endAt');
  };
  const onEndChange = (patch) => set({ ...patch, endTouched: true }, 'endAt');
  const onTypeChange = (type) => {
    setForm((f) => {
      if (type !== 'arrangement' || f.endTime) return { ...f, type };
      return { ...f, type, ...endFromStart(f.startDate, f.startTime, duration) };
    });
    clearErrors('type', 'startAt', 'endAt');
  };
  const onCalendarChange = (id) => {
    setForm((f) => ({ ...f, calendar: id, color: f.color === byId[id]?.color ? null : f.color }));
    clearErrors('calendar');
  };

  const validate = () => {
    const next = {};
    if (!form.title.trim()) next.title = 'Вкажи назву';
    if (!calendarId) next.calendar = 'Немає календаря, у який можна додати подію';
    if (isFloating) return next;
    if (!startAt) next.startAt = isTask ? 'Вкажи дату дедлайну' : 'Вкажи дату';
    else if (!isTask && !allDay && !hasStartTime) {
      next.startAt = 'Вкажи час або познач «Весь день»';
    }
    if (isArrangement && startAt && (allDay || hasEnd)) {
      if (!endAt) next.endAt = 'Вкажи дату й час кінця';
      else if (endAt <= startAt) next.endAt = 'Кінець має бути пізніше за початок';
    }
    return next;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (inFlight.current) return;

    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const dto = {
      title: form.title.trim(),
      type: form.type,
      calendar: calendarId,
      startAt,
      endAt: isArrangement ? endAt : null,
      allDay,
      color: form.color,
      location: form.location.trim(),
      description: form.description.trim(),
      reminderMinutesBefore: valueToReminder(form.reminder),
      priority: form.priority,
      participants: form.participants,
    };
    if (isTask || event?.isFloating) dto.isFloating = isFloating;

    inFlight.current = true;
    setIsSubmitting(true);
    try {
      if (isEdit) await saveEvent(event.id, dto);
      else await createEvent(dto);
      notifySuccess(isEdit ? 'Зміни збережено' : 'Подію створено');
      if (isMounted.current) {
        navigate(isFloating ? '/tasks' : `/calendar/day?date=${toDateParam(startAt)}`);
      }
    } catch (err) {
      inFlight.current = false;
      if (!isMounted.current) return;
      const { fields, form: formError } = splitApiErrors(parseApiError(err), FIELD_MAP);
      setErrors(formError ? { ...fields, form: formError } : fields);
      setIsSubmitting(false);
    }
  };

  const heading = isEdit ? 'Редагувати подію' : 'Нова подія';
  const submitLabel = isEdit ? 'Зберегти' : 'Створити подію';
  const backTo = `/calendar/week${form.startDate ? `?date=${form.startDate}` : ''}`;
  const colorOptions = COLOR_ORDER.filter((k) => k !== calendarColor);
  const datedEyebrow = startAt
    ? `${formatDate(startAt, 'weekday-short')} · ${allDay ? 'весь день' : formatTime(startAt)}`
    : 'Дата не вказана';
  const eyebrow = isFloating ? 'Без дедлайну' : datedEyebrow;
  const datelessSlot = isFloating
    ? FLOATING_SLOT
    : {
        conflict: false,
        status: isTask ? 'Вкажи дату дедлайну' : 'Вкажи дату',
        text: isTask
          ? 'Коли буде дата, покажемо, що ще заплановано на цей день.'
          : 'Коли буде дата, перевіримо, чи вільний цей час.',
      };
  const slot = availability ? describeAvailability(availability) : datelessSlot;
  const note = visibilityNote({
    calendar,
    userId: user?.id,
    people,
    isAuthor: !event || event.creator === user?.id,
  });

  return (
    <>
      <Link to={backTo} className={styles.back}>
        <Icon name="chevron-left" size={14} />
        Назад до календаря
      </Link>

      <div className={styles.layout}>
        <Card
          as="form"
          aria-label={heading}
          noValidate
          onSubmit={onSubmit}
          padding="22px"
          radius={20}
          gap={18}
          className={styles.card}
        >
          <header className={styles.head}>
            <span
              className={styles.headIcon}
              style={{ background: accent.tint, color: accent.text }}
              aria-hidden="true"
            >
              <Icon name={TYPE_ICONS[form.type]} size={20} />
            </span>
            <h1 className={styles.h1}>{heading}</h1>
          </header>

          <Field label="Назва" htmlFor="ev-title" error={errors.title}>
            <Input
              id="ev-title"
              type="text"
              maxLength={120}
              value={form.title}
              onChange={(e) => set({ title: e.target.value }, 'title')}
              placeholder="Напр., Дзвінок з ментором"
              invalid={Boolean(errors.title)}
              className={styles.titleInput}
            />
          </Field>

          <Field label="Тип" error={errors.type}>
            <div role="radiogroup" aria-label="Тип події" className={styles.types}>
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={form.type === t.value}
                  className={cx(styles.typeBtn, form.type === t.value && styles.typeActive)}
                  onClick={() => onTypeChange(t.value)}
                >
                  <span className={styles.typeIcon} aria-hidden="true">
                    <Icon name={TYPE_ICONS[t.value]} size={15} />
                  </span>
                  <span className={styles.typeTitle}>{t.label}</span>
                </button>
              ))}
            </div>
          </Field>

          {isTask ? (
            <label htmlFor="ev-floating" className={styles.check}>
              <Checkbox
                id="ev-floating"
                checked={form.floating}
                onChange={(v) => set({ floating: v }, 'startAt', 'reminder')}
                size={15}
              />
              Без дати (зроблю колись)
            </label>
          ) : null}

          <h2 className={styles.sectionLabel}>
            <Icon name="clock" size={13} />
            Коли
          </h2>

          <div className={styles.grid2}>
            {isFloating ? null : (
              <Field
                label={isTask ? 'Дедлайн' : 'Початок'}
                htmlFor="ev-start-date"
                error={errors.startAt}
              >
                <div className={styles.when}>
                  <Input
                    id="ev-start-date"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => onStartChange({ startDate: e.target.value })}
                    invalid={Boolean(errors.startAt)}
                  />
                  {form.allDay ? null : (
                    <Input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => onStartChange({ startTime: e.target.value })}
                      aria-label="Час початку"
                      invalid={Boolean(errors.startAt)}
                      className={styles.time}
                    />
                  )}
                </div>
              </Field>
            )}
            {isArrangement ? (
              <Field label="Кінець" htmlFor="ev-end-date" error={errors.endAt}>
                <div className={styles.when}>
                  <Input
                    id="ev-end-date"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => onEndChange({ endDate: e.target.value })}
                    invalid={Boolean(errors.endAt)}
                  />
                  {form.allDay ? null : (
                    <Input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => onEndChange({ endTime: e.target.value })}
                      aria-label="Час кінця"
                      invalid={Boolean(errors.endAt)}
                      className={styles.time}
                    />
                  )}
                </div>
              </Field>
            ) : null}
            {isTask ? (
              <Field label="Пріоритет" htmlFor="ev-priority" error={errors.priority}>
                <Select
                  id="ev-priority"
                  options={PRIORITY_OPTIONS}
                  value={form.priority}
                  onChange={(v) => set({ priority: v }, 'priority')}
                />
              </Field>
            ) : null}
          </div>

          {isFloating ? null : (
            <label htmlFor="ev-allday" className={styles.check}>
              <Checkbox
                id="ev-allday"
                checked={form.allDay}
                onChange={(v) => set({ allDay: v }, 'startAt', 'endAt')}
                size={15}
              />
              Весь день
            </label>
          )}

          <h2 className={styles.sectionLabel}>
            <Icon name="users" size={13} />
            Календар і учасники
          </h2>

          <div className={styles.grid2}>
            <Field label="Календар" htmlFor="ev-calendar" error={errors.calendar}>
              <Select
                id="ev-calendar"
                options={calendarOptions(writable)}
                value={calendarId}
                onChange={onCalendarChange}
                leading={
                  <span
                    className={styles.calDot}
                    style={{ background: colorVars(calendarColor).base }}
                  />
                }
              />
            </Field>
            <Field label="Колір події" error={errors.color}>
              <div className={styles.colorRow}>
                <ColorPicker
                  value={form.color}
                  onChange={(c) => set({ color: c }, 'color')}
                  options={colorOptions}
                  inherit={{ label: 'Колір календаря', color: calendarColor }}
                  label="Колір події"
                />
              </div>
            </Field>
          </div>

          <Field label="Учасники" htmlFor="ev-guests">
            <ParticipantsInput
              id="ev-guests"
              value={form.participants}
              onChange={(list) => set({ participants: list }, 'participants')}
              error={errors.participants || null}
              disabled={isSubmitting}
            />
          </Field>

          <h2 className={styles.sectionLabel}>
            <Icon name="text" size={13} />
            Деталі
          </h2>

          <div className={styles.grid2}>
            {isFloating ? null : (
              <Field label="Нагадати" htmlFor="ev-reminder" error={errors.reminder}>
                <Select
                  id="ev-reminder"
                  options={reminderOptions(form.reminder)}
                  value={form.reminder}
                  onChange={(v) => set({ reminder: v }, 'reminder')}
                  leading={<Icon name="bell" size={14} />}
                />
              </Field>
            )}
            <Field label="Місце або посилання" htmlFor="ev-place" error={errors.location}>
              <Input
                id="ev-place"
                type="text"
                maxLength={200}
                value={form.location}
                onChange={(e) => set({ location: e.target.value }, 'location')}
                placeholder="Google Meet, адреса, кімната"
                invalid={Boolean(errors.location)}
              />
            </Field>
          </div>

          <Field label="Опис" htmlFor="ev-desc" error={errors.description}>
            <Textarea
              id="ev-desc"
              rows={3}
              maxLength={2000}
              value={form.description}
              onChange={(e) => set({ description: e.target.value }, 'description')}
              placeholder="Що обговорити, що підготувати…"
            />
          </Field>

          {errors.form ? (
            <span className={styles.formError} role="alert">
              {errors.form}
            </span>
          ) : null}

          <div className={styles.footer}>
            <PillButton type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Зберігаємо…' : submitLabel}
            </PillButton>
            <PillButton variant="secondary" size="lg" to={backTo}>
              Скасувати
            </PillButton>
          </div>
        </Card>

        <Preview
          event={preview}
          calendar={calendar}
          meta={previewMeta}
          avatars={previewAvatars}
          note={note}
          eyebrow={eyebrow}
          slot={slot}
        />
      </div>
    </>
  );
}

EventForm.propTypes = {
  event: eventShape,
  prefill: PropTypes.shape({
    date: PropTypes.string,
    start: PropTypes.string,
    end: PropTypes.string,
    calendar: PropTypes.string,
    title: PropTypes.string,
    type: PropTypes.string,
    participants: PropTypes.arrayOf(participantShape),
  }),
};

export default function EventCreatePage() {
  const { id } = useParams();
  const { search, state } = useLocation();
  const { getEvent } = useEvents();
  const { byId } = useCalendars();
  const { user } = useAuth();
  const prefill = useMemo(() => parsePrefill(search, state), [search, state]);
  const event = id ? getEvent(id) : null;

  if (id && !event) {
    return (
      <Notice title="Подію не знайдено" text="Можливо, її видалили або посилання застаріло." />
    );
  }

  const calendar = event ? byId[event.calendar] || null : null;
  if (event && !canModifyEvent(event, calendar, user?.id)) {
    const backTo = event.startAt
      ? `/calendar/week?date=${toDateParam(event.startAt)}`
      : '/calendar/week';
    return (
      <Notice
        title="Цю подію не можна редагувати"
        text={lockReason(event, calendar)}
        backTo={backTo}
      />
    );
  }

  return <EventForm key={id || 'new'} event={event} prefill={prefill} />;
}
