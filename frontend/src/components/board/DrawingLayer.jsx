import { useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { COLOR_KEYS, colorVars } from '../../utils/colors';
import {
  MAX_STROKE_POINTS,
  MIN_POINT_DISTANCE,
  STROKE_WIDTHS,
  strokeToPath,
  toStrokePoint,
} from '../../utils/board';
import styles from './DrawingLayer.module.css';

const ERASER_HIT_WIDTH = 16;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function DrawingLayer({
  drawings,
  rangeStart,
  hourWidth,
  isActive = false,
  tool = 'pen',
  color = COLOR_KEYS[0],
  strokeWidth = STROKE_WIDTHS[1],
  onStrokeComplete,
  onErase,
}) {
  const layerRef = useRef(null);
  const gesture = useRef(null);
  const [livePoints, setLivePoints] = useState(null);
  const isErasing = isActive && tool === 'eraser';

  const strokes = useMemo(
    () =>
      drawings.map((drawing) => ({
        id: drawing.id,
        color: drawing.color,
        width: drawing.width,
        path: strokeToPath(drawing.points, rangeStart, hourWidth),
      })),
    [drawings, rangeStart, hourWidth],
  );

  const eraseUnderPointer = (event) => {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const id = target?.getAttribute('data-drawing-id');
    if (!id || gesture.current.erasedIds.has(id)) return;
    gesture.current.erasedIds.add(id);
    onErase(id);
  };

  const appendSamples = (stroke, samples) => {
    const bounds = layerRef.current.getBoundingClientRect();
    let { lastX, lastY, points } = stroke;

    samples.forEach((sample) => {
      if (points.length >= MAX_STROKE_POINTS) return;
      const x = clamp(sample.clientX - bounds.left, 0, bounds.width);
      const y = clamp(sample.clientY - bounds.top, 0, bounds.height);
      if (Math.hypot(x - lastX, y - lastY) < MIN_POINT_DISTANCE) return;
      lastX = x;
      lastY = y;
      points = [...points, toStrokePoint(x, y, rangeStart, hourWidth)];
    });

    return { ...stroke, lastX, lastY, points };
  };

  const handlePointerDown = (event) => {
    if (!isActive || event.button !== 0 || gesture.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    if (isErasing) {
      gesture.current = { pointerId: event.pointerId, erasedIds: new Set() };
      eraseUnderPointer(event);
      return;
    }

    const bounds = layerRef.current.getBoundingClientRect();
    const x = clamp(event.clientX - bounds.left, 0, bounds.width);
    const y = clamp(event.clientY - bounds.top, 0, bounds.height);
    const points = [toStrokePoint(x, y, rangeStart, hourWidth)];
    gesture.current = { pointerId: event.pointerId, lastX: x, lastY: y, points };
    setLivePoints(points);
  };

  const handlePointerMove = (event) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (active.erasedIds) {
      eraseUnderPointer(event);
      return;
    }

    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const next = appendSamples(active, coalesced.length > 0 ? coalesced : [event]);
    if (next.points === active.points) return;
    gesture.current = next;
    setLivePoints(next.points);
  };

  const handlePointerEnd = (event) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (active.erasedIds) return;

    setLivePoints(null);
    const [firstPoint] = active.points;
    const points = active.points.length > 1 ? active.points : [firstPoint, firstPoint];
    onStrokeComplete({ color, width: strokeWidth, points });
  };

  return (
    <svg
      ref={layerRef}
      className={cx(styles.layer, isActive && styles.active, isErasing && styles.erasing)}
      aria-hidden="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
    >
      {strokes.map((stroke) => (
        <g key={stroke.id}>
          <path
            d={stroke.path}
            className={styles.stroke}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={stroke.width}
            style={{ stroke: colorVars(stroke.color).base }}
          />
          {isErasing ? (
            <path
              d={stroke.path}
              className={styles.eraserTarget}
              fill="none"
              strokeLinecap="round"
              strokeWidth={Math.max(stroke.width, ERASER_HIT_WIDTH)}
              data-drawing-id={stroke.id}
            />
          ) : null}
        </g>
      ))}
      {livePoints ? (
        <path
          d={strokeToPath(livePoints, rangeStart, hourWidth)}
          className={styles.stroke}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          style={{ stroke: colorVars(color).base }}
        />
      ) : null}
    </svg>
  );
}

DrawingLayer.propTypes = {
  drawings: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
      width: PropTypes.number.isRequired,
      points: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
    }),
  ).isRequired,
  rangeStart: PropTypes.instanceOf(Date).isRequired,
  hourWidth: PropTypes.number.isRequired,
  isActive: PropTypes.bool,
  tool: PropTypes.oneOf(['pen', 'eraser']),
  color: PropTypes.oneOf(COLOR_KEYS),
  strokeWidth: PropTypes.number,
  onStrokeComplete: PropTypes.func.isRequired,
  onErase: PropTypes.func.isRequired,
};
