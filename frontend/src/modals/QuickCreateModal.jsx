// Дизайн: design/screens/11-event-quick-modal.html
// Швидке створення по кліку на слот (480px, top 130): назва з підкресленням, тип, дата/час,
// календар, учасники, «Створити» (Enter), «Більше опцій →» переносить введене на /events/new.
import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import useModals from '../hooks/useModals';
import useEvents from '../hooks/useEvents';
import useCalendars from '../hooks/useCalendars';
import useAuth from '../hooks/useAuth';
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
  TYPE_OPTIONS,
  calendarOptions,
  combineDateTime,
  isWritableCalendar,
  roundUpToStep,
  toTimeParam,
} from './eventFormUtils';
import styles from './QuickCreateModal.module.css';

const TYPE_SEGMENTS = TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label }));

function QuickCreateForm({ initial, onClose }) {
  const { createEvent } = useEvents();
  const { calendars, byId } = useCalendars();
  const { user } = useAuth();
  const duration = user?.defaultArrangementDuration ?? 60;
  const formRef = useRef(null);

  const [form, setForm] = useState(() => {
    const writable = calendars.filter(isWritableCalendar);
    const start = initial.startAt
      ? toDate(initial.startAt)
      : roundUpToStep(initial.date || new Date());
    const end = initial.endAt ? toDate(initial.endAt) : addMinutes(start, duration);
    const fallback = (writable.find((c) => c.isMain) || writable[0])?.id || '';
    return {
      title: '',
      type: 'arrangement',
      date: toDateParam(start),
      start: toTimeParam(start),
      end: toTimeParam(end),
      endTouched: Boolean(initial.endAt),
      calendar: writable.some((c) => c.id === initial.calendarId) ? initial.calendarId : fallback,
      participants: [],
      showGuests: false,
    };
  });
  const [errors, setErrors] = useState({});

  // Modal сам фокусує перший елемент (це кнопка «Закрити»); переносимо фокус на назву після нього.
  useEffect(() => {
    const t = setTimeout(() => formRef.current?.elements.namedItem('title')?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  const writable = calendars.filter(isWritableCalendar);
  const calendar = byId[form.calendar] || null;
  const isArrangement = form.type === 'arrangement';
  const headerDate = combineDateTime(form.date) || toDate(initial.date || new Date());

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const onStartChange = (start) =>
    setForm((f) => {
      if (f.endTouched) return { ...f, start };
      const startAt = combineDateTime(f.date, start);
      return { ...f, start, end: startAt ? toTimeParam(addMinutes(startAt, duration)) : f.end };
    });

  const onSubmit = (e) => {
    e.preventDefault();
    const next = {};
    const title = form.title.trim();
    if (!title) next.title = 'Вкажи назву';
    const startAt = combineDateTime(form.date, form.start);
    if (!startAt) next.time = 'Вкажи дату й час';
    let endAt = null;
    if (isArrangement && startAt) {
      endAt = combineDateTime(form.date, form.end);
      if (!endAt) next.time = 'Вкажи час кінця';
      else if (endAt <= startAt) next.time = 'Кінець має бути пізніше за початок';
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    createEvent({
      title,
      type: form.type,
      calendar: form.calendar,
      startAt,
      endAt,
      allDay: false,
      participants: form.participants,
    });
    onClose();
  };

  // «Більше опцій →»: переносимо введене на окрему сторінку (учасники — через state).
  const moreSearch = new URLSearchParams();
  [
    ['date', form.date],
    ['start', form.start],
    ['end', isArrangement ? form.end : ''],
    ['calendar', form.calendar],
    ['title', form.title.trim()],
    ['type', form.type],
  ].forEach(([key, value]) => {
    if (value) moreSearch.set(key, value);
  });

  return (
    <form ref={formRef} className={styles.form} onSubmit={onSubmit} noValidate>
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
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
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
        onChange={(type) => set({ type })}
      />

      <div className={styles.fieldCol}>
        <div className={styles.timeRow}>
          <Icon name="clock" size={16} className={styles.clock} />
          <Input
            type="date"
            aria-label="Дата"
            value={form.date}
            onChange={(e) => set({ date: e.target.value })}
            className={styles.date}
          />
          <Input
            type="time"
            aria-label="Початок"
            value={form.start}
            onChange={(e) => onStartChange(e.target.value)}
            className={styles.time}
          />
          {isArrangement ? (
            <>
              <span className={styles.dash}>–</span>
              <Input
                type="time"
                aria-label="Кінець"
                value={form.end}
                onChange={(e) => set({ end: e.target.value, endTouched: true })}
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
          value={form.calendar}
          onChange={(v) => set({ calendar: v })}
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

      {form.showGuests ? (
        <ParticipantsInput
          value={form.participants}
          onChange={(list) => set({ participants: list })}
        />
      ) : null}

      <div className={styles.footer}>
        <PillButton type="submit" size="lg">
          Створити
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

/** Відкрита, коли useModals().quickCreate !== null. Стан форми живе у QuickCreateForm і скидається при кожному відкритті. */
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
    >
      <QuickCreateForm initial={quickCreate} onClose={closeQuickCreate} />
    </Modal>
  );
}
