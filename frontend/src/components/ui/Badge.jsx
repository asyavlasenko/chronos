import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { colorVars, COLOR_KEYS } from '../../utils/colors';
import styles from './Badge.module.css';

export default function Badge({
  children,
  variant = 'muted',
  color = null,
  size = 'md',
  dot = null,
  dotShape = 'round',
  className = '',
  as: Tag = 'span',
  ...rest
}) {
  const vars = variant === 'tint' && color ? colorVars(color) : null;
  const style = vars ? { background: vars.tint, color: vars.text } : undefined;
  const dotStyle = dot
    ? { background: dot === 'accent' ? 'var(--accent-dot)' : colorVars(dot).base }
    : undefined;
  return (
    <Tag
      className={cx(styles.badge, styles[variant], styles[size], className)}
      style={style}
      {...rest}
    >
      {dot ? (
        <span className={cx(styles.dot, dotShape === 'square' && styles.square)} style={dotStyle} />
      ) : null}
      {children}
    </Tag>
  );
}

Badge.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf([
    'muted',
    'tint',
    'dark',
    'accent',
    'success',
    'outline',
    'danger',
    'white',
  ]),
  color: PropTypes.oneOf([...COLOR_KEYS, 'holidays']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  dot: PropTypes.oneOf([...COLOR_KEYS, 'holidays', 'accent']),
  dotShape: PropTypes.oneOf(['round', 'square']),
  className: PropTypes.string,
  as: PropTypes.elementType,
};
