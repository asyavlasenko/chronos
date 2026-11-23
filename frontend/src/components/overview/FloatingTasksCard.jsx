import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { parseApiError } from '../../api/errors';
import useAuth from '../../hooks/useAuth';
import useCalendars from '../../hooks/useCalendars';
import useEvents from '../../hooks/useEvents';
import useModals from '../../hooks/useModals';
import cx from '../../utils/cx';
import { stickerColors } from '../../utils/colors';
import { eventShape } from '../../utils/propTypes';
import { canModifyEvent, pickWritableCalendarId } from '../../modals/eventFormUtils';
import Card from '../ui/Card';
import Checkbox from '../ui/Checkbox';
import Icon from '../ui/Icon';
import IconButton from '../ui/IconButton';
import Input from '../ui/Input';
import styles from './FloatingTasksCard.module.css';

const DRAG_TYPE = 'application/x-chronos-task';
const TITLE_MAX = 120;

function Sticker({ task, colors, canEdit, canDrag, onToggle, onOpen }) {
  const done = Boolean(task.isCompleted);
  const isDraggable = canDrag && canEdit && !done;

  const onDragStart = (e) => {
    e.dataTransfer.setData(DRAG_TYPE, task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <li
      className={cx(styles.sticker, isDraggable && styles.draggable, done && styles.done)}
      style={{ '--sticker-base': colors.base, '--sticker-tint': colors.tint, color: colors.text }}
      draggable={isDraggable}
      onDragStart={isDraggable ? onDragStart : undefined}
    >
      <Checkbox
        checked={done}
        onChange={() => onToggle(task.id)}
        size={15}
        label={`Виконано: ${task.title}`}
        disabled={!canEdit}
      />
      <button type="button" className={styles.title} onClick={() => onOpen(task.id)}>
        <span className={styles.titleText}>{task.title}</span>
      </button>
    </li>
  );
}

Sticker.propTypes = {
  task: eventShape.isRequired,
  colors: PropTypes.shape({
    base: PropTypes.string,
    tint: PropTypes.string,
    text: PropTypes.string,
  }).isRequired,
  canEdit: PropTypes.bool.isRequired,
  canDrag: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onOpen: PropTypes.func.isRequired,
};

export default function FloatingTasksCard({ canDrag = true, className = '' }) {
  const { user } = useAuth();
  const { calendars, byId } = useCalendars();
  const { floatingTasks, createEvent, toggleCompleted } = useEvents();
  const { openDetails } = useModals();
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const isMounted = useRef(true);
  const inFlight = useRef(false);
  const errorId = useId();
  const doneListId = useId();
  const userId = user?.id || null;
  const calendarId = pickWritableCalendarId(calendars);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const active = floatingTasks.filter((t) => !t.isCompleted);
  const done = floatingTasks.filter((t) => t.isCompleted);
  const hasDraggable = canDrag && active.some((t) => canModifyEvent(t, byId[t.calendar], userId));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (inFlight.current) return;

    const name = title.trim();
    if (!name) {
      setError('Напиши, що хочеш зробити');
      return;
    }
    if (!calendarId) {
      setError('Немає календаря, у який можна додати справу');
      return;
    }

    inFlight.current = true;
    setIsAdding(true);
    setError(null);
    try {
      await createEvent({
        type: 'task',
        title: name,
        calendar: calendarId,
        isFloating: true,
        priority: 'medium',
      });
      if (isMounted.current) setTitle('');
    } catch (err) {
      const { message, fields } = parseApiError(err);
      if (isMounted.current) setError(Object.values(fields)[0] || message);
    } finally {
      inFlight.current = false;
      if (isMounted.current) setIsAdding(false);
    }
  };

  const renderSticker = (task) => (
    <Sticker
      key={task.id}
      task={task}
      colors={stickerColors(task, byId[task.calendar])}
      canEdit={canModifyEvent(task, byId[task.calendar], userId)}
      canDrag={canDrag}
      onToggle={toggleCompleted}
      onOpen={openDetails}
    />
  );

  return (
    <Card
      aria-label="Колись"
      title="Колись"
      subtitle="Зроблю, коли буде настрій"
      gap={10}
      className={className}
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.formRow}>
          <Input
            size="xs"
            maxLength={TITLE_MAX}
            placeholder="Нова справа без дати…"
            aria-label="Нова справа без дати"
            value={title}
            readOnly={isAdding}
            invalid={Boolean(error)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError(null);
            }}
            className={styles.input}
          />
          <IconButton
            type="submit"
            icon="plus"
            label="Додати справу"
            size="sm"
            variant="muted"
            iconSize={14}
            disabled={isAdding}
            className={styles.add}
          />
        </div>
        {error ? (
          <span id={errorId} className={styles.error} role="alert">
            {error}
          </span>
        ) : null}
      </form>

      {active.length ? (
        <ul className={styles.list}>{active.map(renderSticker)}</ul>
      ) : (
        <span className={styles.empty}>Тут живуть справи без дедлайну</span>
      )}

      {hasDraggable ? (
        <span className={styles.hint}>Перетягни справу на дошку, щоб призначити час</span>
      ) : null}

      {done.length ? (
        <button
          type="button"
          className={cx(styles.doneToggle, showDone && styles.doneToggleOpen)}
          aria-expanded={showDone}
          aria-controls={doneListId}
          onClick={() => setShowDone((v) => !v)}
        >
          Виконані ({done.length})
          <Icon name="chevron-down" size={12} className={styles.chevron} />
        </button>
      ) : null}
      {done.length && showDone ? (
        <ul id={doneListId} className={styles.list}>
          {done.map(renderSticker)}
        </ul>
      ) : null}
    </Card>
  );
}

FloatingTasksCard.propTypes = {
  canDrag: PropTypes.bool,
  className: PropTypes.string,
};
