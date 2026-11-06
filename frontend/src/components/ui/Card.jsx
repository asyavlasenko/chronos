// Дизайн: 01-overview.html (білі картки з заголовком 15/700 і дією праворуч)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import styles from './Card.module.css';

/**
 * Біла картка (radius 18, padding 18). variant: white | dark | muted.
 * title/subtitle/action — шапка картки; gap — відступ між дочірніми елементами (flex column).
 */
export default function Card({
  children = null,
  title = null,
  subtitle = null,
  action = null,
  variant = 'white',
  padding = '18px',
  radius = 18,
  gap = 10,
  as: Tag = 'section',
  className = '',
  style = {},
  ...rest
}) {
  return (
    <Tag
      className={cx(styles.card, styles[variant], className)}
      style={{ padding, borderRadius: radius, gap, ...style }}
      {...rest}
    >
      {title || action ? (
        <div className={styles.head}>
          <div className={styles.titles}>
            {title ? <span className={styles.title}>{title}</span> : null}
            {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
          </div>
          {action ? <div className={styles.action}>{action}</div> : null}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}

Card.propTypes = {
  children: PropTypes.node,
  title: PropTypes.node,
  subtitle: PropTypes.node,
  action: PropTypes.node,
  variant: PropTypes.oneOf(['white', 'dark', 'muted']),
  padding: PropTypes.string,
  radius: PropTypes.number,
  gap: PropTypes.number,
  as: PropTypes.elementType,
  className: PropTypes.string,
  style: PropTypes.shape({}),
};
