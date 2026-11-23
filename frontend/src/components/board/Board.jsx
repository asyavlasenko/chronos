import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import useAuth from '../../hooks/useAuth';
import useCalendars from '../../hooks/useCalendars';
import useDrawings from '../../hooks/useDrawings';
import useEvents from '../../hooks/useEvents';
import useModals from '../../hooks/useModals';
import useNow from '../../hooks/useNow';
import useViewDate from '../../hooks/useViewDate';
import cx from '../../utils/cx';
import { COLOR_KEYS } from '../../utils/colors';
import { addDays, formatTime, formatTimeRange, startOfDay } from '../../utils/dates';
import { addMinutes } from '../../utils/eventStats';
import {
  DEFAULT_ZOOM_INDEX,
  DRAG_THRESHOLD,
  NOW_SCROLL_OFFSET,
  SHIFT_DAYS,
  SNAP_MINUTES,
  STICKER_HEIGHT,
  STROKE_WIDTHS,
  TASK_MIME,
  ZOOM_LEVELS,
  buildDays,
  buildHourTicks,
  clampTime,
  floorTime,
  formatBoardRange,
  getBoardRange,
  laneAtY,
  laneTop,
  lanesHeight,
  packLanes,
  snapTime,
  timeToX,
  xToTime,
} from '../../utils/board';
import { canModifyEvent } from '../../modals/eventFormUtils';
import ConfirmDialog from '../calendars/ConfirmDialog';
import BoardCreatePopover from './BoardCreatePopover';
import BoardHeader from './BoardHeader';
import BoardToolbar from './BoardToolbar';
import DrawingLayer from './DrawingLayer';
import Sticker from './Sticker';
import styles from './Board.module.css';

const NOW_TICK_MS = 30000;
const DEFAULT_DURATION_MINUTES = 60;

function withClockOf(day, clock) {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    clock.getHours(),
    clock.getMinutes(),
  );
}

const hasDraggedTask = (event) => Array.from(event.dataTransfer.types).includes(TASK_MIME);

export default function Board({ className = '' }) {
  const { date, setDate } = useViewDate();
  const { user } = useAuth();
  const { byId } = useCalendars();
  const { openDetails } = useModals();
  const now = useNow(NOW_TICK_MS);
  const userId = user?.id || null;
  const timeFormat = user?.timeFormat ?? '24h';
  const showWeekNumbers = user?.showWeekNumbers ?? true;
  const defaultDuration = user?.defaultArrangementDuration ?? DEFAULT_DURATION_MINUTES;

  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const hourWidth = ZOOM_LEVELS[zoomIndex];
  const { rangeStart, rangeEnd } = useMemo(() => getBoardRange(date), [date]);
  const boardWidth = timeToX(rangeEnd, rangeStart, hourWidth);

  const { events, toggleCompleted, updateEvent } = useEvents({ from: rangeStart, to: rangeEnd });
  const { drawings, addDrawing, removeDrawing, clearDrawings } = useDrawings({
    from: rangeStart,
    to: rangeEnd,
  });

  const [draft, setDraft] = useState(null);
  const [dropGuideTime, setDropGuideTime] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen');
  const [penColor, setPenColor] = useState(COLOR_KEYS[0]);
  const [penWidth, setPenWidth] = useState(STROKE_WIDTHS[1]);
  const [sessionStrokeIds, setSessionStrokeIds] = useState([]);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [scrollRequest, setScrollRequest] = useState(0);

  const scrollerRef = useRef(null);
  const lanesRef = useRef(null);
  const ghostRef = useRef(null);
  const cardDrag = useRef(null);
  const pendingScroll = useRef({
    rangeStartTime: rangeStart.getTime(),
    time: withClockOf(date, now),
    offset: NOW_SCROLL_OFFSET,
  });

  const days = useMemo(() => buildDays(rangeStart, hourWidth), [rangeStart, hourWidth]);
  const hourTicks = useMemo(() => buildHourTicks(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  const { stickers, laneCount, allDayByDay } = useMemo(() => {
    const scheduled = events.filter((event) => !event.isFloating && event.startAt);
    const packed = packLanes(
      scheduled.filter((event) => !event.allDay),
      rangeStart,
      rangeEnd,
      hourWidth,
    );
    const byDay = new Map();
    scheduled
      .filter((event) => event.allDay)
      .forEach((event) => {
        const key = startOfDay(event.startAt).getTime();
        byDay.set(key, [...(byDay.get(key) || []), event]);
      });
    return { ...packed, allDayByDay: byDay };
  }, [events, rangeStart, rangeEnd, hourWidth]);

  useLayoutEffect(() => {
    const pending = pendingScroll.current;
    const scroller = scrollerRef.current;
    if (!pending || !scroller || pending.rangeStartTime !== rangeStart.getTime()) return;
    pendingScroll.current = null;
    scroller.scrollLeft = Math.max(
      0,
      timeToX(pending.time, rangeStart, hourWidth) - pending.offset,
    );
  }, [rangeStart, hourWidth, scrollRequest]);

  useEffect(() => {
    if (dropGuideTime === null) return undefined;
    const hideGuide = () => setDropGuideTime(null);
    window.addEventListener('dragend', hideGuide);
    return () => window.removeEventListener('dragend', hideGuide);
  }, [dropGuideTime]);

  const openSticker = useCallback((event) => openDetails(event.id), [openDetails]);
  const toggleSticker = useCallback((event) => toggleCompleted(event.id), [toggleCompleted]);
  const closeDraft = useCallback(() => setDraft(null), []);
  const getGhostRect = useCallback(() => ghostRef.current?.getBoundingClientRect() ?? null, []);

  const shiftWindow = (direction) => setDate(addDays(date, direction * SHIFT_DAYS));

  const showToday = () => {
    const today = new Date();
    pendingScroll.current = {
      rangeStartTime: getBoardRange(today).rangeStart.getTime(),
      time: today,
      offset: NOW_SCROLL_OFFSET,
    };
    setDate(today);
    setScrollRequest((count) => count + 1);
  };

  const changeZoom = (step) => {
    const nextIndex = Math.min(Math.max(zoomIndex + step, 0), ZOOM_LEVELS.length - 1);
    if (nextIndex === zoomIndex) return;
    const scroller = scrollerRef.current;
    if (scroller) {
      const offset = scroller.clientWidth / 2;
      pendingScroll.current = {
        rangeStartTime: rangeStart.getTime(),
        time: xToTime(scroller.scrollLeft + offset, rangeStart, hourWidth),
        offset,
      };
    }
    setZoomIndex(nextIndex);
  };

  const readLanesPointer = (event) => {
    const bounds = lanesRef.current.getBoundingClientRect();
    const time = xToTime(event.clientX - bounds.left, rangeStart, hourWidth);
    return { time: clampTime(time, rangeStart, rangeEnd), y: event.clientY - bounds.top };
  };

  const startCard = (event) => {
    if (isDrawing || draft || event.button !== 0 || event.target !== event.currentTarget) return;
    const { time, y } = readLanesPointer(event);
    const startAt = floorTime(time);
    event.currentTarget.setPointerCapture(event.pointerId);
    cardDrag.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      anchorTime: snapTime(time).getTime(),
      hasMoved: false,
    };
    setDraft({
      startAt,
      endAt: addMinutes(startAt, defaultDuration),
      lane: laneAtY(y, laneCount),
      isReady: false,
    });
  };

  const stretchCard = (event) => {
    const drag = cardDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.hasMoved && Math.abs(event.clientX - drag.originX) < DRAG_THRESHOLD) return;
    drag.hasMoved = true;

    const pointerTime = snapTime(readLanesPointer(event).time).getTime();
    const startTime = Math.min(drag.anchorTime, pointerTime);
    const farTime = Math.max(drag.anchorTime, pointerTime);
    const endTime = farTime > startTime ? farTime : addMinutes(startTime, SNAP_MINUTES).getTime();
    setDraft((current) => {
      if (!current) return current;
      const isSame = current.startAt.getTime() === startTime && current.endAt.getTime() === endTime;
      return isSame
        ? current
        : { ...current, startAt: new Date(startTime), endAt: new Date(endTime) };
    });
  };

  const finishCard = (event) => {
    const drag = cardDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    cardDrag.current = null;
    setDraft((current) => current && { ...current, isReady: true });
  };

  const cancelCard = (event) => {
    const drag = cardDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    cardDrag.current = null;
    setDraft(null);
  };

  const showDropGuide = (event) => {
    if (!hasDraggedTask(event)) return;
    event.preventDefault();
    setDropGuideTime(snapTime(readLanesPointer(event).time).getTime());
  };

  const hideDropGuide = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setDropGuideTime(null);
  };

  const dropTask = (event) => {
    if (!hasDraggedTask(event)) return;
    event.preventDefault();
    const taskId = event.dataTransfer.getData(TASK_MIME);
    const startAt = snapTime(readLanesPointer(event).time);
    setDropGuideTime(null);
    if (taskId) updateEvent(taskId, { isFloating: false, allDay: false, startAt });
  };

  const toggleDrawing = () => {
    setIsDrawing((isOn) => !isOn);
    setTool('pen');
    setDraft(null);
  };

  const pickColor = (color) => {
    setPenColor(color);
    setTool('pen');
  };

  const pickStrokeWidth = (width) => {
    setPenWidth(width);
    setTool('pen');
  };

  const completeStroke = useCallback(
    (stroke) => {
      const strokeId = addDrawing(stroke);
      setSessionStrokeIds((ids) => [...ids, strokeId]);
    },
    [addDrawing],
  );

  const eraseStroke = (id) => {
    const erased = drawings.find((drawing) => drawing.id === id);
    setSessionStrokeIds((ids) =>
      ids.filter((strokeId) => strokeId !== id && strokeId !== erased?.localId),
    );
    removeDrawing(id);
  };

  const undoStroke = () => {
    const lastId = sessionStrokeIds[sessionStrokeIds.length - 1];
    if (!lastId) return;
    setSessionStrokeIds((ids) => ids.slice(0, -1));
    removeDrawing(lastId);
  };

  const confirmClear = async () => {
    setIsClearing(true);
    const isCleared = await clearDrawings();
    setIsClearing(false);
    setIsClearConfirmOpen(false);
    if (isCleared) setSessionStrokeIds([]);
  };

  const todayTime = startOfDay(now).getTime();
  const isNowVisible = now >= rangeStart && now < rangeEnd;
  const canComplete = (event) => canModifyEvent(event, byId[event.calendar], userId);
  const ghostLeft = draft ? timeToX(draft.startAt, rangeStart, hourWidth) : 0;

  return (
    <section className={cx(styles.board, className)} aria-label="Дошка зі стікерами">
      <BoardToolbar
        rangeLabel={formatBoardRange(rangeStart, rangeEnd)}
        onPrev={() => shiftWindow(-1)}
        onNext={() => shiftWindow(1)}
        onToday={showToday}
        canZoomOut={zoomIndex > 0}
        canZoomIn={zoomIndex < ZOOM_LEVELS.length - 1}
        onZoomOut={() => changeZoom(-1)}
        onZoomIn={() => changeZoom(1)}
        isDrawing={isDrawing}
        onToggleDrawing={toggleDrawing}
        tool={tool}
        color={penColor}
        strokeWidth={penWidth}
        onPickColor={pickColor}
        onPickStrokeWidth={pickStrokeWidth}
        onToggleEraser={() => setTool(tool === 'eraser' ? 'pen' : 'eraser')}
        canUndo={sessionStrokeIds.length > 0}
        onUndo={undoStroke}
        canClear={drawings.length > 0}
        onClear={() => setIsClearConfirmOpen(true)}
      />

      <div ref={scrollerRef} className={styles.scroller}>
        <div className={styles.content} style={{ width: boardWidth }}>
          <BoardHeader
            days={days}
            hourTicks={hourTicks}
            hourWidth={hourWidth}
            todayTime={todayTime}
            timeFormat={timeFormat}
            showWeekNumbers={showWeekNumbers}
          />

          <div className={styles.body}>
            <div className={styles.columns} aria-hidden="true">
              {days.map((day) => (
                <span
                  key={day.date.getTime()}
                  className={cx(styles.column, day.date.getTime() === todayTime && styles.today)}
                  style={{ left: day.left, width: day.width }}
                />
              ))}
            </div>

            <div className={styles.allDay}>
              {days.map((day) => (
                <div
                  key={day.date.getTime()}
                  className={styles.allDayColumn}
                  style={{ width: day.width }}
                >
                  {(allDayByDay.get(day.date.getTime()) || []).map((event) => (
                    <Sticker
                      key={event.id}
                      event={event}
                      calendar={byId[event.calendar] || null}
                      timeFormat={timeFormat}
                      canComplete={canComplete(event)}
                      onOpen={openSticker}
                      onToggleComplete={toggleSticker}
                    />
                  ))}
                </div>
              ))}
            </div>

            <div
              ref={lanesRef}
              className={cx(styles.lanes, isDrawing && styles.lanesLocked)}
              style={{ minHeight: lanesHeight(laneCount), backgroundSize: `${hourWidth}px 100%` }}
              onPointerDown={startCard}
              onPointerMove={stretchCard}
              onPointerUp={finishCard}
              onPointerCancel={cancelCard}
              onLostPointerCapture={finishCard}
              onDragOver={showDropGuide}
              onDragLeave={hideDropGuide}
              onDrop={dropTask}
            >
              {stickers.map(({ event, left, width, lane }) => (
                <Sticker
                  key={event.id}
                  event={event}
                  calendar={byId[event.calendar] || null}
                  left={left}
                  top={laneTop(lane)}
                  width={width}
                  timeFormat={timeFormat}
                  canComplete={canComplete(event)}
                  onOpen={openSticker}
                  onToggleComplete={toggleSticker}
                />
              ))}

              {draft ? (
                <div
                  ref={ghostRef}
                  className={styles.ghost}
                  style={{
                    left: ghostLeft,
                    top: laneTop(draft.lane),
                    width: timeToX(draft.endAt, rangeStart, hourWidth) - ghostLeft,
                    height: STICKER_HEIGHT,
                  }}
                >
                  <span className={styles.ghostTime}>
                    {formatTimeRange(draft.startAt, draft.endAt, timeFormat)}
                  </span>
                </div>
              ) : null}

              {dropGuideTime !== null ? (
                <div
                  className={styles.dropGuide}
                  style={{ left: timeToX(dropGuideTime, rangeStart, hourWidth) }}
                >
                  <span className={styles.dropGuideTime}>
                    {formatTime(dropGuideTime, timeFormat)}
                  </span>
                </div>
              ) : null}
            </div>

            {isNowVisible ? (
              <div
                className={styles.now}
                style={{ left: timeToX(now, rangeStart, hourWidth) }}
                aria-hidden="true"
              />
            ) : null}

            <DrawingLayer
              drawings={drawings}
              rangeStart={rangeStart}
              hourWidth={hourWidth}
              isActive={isDrawing}
              tool={tool}
              color={penColor}
              strokeWidth={penWidth}
              onStrokeComplete={completeStroke}
              onErase={eraseStroke}
            />
          </div>
        </div>
      </div>

      {draft?.isReady ? (
        <BoardCreatePopover
          startAt={draft.startAt}
          endAt={draft.endAt}
          timeFormat={timeFormat}
          getAnchorRect={getGhostRect}
          onClose={closeDraft}
        />
      ) : null}

      <ConfirmDialog
        open={isClearConfirmOpen}
        title="Очистити малюнки?"
        text="Усі твої лінії за ці 14 днів буде видалено. Цю дію не можна скасувати."
        confirmLabel="Очистити"
        busy={isClearing}
        onConfirm={confirmClear}
        onCancel={() => setIsClearConfirmOpen(false)}
      />
    </section>
  );
}

Board.propTypes = {
  className: PropTypes.string,
};
