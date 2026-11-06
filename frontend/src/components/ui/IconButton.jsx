// Дизайн: 02-week-cards.html (стрілки тулбара), 11 (закрити модалку), 04 (стрілки міні-місяця)
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import cx from '../../utils/cx';
import Icon, { ICON_NAMES } from './Icon';
import styles from './IconButton.module.css';

/** size: md 34/r10 · sm 28/r8 · xs 26/r8 · round 32 (пілюля) · xl 38 (аватар у хедері). variant: white | muted */
export default function IconButton({
  icon,
  label,
  size = 'md',
  variant = 'white',
  iconSize = 15,
  to = null,
  className = '',
  ...rest
}) {
  const cls = cx(styles.btn, styles[size], styles[variant], className);
  if (to) {
    return (
      <Link to={to} aria-label={label} className={cls} {...rest}>
        <Icon name={icon} size={iconSize} />
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} className={cls} {...rest}>
      <Icon name={icon} size={iconSize} />
    </button>
  );
}

IconButton.propTypes = {
  icon: PropTypes.oneOf(ICON_NAMES).isRequired,
  label: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['md', 'sm', 'xs', 'round', 'xl']),
  variant: PropTypes.oneOf(['white', 'muted']),
  iconSize: PropTypes.number,
  to: PropTypes.string,
  className: PropTypes.string,
};
