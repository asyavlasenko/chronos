// Дизайн: design/screens/10-event-create.html
// Нова подія / редагування (/events/new, /events/:id): форма ліворуч, праворуч — живе прев'ю блоку
// і перевірка, чи вільний час. Prefill — з location.state або ?date=&start=&end=&calendar=&title=&type=.
import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useEvents from '../hooks/useEvents';
import useCalendars from '../hooks/useCalendars';
import { people } from '../mocks/data';
import cx from '../utils/cx';
import { colorVars } from '../utils/colors';
import {
  addDays,
  formatDate,
  formatDuration,
  formatTime,
  formatTimeRange,
  intervalsOverlap,
  toDate,
  toDateParam,
} from '../utils/dates';
import { addMinutes, participantsToAvatars } from '../utils/eventStats';
import { pluralEvents } from '../utils/text';
import { eventShape, participantShape } from '../utils/propTypes';
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
  PRIORITY_OPTIONS,
  REMINDER_OPTIONS,
  TIME_RE,
  TYPE_OPTIONS,
  TYPE_VALUES,
  calendarOptions,
  combineDateTime,
  endOfDay,
  isWritableCalendar,
  reminderToValue,
  roundUpToStep,
  toTimeParam,
  valueToReminder,
} from '../modals/eventFormUtils';
import styles from './EventCreatePage.module.css';

const SUBTITLE = "Обов'язкові лише назва і дата. Решту можна додати пізніше.";
const GUESTS_HINT =
  "Кожному надішлемо лист із запрошенням; подія з'явиться в їхньому календарі після підтвердження.";
const TIP = 'Підказка: клік на вільний час у календарі створює подію ще швидше';
const PLACEHOLDER_TITLE = 'Назва події';
// Порядок кружечків як у мокапі; колір самого календаря не дублюємо — він є як «Колір календаря».
const COLOR_ORDER = ['blue', 'purple', 'green', 'orange', 'pink', 'graphite'];
const TYPE_PREFIX = { task: 'задача ', reminder: 'нагадування ' };

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** 'Максим і Оля' · 'Максим, Оля і Ірина' */
function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} і ${names[names.length - 1]}`;
}

/** Кінець = початок + тривалість за замовчуванням (поки користувач не чіпав кінець). */
function endFromStart(startDate, startTime, duration) {
  const start = combineDateTime(startDate, startTime);
  if (!start) return { endDate: startDate, endTime: '' };
  const end = addMinutes(start, duration);
  return { endDate: toDateParam(end), endTime: toTimeParam(end) };
}

/** ?date=&start=&end=&calendar=&title=&type= + location.state (учасники з модалки). */
function parsePrefill(search, state) {
  const sp = new URLSearchParams(search);
  const fromQuery = {};
  ['date', 'start', 'end', 'calendar', 'title', 'type'].forEach((key) => {
    const v = sp.get(key);
    if (v) fromQuery[key] = v;
  });
  return { ...fromQuery, ...(state || {}) };
}

/** Початкові значення форми: з події (режим edit), із prefill або за замовчуванням. */
function initialValues({ event, prefill, writable, duration }) {
  const fallbackCalendar = (writable.find((c) => c.isMain) || writable[0])?.id || '';
  if (event) {
    const start = event.startAt ? toDate(event.startAt) : null;
    const end = event.endAt ? toDate(event.endAt) : null;
    return {
      title: event.title,
      type: event.type,
      startDate: start ? toDateParam(start) : '',
      startTime: start && !event.allDay ? toTimeParam(start) : '',
      endDate: end ? toDateParam(end) : '',
      endTime: end && !event.allDay ? toTimeParam(end) : '',
      endTouched: true,
      allDay: Boolean(event.allDay),
      calendar: event.calendar,
      color: event.color || null,
      participants: event.participants || [],
      reminder: reminderToValue(event.reminderMinutesBefore),
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
    calendar: writable.some((c) => c.id === prefill.calendar) ? prefill.calendar : fallbackCalendar,
    color: null,
    participants: prefill.participants || [],
    reminder: '10',
    priority: 'medium',
    location: '',
    description: '',
  };
}

/** «У спільному календарі «Робота» подію побачать Максим і Оля. Видалити її зможеш ти як автор і власник календаря.» */
function visibilityNote(calendar, userId) {
  if (!calendar) return '';
  if (!calendar.isShared) return `Подію в календарі «${calendar.name}» побачиш лише ти.`;
  const others = (calendar.members || []).filter((m) => m.user !== userId).map((m) => m.name);
  const who = others.length ? joinNames(others) : 'усі учасники';
  return `У спільному календарі «${calendar.name}» подію побачать ${who}. Видалити її зможеш ти як автор і власник календаря.`;
}

/** Статус і підпис для темної картки: «Цей час вільний» або «Перетин з «…» 14:30 – 16:00». */
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

function EventForm({ event = null, prefill = {} }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { calendars, byId } = useCalendars();
  const duration = user?.defaultArrangementDuration ?? 60;
  const writable = useMemo(() => calendars.filter(isWritableCalendar), [calendars]);
  const [form, setForm] = useState(() => initialValues({ event, prefill, writable, duration }));
  const [errors, setErrors] = useState({});

  const isEdit = Boolean(event);
  const isTask = form.type === 'task';
  const isArrangement = form.type === 'arrangement';
  const allDay = form.allDay || (isTask && !form.startTime);
  const calendar = byId[form.calendar] || writable[0] || null;
  const calendarColor = calendar?.color || 'graphite';

  // Події обраного дня — для «цей час вільний» і сусідніх подій (усі календарі, і приховані теж).
  const dayRange = useMemo(() => {
    const from = combineDateTime(form.startDate) || combineDateTime(toDateParam(new Date()));
    return { from, to: addDays(from, 1), includeHidden: true };
  }, [form.startDate]);
  const { events: dayEvents, createEvent, updateEvent } = useEvents(dayRange);

  const startAt = useMemo(
    () => combineDateTime(form.startDate, allDay ? '' : form.startTime),
    [form.startDate, form.startTime, allDay],
  );
  const endAt = useMemo(() => {
    if (!isArrangement || !startAt) return null;
    if (allDay) {
      const d = combineDateTime(form.endDate || form.startDate);
      return d ? endOfDay(d) : null;
    }
    return combineDateTime(form.endDate, form.endTime);
  }, [isArrangement, allDay, startAt, form.endDate, form.endTime, form.startDate]);

  const availability = useMemo(() => {
    if (!startAt) return null;
    const others = dayEvents.filter((e) => e.id !== event?.id);
    if (allDay) return { allDay: true, count: others.length };
    const timed = others.filter((e) => e.startAt && !e.allDay && e.type !== 'holiday');
    const until = endAt && endAt > startAt ? endAt : addMinutes(startAt, 1);
    const conflict =
      timed.find(
        (e) => e.type === 'arrangement' && intervalsOverlap(startAt, until, e.startAt, e.endAt),
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
      calendar: form.calendar,
      creator: event?.creator || user?.id,
      startAt: startAt || undefined,
      endAt: endAt || undefined,
      allDay,
      color: form.color,
      participants: form.participants,
      isCompleted: Boolean(event?.isCompleted),
    }),
    [event, user, form, startAt, endAt, allDay],
  );
  const previewAvatars = useMemo(
    () => participantsToAvatars(form.participants, people),
    [form.participants],
  );
  const previewTime = allDay ? 'весь день' : startAt && formatTimeRange(startAt, endAt);
  const previewMeta = [
    previewTime,
    calendar?.name,
    form.participants.map((p) => p.name || p.email).join(', '),
  ]
    .filter(Boolean)
    .join(' · ');

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const onStartChange = (patch) =>
    setForm((f) => {
      const next = { ...f, ...patch };
      if (next.endTouched) return next;
      return { ...next, ...endFromStart(next.startDate, next.startTime, duration) };
    });
  const onEndChange = (patch) => set({ ...patch, endTouched: true });
  const onTypeChange = (type) =>
    setForm((f) => {
      if (type !== 'arrangement' || f.endTime) return { ...f, type };
      return { ...f, type, ...endFromStart(f.startDate, f.startTime, duration) };
    });
  const onCalendarChange = (id) =>
    setForm((f) => ({ ...f, calendar: id, color: f.color === byId[id]?.color ? null : f.color }));

  const onSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.title.trim()) next.title = 'Вкажи назву';
    if (!startAt) next.start = 'Вкажи дату';
    if (isArrangement && startAt) {
      if (!endAt) next.end = 'Вкажи дату й час кінця';
      else if (endAt <= startAt) next.end = 'Кінець має бути пізніше за початок';
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    const dto = {
      title: form.title.trim(),
      type: form.type,
      calendar: form.calendar,
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
    if (isEdit) updateEvent(event.id, dto);
    else createEvent(dto);
    navigate(`/calendar/day?date=${toDateParam(startAt)}`);
  };

  const heading = isEdit ? 'Редагувати подію' : 'Нова подія';
  const backTo = `/calendar/week${form.startDate ? `?date=${form.startDate}` : ''}`;
  const colorOptions = COLOR_ORDER.filter((k) => k !== calendarColor);
  const eyebrow = startAt
    ? `${formatDate(startAt, 'weekday-short')} · ${allDay ? 'весь день' : formatTime(startAt)}`
    : 'Дата не вказана';
  const slot = availability
    ? describeAvailability(availability)
    : {
        conflict: false,
        status: 'Вкажи дату',
        text: 'Коли буде дата, перевіримо, чи вільний цей час.',
      };

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
          <div>
            <h1 className={styles.h1}>{heading}</h1>
            <span className={styles.sub}>{SUBTITLE}</span>
          </div>

          <Field label="Назва" htmlFor="ev-title" error={errors.title}>
            <Input
              id="ev-title"
              type="text"
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Напр., Дзвінок з ментором"
              invalid={Boolean(errors.title)}
              className={styles.titleInput}
            />
          </Field>

          <Field label="Тип">
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
                  <span className={styles.typeTitle}>{t.label}</span>
                  <span className={styles.typeHint}>{t.hint}</span>
                </button>
              ))}
            </div>
          </Field>

          <div className={styles.grid2}>
            <Field
              label={isTask ? 'Дедлайн' : 'Початок'}
              htmlFor="ev-start-date"
              error={errors.start}
            >
              <div className={styles.when}>
                <Input
                  id="ev-start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => onStartChange({ startDate: e.target.value })}
                  invalid={Boolean(errors.start)}
                />
                {form.allDay ? null : (
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => onStartChange({ startTime: e.target.value })}
                    aria-label="Час початку"
                    className={styles.time}
                  />
                )}
              </div>
            </Field>
            {isArrangement ? (
              <Field
                label="Кінець"
                htmlFor="ev-end-date"
                error={errors.end}
                hint={
                  <>
                    Тривалість {formatDuration(duration)} — як у налаштуваннях.{' '}
                    <Link to="/profile" className={styles.hintLink}>
                      Змінити
                    </Link>
                  </>
                }
              >
                <div className={styles.when}>
                  <Input
                    id="ev-end-date"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => onEndChange({ endDate: e.target.value })}
                    invalid={Boolean(errors.end)}
                  />
                  {form.allDay ? null : (
                    <Input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => onEndChange({ endTime: e.target.value })}
                      aria-label="Час кінця"
                      invalid={Boolean(errors.end)}
                      className={styles.time}
                    />
                  )}
                </div>
              </Field>
            ) : null}
            {isTask ? (
              <Field label="Пріоритет" htmlFor="ev-priority">
                <Select
                  id="ev-priority"
                  options={PRIORITY_OPTIONS}
                  value={form.priority}
                  onChange={(v) => set({ priority: v })}
                />
              </Field>
            ) : null}
          </div>

          <label htmlFor="ev-allday" className={styles.check}>
            <Checkbox
              id="ev-allday"
              checked={form.allDay}
              onChange={(v) => set({ allDay: v })}
              size={15}
            />
            Весь день
          </label>

          <div className={styles.grid2}>
            <Field label="Календар" htmlFor="ev-calendar">
              <Select
                id="ev-calendar"
                options={calendarOptions(writable)}
                value={form.calendar}
                onChange={onCalendarChange}
                leading={
                  <span
                    className={styles.calDot}
                    style={{ background: colorVars(calendarColor).base }}
                  />
                }
              />
            </Field>
            <Field label="Колір події">
              <div className={styles.colorRow}>
                <ColorPicker
                  value={form.color}
                  onChange={(c) => set({ color: c })}
                  options={colorOptions}
                  inherit={{ label: 'Колір календаря', color: calendarColor }}
                  label="Колір події"
                />
              </div>
            </Field>
          </div>

          <Field label="Учасники" htmlFor="ev-guests" hint={GUESTS_HINT}>
            <ParticipantsInput
              id="ev-guests"
              value={form.participants}
              onChange={(list) => set({ participants: list })}
            />
          </Field>

          <div className={styles.grid2}>
            <Field label="Нагадати" htmlFor="ev-reminder">
              <Select
                id="ev-reminder"
                options={REMINDER_OPTIONS}
                value={form.reminder}
                onChange={(v) => set({ reminder: v })}
                leading={<Icon name="bell" size={14} />}
              />
            </Field>
            <Field label="Місце або посилання" htmlFor="ev-place">
              <Input
                id="ev-place"
                type="text"
                value={form.location}
                onChange={(e) => set({ location: e.target.value })}
                placeholder="Google Meet, адреса, кімната"
              />
            </Field>
          </div>

          <Field label="Опис" htmlFor="ev-desc">
            <Textarea
              id="ev-desc"
              rows={3}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Що обговорити, що підготувати…"
            />
          </Field>

          <div className={styles.footer}>
            <PillButton type="submit" size="lg">
              {isEdit ? 'Зберегти' : 'Створити подію'}
            </PillButton>
            <PillButton variant="secondary" size="lg" to={backTo}>
              Скасувати
            </PillButton>
            <span className={styles.tip}>{TIP}</span>
          </div>
        </Card>

        <aside className={styles.aside}>
          <Card padding="18px" radius={18} gap={10}>
            <span className={styles.eyebrow}>Так це виглядатиме</span>
            <EventBlock
              event={preview}
              calendar={calendar}
              variant="day"
              meta={previewMeta}
              participants={previewAvatars}
              className={styles.previewBlock}
            />
            <span className={styles.note}>{visibilityNote(calendar, user?.id)}</span>
          </Card>
          <Card variant="dark" padding="18px" radius={18} gap={6}>
            <span className={styles.darkEyebrow}>{eyebrow}</span>
            <span className={cx(styles.status, slot.conflict && styles.statusConflict)}>
              {slot.status}
            </span>
            <span className={styles.darkText}>{slot.text}</span>
          </Card>
        </aside>
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
  const prefill = useMemo(() => parsePrefill(search, state), [search, state]);
  const event = id ? getEvent(id) : null;

  if (id && !event) {
    return (
      <Card padding="22px" radius={20} gap={10} className={styles.notFound}>
        <h1 className={styles.h1}>Подію не знайдено</h1>
        <span className={styles.sub}>Можливо, її видалили або посилання застаріло.</span>
        <Link to="/calendar/week" className={styles.back}>
          <Icon name="chevron-left" size={14} />
          Назад до календаря
        </Link>
      </Card>
    );
  }

  return <EventForm key={id || 'new'} event={event} prefill={prefill} />;
}
