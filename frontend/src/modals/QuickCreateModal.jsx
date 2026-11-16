import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { parseApiError } from '../api/errors';
import useModals from '../hooks/useModals';
import useEvents from '../hooks/useEvents';
import useCalendars from '../hooks/useCalendars';
import useAuth from '../hooks/useAuth';
import useToast from '../hooks/useToast';
import cx from '../utils/cx';
import { colorVars } from '../utils/colors';
import { formatDate, toDate, toDateParam } from '../utils/dates';
import { addMinutes } from '../utils/eventStats';
import { dateLike } from '../utils/propTypes';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import SegmentedControl from '../components/ui/SegmentedControl';
import PillButton from '../components/ui/PillButton';
import IconButton from '../components/ui/IconButton';
import Icon from '../components/ui/Icon';
import ParticipantsInput from './ParticipantsInput';
import {
  TIME_RE,
  TYPE_OPTIONS,
  calendarOptions,
  combineDateTime,
  isWritableCalendar,
  pickWritableCalendarId,
  roundUpToStep,
  splitApiErrors,
  toTimeParam,
} from './eventFormUtils';
import styles from './QuickCreateModal.module.css';

const TYPE_SEGMENTS = TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label }));
const TITLE_SELECTOR = 'input[name="title"]';
const FIELD_MAP = {
  title: 'title',
  startAt: 'time',
  endAt: 'time',
  calendar: 'calendar',
  participants: 'participants',
};

function QuickCreateForm({ initial, onClose }) {
  const { createEvent } = useEvents();
  const { calendars, byId } = useCalendars();
  const { user } = useAuth();
  const { notifyError } = useToast();
  const duration = user?.defaultArrangementDuration ?? 60;
  const isMounted = useRef(true);
  const inFlight = useRef(false);

  const [form, setForm] = useState(() => {
    const start = initial.startAt
      ? toDate(initial.startAt)
      : roundUpToStep(initial.date || new Date());
    const end = initial.endAt ? toDate(initial.endAt) : addMinutes(start, duration);
    return {
      title: '',
      type: 'arrangement',
      date: toDateParam(start),
      start: toTimeParam(start),
      end: toTimeParam(end),
      endTouched: Boolean(initial.endAt),
      calendar: initial.calendarId || '',
      participants: [],
      showGuests: false,
    };
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const writable = calendars.filter(isWritableCalendar);
  const calendarId = pickWritableCalendarId(calendars, form.calendar);
  const calendar = byId[calendarId] || null;
  const isArrangement = form.type === 'arrangement';
  const isTask = form.type === 'task';
  const headerDate = combineDateTime(form.date) || toDate(initial.date || new Date());

  const clearErrors = (...keys) =>
    setErrors((prev) => {
      const drop = new Set(['form', ...keys]);
      return Object.fromEntries(Object.entries(prev).filter(([key]) => !drop.has(key)));
    });
  const set = (patch, ...errorKeys) => {
    setForm((f) => ({ ...f, ...patch }));
    clearErrors(...errorKeys);
  };
  const onStartChange = (start) => {
    setForm((f) => {
      if (f.endTouched) return { ...f, start };
      const startAt = combineDateTime(f.date, start);
      return { ...f, start, end: startAt ? toTimeParam(addMinutes(startAt, duration)) : f.end };
    });
    clearErrors('time');
  };

  const validate = () => {
    const next = {};
    const title = form.title.trim();
    const hasTime = TIME_RE.test(form.start);
    const startAt = combineDateTime(form.date, hasTime ? form.start : '');
    let endAt = null;

    if (!title) next.title = 'Вкажи назву';
    if (!calendarId) next.calendar = 'Немає календаря, у який можна додати подію';
    if (!startAt) next.time = 'Вкажи дату';
    else if (!hasTime && !isTask) next.time = 'Вкажи час початку';
    else if (isArrangement && form.end) {
      endAt = combineDateTime(form.date, form.end);
      if (endAt <= startAt) next.time = 'Кінець має бути пізніше за початок';
    }

    return {
      next,
      dto: {
        title,
        type: form.type,
        calendar: calendarId,
        startAt,
        endAt,
        allDay: !hasTime,
        participants: form.participants,
      },
    };
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (inFlight.current) return;

    const { next, dto } = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    inFlight.current = true;
    setIsSubmitting(true);
    try {
      await createEvent(dto);
      if (isMounted.current) onClose();
    } catch (err) {
      inFlight.current = false;
      if (!isMounted.current) {
        notifyError(err);
        return;
      }
      const { fields, form: formError } = splitApiErrors(parseApiError(err), FIELD_MAP);
      setErrors(formError ? { ...fields, form: formError } : fields);
      if (fields.participants) setForm((f) => ({ ...f, showGuests: true }));
      setIsSubmitting(false);
    }
  };

  const moreSearch = new URLSearchParams();
  [
    ['date', form.date],
    ['start', form.start],
    ['end', isArrangement ? form.end : ''],
    ['calendar', calendarId],
    ['title', form.title.trim()],
    ['type', form.type],
  ].forEach(([key, value]) => {
    if (value) moreSearch.set(key, value);
  });

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={styles.head}>
        <span className={styles.eyebrow}>
          Нова подія · {formatDate(headerDate, 'weekday-short')}
        </span>
        <IconButton
          icon="x"
          label="Закрити"
          size="sm"
          variant="muted"
          iconSize={14}
          onClick={onClose}
        />
      </div>

      <div className={styles.fieldCol}>
        <Input
          name="title"
          type="text"
          maxLength={120}
          value={form.title}
          onChange={(e) => set({ title: e.target.value }, 'title')}
          placeholder="Назва події"
          aria-label="Назва події"
          aria-invalid={errors.title ? true : undefined}
          className={cx(styles.titleInput, errors.title && styles.titleError)}
        />
        {errors.title ? (
          <span className={styles.error} role="alert">
            {errors.title}
          </span>
        ) : null}
      </div>

      <SegmentedControl
        role="radiogroup"
        label="Тип"
        bg="muted"
        size="sm"
        stretch
        options={TYPE_SEGMENTS}
        value={form.type}
        onChange={(type) => set({ type }, 'time')}
      />

      <div className={styles.fieldCol}>
        <div className={styles.timeRow}>
          <Icon name="clock" size={16} className={styles.clock} />
          <Input
            type="date"
            aria-label="Дата"
            value={form.date}
            onChange={(e) => set({ date: e.target.value }, 'time')}
            invalid={Boolean(errors.time)}
            className={styles.date}
          />
          <Input
            type="time"
            aria-label="Початок"
            value={form.start}
            onChange={(e) => onStartChange(e.target.value)}
            invalid={Boolean(errors.time)}
            className={styles.time}
          />
          {isArrangement ? (
            <>
              <span className={styles.dash}>–</span>
              <Input
                type="time"
                aria-label="Кінець"
                value={form.end}
                onChange={(e) => set({ end: e.target.value, endTouched: true }, 'time')}
                invalid={Boolean(errors.time)}
                className={styles.time}
              />
            </>
          ) : null}
        </div>
        {errors.time ? (
          <span className={styles.error} role="alert">
            {errors.time}
          </span>
        ) : null}
      </div>

      <div className={styles.fieldCol}>
        <div className={styles.calRow}>
          <span className={styles.dotWrap}>
            <span
              className={styles.dot}
              style={{ background: colorVars(calendar?.color || 'graphite').base }}
            />
          </span>
          <Select
            aria-label="Календар"
            options={calendarOptions(writable)}
            value={calendarId}
            onChange={(v) => set({ calendar: v }, 'calendar')}
            className={styles.calSelect}
          />
          <PillButton
            variant="secondary"
            shape="rounded"
            size="lg"
            icon="users"
            aria-expanded={form.showGuests}
            onClick={() => set({ showGuests: !form.showGuests })}
          >
            Учасники
          </PillButton>
        </div>
        {errors.calendar ? (
          <span className={styles.error} role="alert">
            {errors.calendar}
          </span>
        ) : null}
      </div>

      {form.showGuests ? (
        <ParticipantsInput
          value={form.participants}
          onChange={(list) => set({ participants: list }, 'participants')}
          error={errors.participants || null}
          disabled={isSubmitting}
        />
      ) : null}

      {errors.form ? (
        <span className={styles.error} role="alert">
          {errors.form}
        </span>
      ) : null}

      <div className={styles.footer}>
        <PillButton type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'Створюємо…' : 'Створити'}
        </PillButton>
        <Link
          to={{ pathname: '/events/new', search: `?${moreSearch}` }}
          state={{ participants: form.participants }}
          onClick={onClose}
          className={styles.more}
        >
          Більше опцій →
        </Link>
        <span className={styles.keys}>Enter — створити · Esc — закрити</span>
      </div>
    </form>
  );
}

QuickCreateForm.propTypes = {
  initial: PropTypes.shape({
    date: dateLike,
    startAt: dateLike,
    endAt: dateLike,
    calendarId: PropTypes.string,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default function QuickCreateModal() {
  const { quickCreate, closeQuickCreate } = useModals();
  if (!quickCreate) return null;
  return (
    <Modal
      open
      onClose={closeQuickCreate}
      label="Швидке створення події"
      width={480}
      top={130}
      padding={20}
      gap={14}
      initialFocus={TITLE_SELECTOR}
    >
      <QuickCreateForm initial={quickCreate} onClose={closeQuickCreate} />
    </Modal>
  );
}
