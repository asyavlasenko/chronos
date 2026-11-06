// Дизайн: design/screens/01-overview.html (хедер), 02 (тулбар), 11/12 (модалки)
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import cx from '../../utils/cx';
import Icon, { ICON_NAMES } from './Icon';
import styles from './PillButton.module.css';

/**
 * Кнопка-пілюля. variant: primary (темна) · secondary (біла з рамкою) · white (біла без рамки) ·
 * ghost (прозора) · danger (біла, червоний текст) · accent (синій текст без фону).
 * size: lg 40 · md 38 · sm 34 · xs 32 · xxs 28. shape: pill | rounded (radius 8/10 для кнопок у картках).
 */
export default function PillButton({
  children = null,
  variant = 'primary',
  size = 'md',
  shape = 'pill',
  icon = null,
  iconSize = 14,
  to = null,
  href = null,
  type = 'button',
  fullWidth = false,
  className = '',
  ...rest
}) {
  const cls = cx(
    styles.btn,
    styles[variant],
    styles[size],
    styles[shape],
    fullWidth && styles.full,
    className,
  );
  const content = (
    <>
      {icon ? <Icon name={icon} size={iconSize} strokeWidth={2.4} /> : null}
      {children}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {content}
      </a>
    );
  }
  return (
    // eslint-disable-next-line react/button-has-type
    <button type={type} className={cls} {...rest}>
      {content}
    </button>
  );
}

PillButton.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(['primary', 'secondary', 'white', 'ghost', 'danger', 'accent']),
  size: PropTypes.oneOf(['lg', 'md', 'sm', 'xs', 'xxs']),
  shape: PropTypes.oneOf(['pill', 'rounded']),
  icon: PropTypes.oneOf(ICON_NAMES),
  iconSize: PropTypes.number,
  to: PropTypes.string,
  href: PropTypes.string,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  fullWidth: PropTypes.bool,
  className: PropTypes.string,
};
