import useTheme from '../../hooks/useTheme';
import cx from '../../utils/cx';
import { isDarkMode, MODES, swatchOf, THEMES } from '../../utils/theme';
import Icon from '../ui/Icon';
import SegmentedControl from '../ui/SegmentedControl';
import styles from './ThemePicker.module.css';

export default function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const isDark = isDarkMode(theme.mode);

  return (
    <div className={styles.picker}>
      <SegmentedControl
        size="sm"
        bg="muted"
        role="radiogroup"
        options={MODES}
        value={theme.mode}
        onChange={(mode) => setTheme({ mode })}
      />

      <div role="radiogroup" aria-label="Колір теми" className={styles.grid}>
        {THEMES.map((item) => {
          const swatch = swatchOf(item.key, isDark);
          const isActive = item.key === theme.color;
          return (
            <button
              key={item.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={item.label}
              className={cx(styles.option, isActive && styles.active)}
              onClick={() => setTheme({ color: item.key })}
            >
              <span
                className={styles.swatch}
                style={{
                  background: `linear-gradient(135deg, ${swatch.surface} 50%, ${swatch.primary} 50%)`,
                }}
              >
                {isActive ? (
                  <span className={styles.check}>
                    <Icon name="check" size={12} strokeWidth={3} />
                  </span>
                ) : null}
              </span>
              <span className={styles.label}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
