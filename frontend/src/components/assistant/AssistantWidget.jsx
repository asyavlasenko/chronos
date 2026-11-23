import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { getAssistantStatus, requestDraft } from '../../api/assistant.api';
import { parseApiError } from '../../api/errors';
import useAuth from '../../hooks/useAuth';
import useCalendars from '../../hooks/useCalendars';
import useEvents from '../../hooks/useEvents';
import useModals from '../../hooks/useModals';
import { TYPE_LABELS } from '../../modals/eventFormUtils';
import cx from '../../utils/cx';
import { formatDate, formatTimeRange } from '../../utils/dates';
import Icon from '../ui/Icon';
import IconButton from '../ui/IconButton';
import Mascot from './Mascot';
import styles from './AssistantWidget.module.css';

function MissingStage({ onError = null }) {
  useEffect(() => {
    onError?.();
  }, [onError]);
  return null;
}

MissingStage.propTypes = {
  onError: PropTypes.func,
};

const CharacterStage = lazy(() =>
  import('./CharacterStage').catch(() => ({ default: MissingStage })),
);

const INPUT_ID = 'assistant-input';
const MAX_TEXT_LENGTH = 500;
const GREETING = 'Привіт! Напиши, що запланувати, і я додам це в календар.';
const HOME = { x: 0, y: 0, scale: 1 };
const FACING_VIEWER = 0;
const FACING_LEFT = -Math.PI / 2;
const FACING_AWAY = Math.PI;
const WALK_SPEED = 115;
const MIN_WALK_MS = 700;
const MAX_WALK_MS = 2600;
const PACE_FAR = -130;
const PACE_NEAR = -30;
const FAR_SCALE = 0.82;
const CALENDAR_SPOT_X = 0.36;
const CALENDAR_SPOT_Y = 0.66;
const FEET_OFFSET = 8;
const LADDER_WIDTH = 58;
const LADDER_HEIGHT = 136;
const CLIMB_REACH = 0.72;
const CLIMB_MS = 2400;
const DESCEND_MS = 1500;
const LADDER_RISE_MS = 320;
const GESTURE_MS = 2100;
const MOBILE_QUERY = '(max-width: 767px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const staysInPlace = () =>
  window.matchMedia(MOBILE_QUERY).matches || window.matchMedia(REDUCED_MOTION_QUERY).matches;

function describeWhen(draft, timeFormat) {
  if (draft.isFloating) return 'без дати, у списку «Колись»';

  const start = new Date(draft.startAt);
  if (draft.allDay) return formatDate(start, 'weekday-long');

  const end = draft.endAt ? new Date(draft.endAt) : null;
  return `${formatDate(start, 'weekday-long')}, ${formatTimeRange(start, end, timeFormat)}`;
}

function toEventDto(draft, calendarId) {
  const base = { type: draft.type, title: draft.title, calendar: calendarId };
  if (draft.isFloating) return { ...base, isFloating: true, priority: 'medium' };

  return {
    ...base,
    startAt: new Date(draft.startAt),
    endAt: draft.endAt ? new Date(draft.endAt) : null,
    allDay: draft.allDay,
  };
}

function ladderSpot(characterElement) {
  const main = document.querySelector('main');
  if (!main || !characterElement) return null;

  const area = main.getBoundingClientRect();
  const visibleBottom = Math.min(area.bottom, window.innerHeight);
  const baseX = Math.round(area.left + area.width * CALENDAR_SPOT_X);
  const baseY = Math.round(area.top + (visibleBottom - area.top) * CALENDAR_SPOT_Y);
  const homeX = characterElement.offsetLeft + characterElement.offsetWidth / 2;
  const homeBottom = characterElement.offsetTop + characterElement.offsetHeight;

  return {
    foot: {
      x: Math.round(baseX - homeX),
      y: Math.round(baseY - homeBottom + FEET_OFFSET),
      scale: FAR_SCALE,
    },
    ladder: { left: baseX - LADDER_WIDTH / 2, top: baseY - LADDER_HEIGHT },
  };
}

export default function AssistantWidget() {
  const { user } = useAuth();
  const { mainCalendar } = useCalendars();
  const { createEvent, deleteEvent } = useEvents();
  const { openDetails } = useModals();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [is3dBroken, setIs3dBroken] = useState(false);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [pose, setPose] = useState({ ...HOME, action: 'Idle', heading: FACING_VIEWER, ms: 0 });
  const [ladder, setLadder] = useState(null);
  const rootRef = useRef(null);
  const robotRef = useRef(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const nextId = useRef(1);
  const position = useRef(HOME);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    getAssistantStatus()
      .then((status) => {
        if (isMounted.current) setIsEnabled(Boolean(status.enabled));
      })
      .catch(() => null);
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    inputRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, isThinking, isOpen]);

  const act = useCallback((action, heading = FACING_VIEWER) => {
    if (isMounted.current) setPose((prev) => ({ ...prev, action, heading, ms: 0 }));
  }, []);

  const gesture = useCallback(
    async (action) => {
      act(action);
      await sleep(GESTURE_MS);
      act('Idle');
    },
    [act],
  );

  const walkTo = useCallback(async (target) => {
    const from = position.current;
    const dx = target.x - from.x;
    const dy = target.y - from.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 4 || !isMounted.current) return;

    const ms = Math.min(MAX_WALK_MS, Math.max(MIN_WALK_MS, (distance / WALK_SPEED) * 1000));
    position.current = target;
    setPose({ ...target, action: 'Walking', heading: Math.atan2(dx, dy), ms });
    await sleep(ms);
  }, []);

  const onStageReady = useCallback(() => {
    gesture('Wave');
  }, [gesture]);

  const onStageError = useCallback(() => setIs3dBroken(true), []);

  if (!isEnabled || !mainCalendar) return null;

  const append = (message) => {
    const id = nextId.current;
    nextId.current += 1;
    setMessages((prev) => [...prev, { id, ...message }]);
  };

  const toggle = () => {
    if (!isOpen && !isBusy) gesture('Wave');
    setIsOpen((value) => !value);
  };

  const think = async (pending) => {
    let isSettled = false;
    const settled = pending.then(
      (draft) => ({ draft }),
      (error) => ({ error }),
    );
    settled.then(() => {
      isSettled = true;
    });

    if (staysInPlace()) {
      act('Walking', FACING_LEFT);
      return settled;
    }

    const pace = async (goesFar) => {
      if (isSettled || !isMounted.current) return;
      await walkTo({ ...HOME, x: goesFar ? PACE_FAR : PACE_NEAR });
      await pace(!goesFar);
    };
    await pace(true);
    return settled;
  };

  const crawlTo = async (target, ms) => {
    position.current = target;
    if (isMounted.current) setPose({ ...target, action: 'Climb', heading: FACING_AWAY, ms });
    await sleep(ms);
  };

  const createInPlace = async (draft) => {
    act('Punch');
    const eventId = await createEvent(toEventDto(draft, mainCalendar.id));
    await gesture('ThumbsUp');
    return eventId;
  };

  const create = async (draft) => {
    const spot = staysInPlace() ? null : ladderSpot(robotRef.current);
    if (!spot) return createInPlace(draft);

    await walkTo(spot.foot);
    act('Idle', FACING_AWAY);
    if (isMounted.current) setLadder(spot.ladder);
    await sleep(LADDER_RISE_MS);
    await crawlTo({ ...spot.foot, y: spot.foot.y - LADDER_HEIGHT * CLIMB_REACH }, CLIMB_MS);

    try {
      return await createInPlace(draft);
    } finally {
      await crawlTo(spot.foot, DESCEND_MS);
      act('Idle');
      if (isMounted.current) setLadder(null);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const phrase = text.trim();
    if (!phrase || isBusy) return;

    append({ role: 'user', text: phrase });
    setText('');
    setIsBusy(true);
    setIsThinking(true);

    let reply;
    let finale = 'Jump';
    try {
      const { draft, error } = await think(requestDraft(phrase));
      if (error) throw error;

      const eventId = await create(draft);
      reply = {
        role: 'bot',
        kind: 'created',
        eventId,
        text: `${capitalize(TYPE_LABELS[draft.type])} «${draft.title}»`,
        when: describeWhen(draft, user?.timeFormat),
      };
    } catch (err) {
      reply = { role: 'bot', kind: 'error', text: parseApiError(err).message };
      finale = 'No';
    }

    append(reply);
    setIsThinking(false);
    await walkTo(HOME);
    if (isMounted.current) setIsBusy(false);
    inputRef.current?.focus();
    gesture(finale);
  };

  const undo = (message) => {
    deleteEvent(message.eventId);
    setMessages((prev) =>
      prev.map((item) => (item.id === message.id ? { ...item, kind: 'undone' } : item)),
    );
  };

  const open = (message) => {
    setIsOpen(false);
    openDetails(message.eventId);
  };

  const robotStyle = {
    transform: `translate(${pose.x}px, ${pose.y}px) scale(${pose.scale})`,
    transitionDuration: `${pose.ms}ms`,
  };

  return (
    <div ref={rootRef}>
      {isOpen ? (
        <section className={styles.panel} role="dialog" aria-label="Помічник">
          <header className={styles.head}>
            <h2 className={styles.title}>Помічник</h2>
            <IconButton
              icon="x"
              label="Закрити помічника"
              size="xs"
              variant="muted"
              onClick={() => setIsOpen(false)}
            />
          </header>

          <div ref={logRef} className={styles.log} aria-live="polite">
            <p className={cx(styles.bubble, styles.bot)}>{GREETING}</p>
            {messages.map((message) => {
              if (message.role === 'user') {
                return (
                  <p key={message.id} className={cx(styles.bubble, styles.user)}>
                    {message.text}
                  </p>
                );
              }
              if (message.kind === 'error') {
                return (
                  <p key={message.id} className={cx(styles.bubble, styles.bot, styles.error)}>
                    {message.text}
                  </p>
                );
              }
              return (
                <div key={message.id} className={cx(styles.bubble, styles.bot)}>
                  <span className={styles.status}>
                    {message.kind === 'undone' ? 'Скасовано' : 'Готово, додав'}
                  </span>
                  <span className={cx(styles.event, message.kind === 'undone' && styles.undone)}>
                    {message.text}
                  </span>
                  <span className={styles.when}>{message.when}</span>
                  {message.kind === 'created' ? (
                    <span className={styles.actions}>
                      <button type="button" className={styles.link} onClick={() => open(message)}>
                        Відкрити
                      </button>
                      <button type="button" className={styles.link} onClick={() => undo(message)}>
                        Скасувати
                      </button>
                    </span>
                  ) : null}
                </div>
              );
            })}
            {isThinking ? (
              <p className={cx(styles.bubble, styles.bot, styles.typing)}>Думаю…</p>
            ) : null}
          </div>

          <form className={styles.form} onSubmit={submit}>
            <label className={styles.srOnly} htmlFor={INPUT_ID}>
              Що запланувати
            </label>
            <input
              id={INPUT_ID}
              ref={inputRef}
              className={styles.input}
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={MAX_TEXT_LENGTH}
              placeholder="Завтра о 15 зустріч з ментором"
              autoComplete="off"
            />
            <button
              type="submit"
              className={styles.send}
              aria-label="Надіслати"
              disabled={isBusy || !text.trim()}
            >
              <Icon name="arrow-right" size={16} />
            </button>
          </form>
        </section>
      ) : null}

      {ladder ? <span className={styles.ladder} style={ladder} aria-hidden="true" /> : null}

      <button
        ref={robotRef}
        type="button"
        className={cx(styles.robot, is3dBroken && styles.flat)}
        style={robotStyle}
        aria-label="Помічник"
        aria-expanded={isOpen}
        onClick={toggle}
      >
        {is3dBroken ? (
          <Mascot mood={isBusy ? 'thinking' : 'idle'} size={46} />
        ) : (
          <Suspense fallback={null}>
            <CharacterStage
              action={pose.action}
              heading={pose.heading}
              onReady={onStageReady}
              onError={onStageError}
            />
          </Suspense>
        )}
      </button>
    </div>
  );
}
