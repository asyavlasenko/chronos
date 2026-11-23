import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { COLOR_KEYS } from '../../utils/colors';
import { STROKE_WIDTHS } from '../../utils/board';
import ColorPicker from '../ui/ColorPicker';
import IconButton from '../ui/IconButton';
import PillButton from '../ui/PillButton';
import styles from './BoardToolbar.module.css';

const WIDTH_PREVIEW_PADDING = 4;

export default function BoardToolbar({
  rangeLabel,
  onPrev,
  onNext,
  onToday,
  canZoomOut = true,
  canZoomIn = true,
  onZoomOut,
  onZoomIn,
  isDrawing = false,
  onToggleDrawing,
  tool = 'pen',
  color = COLOR_KEYS[0],
  strokeWidth = STROKE_WIDTHS[1],
  onPickColor,
  onPickStrokeWidth,
  onToggleEraser,
  canUndo = false,
  onUndo,
  canClear = false,
  onClear,
}) {
  const isPen = tool === 'pen';

  return (
    <div className={styles.toolbar}>
      <IconButton icon="chevron-left" label="На тиждень назад" variant="muted" onClick={onPrev} />
      <h2 className={styles.title}>
        Дошка
        <span className={styles.range}> · {rangeLabel}</span>
      </h2>
      <IconButton icon="chevron-right" label="На тиждень вперед" variant="muted" onClick={onNext} />
      <PillButton variant="secondary" size="sm" onClick={onToday}>
        Сьогодні
      </PillButton>

      <span className={styles.spacer} />

      <IconButton
        icon="zoom-out"
        label="Зменшити масштаб"
        variant="muted"
        className={styles.zoom}
        disabled={!canZoomOut}
        onClick={onZoomOut}
      />
      <IconButton
        icon="zoom-in"
        label="Збільшити масштаб"
        variant="muted"
        className={styles.zoom}
        disabled={!canZoomIn}
        onClick={onZoomIn}
      />
      <PillButton
        variant={isDrawing ? 'primary' : 'secondary'}
        size="sm"
        icon="pencil"
        aria-pressed={isDrawing}
        onClick={onToggleDrawing}
      >
        Малювати
      </PillButton>

      {isDrawing ? (
        <div className={styles.tools} role="group" aria-label="Інструменти малювання">
          <ColorPicker
            value={isPen ? color : null}
            onChange={onPickColor}
            size={20}
            label="Колір лінії"
          />
          <div className={styles.widths} role="radiogroup" aria-label="Товщина лінії">
            {STROKE_WIDTHS.map((width) => {
              const isChecked = isPen && width === strokeWidth;
              return (
                <button
                  key={width}
                  type="button"
                  role="radio"
                  aria-checked={isChecked}
                  aria-label={`Товщина ${width}`}
                  className={cx(styles.width, isChecked && styles.widthActive)}
                  onClick={() => onPickStrokeWidth(width)}
                >
                  <span
                    className={styles.widthPreview}
                    style={{
                      width: width + WIDTH_PREVIEW_PADDING,
                      height: width + WIDTH_PREVIEW_PADDING,
                    }}
                  />
                </button>
              );
            })}
          </div>
          <PillButton
            variant={isPen ? 'secondary' : 'primary'}
            size="xs"
            icon="eraser"
            aria-pressed={!isPen}
            onClick={onToggleEraser}
          >
            Гумка
          </PillButton>
          <PillButton variant="ghost" size="xs" icon="undo" disabled={!canUndo} onClick={onUndo}>
            Скасувати
          </PillButton>
          <PillButton
            variant="danger"
            size="xs"
            icon="trash"
            disabled={!canClear}
            onClick={onClear}
          >
            Очистити
          </PillButton>
        </div>
      ) : null}
    </div>
  );
}

BoardToolbar.propTypes = {
  rangeLabel: PropTypes.string.isRequired,
  onPrev: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onToday: PropTypes.func.isRequired,
  canZoomOut: PropTypes.bool,
  canZoomIn: PropTypes.bool,
  onZoomOut: PropTypes.func.isRequired,
  onZoomIn: PropTypes.func.isRequired,
  isDrawing: PropTypes.bool,
  onToggleDrawing: PropTypes.func.isRequired,
  tool: PropTypes.oneOf(['pen', 'eraser']),
  color: PropTypes.oneOf(COLOR_KEYS),
  strokeWidth: PropTypes.oneOf(STROKE_WIDTHS),
  onPickColor: PropTypes.func.isRequired,
  onPickStrokeWidth: PropTypes.func.isRequired,
  onToggleEraser: PropTypes.func.isRequired,
  canUndo: PropTypes.bool,
  onUndo: PropTypes.func.isRequired,
  canClear: PropTypes.bool,
  onClear: PropTypes.func.isRequired,
};
