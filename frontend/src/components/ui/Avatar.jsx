import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { colorVars, COLOR_HEX } from '../../utils/colors';
import styles from './Avatar.module.css';

const isColorKey = (c) => Boolean(COLOR_HEX[c]);

export default function Avatar({
  initials,
  color = 'graphite',
  size = 26,
  ring = null,
  className = '',
  title = '',
  palette = 'member',
  src = null,
}) {
  const background = isColorKey(color) ? colorVars(color, palette).base : color;
  return (
    <span
      className={cx(styles.avatar, className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background,
        boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
      }}
      title={title || undefined}
      aria-hidden={title ? undefined : 'true'}
    >
      {src ? <img className={styles.image} src={src} alt="" /> : initials}
    </span>
  );
}

Avatar.propTypes = {
  initials: PropTypes.string.isRequired,
  color: PropTypes.string,
  size: PropTypes.number,
  ring: PropTypes.string,
  className: PropTypes.string,
  title: PropTypes.string,
  palette: PropTypes.oneOf(['calendar', 'member']),
  src: PropTypes.string,
};

export function AvatarStack({ items, size = 22, ring = 'var(--card)', max = 3, className = '' }) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <span className={cx(styles.stack, className)}>
      {shown.map((it, i) => (
        <Avatar
          key={it.id || it.initials + i}
          initials={it.initials}
          color={it.color}
          size={size}
          ring={ring}
          className={cx(i > 0 && styles.overlap)}
          title={it.name}
        />
      ))}
      {rest > 0 ? (
        <span
          className={cx(styles.avatar, styles.more, styles.overlap)}
          style={{ width: size, height: size, boxShadow: `0 0 0 2px ${ring}` }}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

AvatarStack.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      initials: PropTypes.string.isRequired,
      color: PropTypes.string,
      name: PropTypes.string,
    }),
  ).isRequired,
  size: PropTypes.number,
  ring: PropTypes.string,
  max: PropTypes.number,
  className: PropTypes.string,
};
