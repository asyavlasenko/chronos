import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { parseApiError } from '../../api/errors';
import useCalendars from '../../hooks/useCalendars';
import useEvents from '../../hooks/useEvents';
import useModals from '../../hooks/useModals';
import useToast from '../../hooks/useToast';
import { colorVars } from '../../utils/colors';
import { formatDate, formatTimeRange } from '../../utils/dates';
import {
  calendarOptions,
  isWritableCalendar,
  pickWritableCalendarId,
} from '../../modals/eventFormUtils';
import Input from '../ui/Input';
import PillButton from '../ui/PillButton';
import Select from '../ui/Select';
import styles from './BoardCreatePopover.module.css';

const TITLE_SELECTOR = 'input[name="title"]';
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 8;
const EMPTY_TITLE_ERROR = 'Вкажи назву';
const NO_CALENDAR_ERROR = 'Немає календаря, у який можна додати подію';

export default function BoardCreatePopover({
  startAt,
  endAt,
  timeFormat = '24h',
  getAnchorRect,
  onClose,
}) {
  const { createEvent } = useEvents();
  const { calendars, byId } = useCalendars();
  const { openQuickCreate } = useModals();
  const { notifyError } = useToast();
  const popoverRef = useRef(null);
  const isMounted = useRef(true);
  const inFlight = useRef(false);
  const [title, setTitle] = useState('');
  const [preferredCalendarId, setPreferredCalendarId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const writableCalendars = calendars.filter(isWritableCalendar);
  const calendarId = pickWritableCalendarId(calendars, preferredCalendarId);
  const calendar = byId[calendarId] || null;
  const hasCalendarChoice = writableCalendars.length > 1;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    const placeNextToAnchor = () => {
      const popover = popoverRef.current;
      const anchor = getAnchorRect();
      if (!popover || !anchor) return;

      const { width, height } = popover.getBoundingClientRect();
      const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(anchor.left, maxLeft));
      const below = anchor.bottom + ANCHOR_GAP;
      const fitsBelow = below + height <= window.innerHeight - VIEWPORT_MARGIN;
      const above = Math.max(VIEWPORT_MARGIN, anchor.top - height - ANCHOR_GAP);
      popover.style.left = `${left}px`;
      popover.style.top = `${fitsBelow ? below : above}px`;
    };

    placeNextToAnchor();
    window.addEventListener('resize', placeNextToAnchor);
    window.addEventListener('scroll', placeNextToAnchor, true);
    return () => {
      window.removeEventListener('resize', placeNextToAnchor);
      window.removeEventListener('scroll', placeNextToAnchor, true);
    };
  }, [getAnchorRect, error, hasCalendarChoice]);

  useLayoutEffect(() => {
    popoverRef.current?.querySelector(TITLE_SELECTOR)?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const closeOnOutsidePress = (event) => {
      if (!popoverRef.current?.contains(event.target)) onClose();
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const changeTitle = (event) => {
    setTitle(event.target.value);
    setError('');
  };

  const openFullForm = () => {
    onClose();
    openQuickCreate({ date: startAt, startAt, endAt, calendarId });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(EMPTY_TITLE_ERROR);
      return;
    }
    if (!calendarId) {
      setError(NO_CALENDAR_ERROR);
      return;
    }

    inFlight.current = true;
    setIsSubmitting(true);
    try {
      await createEvent({
        type: 'arrangement',
        title: trimmedTitle,
        calendar: calendarId,
        startAt,
        endAt,
      });
      if (isMounted.current) onClose();
    } catch (err) {
      inFlight.current = false;
      if (!isMounted.current) {
        notifyError(err);
        return;
      }
      const { fields, message } = parseApiError(err);
      setError(fields.title || message);
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <form
      ref={popoverRef}
      className={styles.popover}
      role="dialog"
      aria-label="Нова картка"
      onSubmit={submit}
      noValidate
    >
      <div className={styles.when}>
        <span className={styles.day}>{formatDate(startAt, 'weekday-short')}</span>
        <span className={styles.range}>{formatTimeRange(startAt, endAt, timeFormat)}</span>
      </div>

      <div className={styles.field}>
        <Input
          name="title"
          type="text"
          size="sm"
          maxLength={120}
          value={title}
          onChange={changeTitle}
          placeholder="Що плануєш?"
          aria-label="Назва картки"
          aria-invalid={error ? true : undefined}
          invalid={Boolean(error)}
          autoComplete="off"
        />
        {error ? (
          <span className={styles.error} role="alert">
            {error}
          </span>
        ) : null}
      </div>

      {hasCalendarChoice ? (
        <Select
          aria-label="Календар"
          size="sm"
          options={calendarOptions(writableCalendars)}
          value={calendarId}
          onChange={setPreferredCalendarId}
          leading={
            <span
              className={styles.dot}
              style={{ background: colorVars(calendar?.color || 'graphite').base }}
            />
          }
        />
      ) : null}

      <div className={styles.actions}>
        <PillButton type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Створюємо…' : 'Створити'}
        </PillButton>
        <PillButton variant="accent" size="sm" onClick={openFullForm}>
          Детальніше
        </PillButton>
      </div>
    </form>,
    document.body,
  );
}

BoardCreatePopover.propTypes = {
  startAt: PropTypes.instanceOf(Date).isRequired,
  endAt: PropTypes.instanceOf(Date).isRequired,
  timeFormat: PropTypes.oneOf(['24h', '12h']),
  getAnchorRect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
