// Дизайн: 01-overview.html («Наступна через 48 хв»), 04-day.html, 06-year.html (підсумок року)
import PropTypes from 'prop-types';
import Card from './Card';
import styles from './DarkCard.module.css';

/**
 * Темна «героїчна» картка: eyebrow (11/600 uppercase, opacity .7) · value (34/700) · title · meta · children · footer.
 * Одна на екран.
 */
export default function DarkCard({
  eyebrow = null,
  value = null,
  valueSize = 34,
  title = null,
  meta = null,
  children = null,
  footer = null,
  className = '',
  ...rest
}) {
  return (
    <Card variant="dark" gap={6} className={className} {...rest}>
      {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
      {value ? (
        <span className={styles.value} style={{ fontSize: valueSize }}>
          {value}
        </span>
      ) : null}
      {title ? <span className={styles.title}>{title}</span> : null}
      {meta ? <span className={styles.meta}>{meta}</span> : null}
      {children}
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </Card>
  );
}

DarkCard.propTypes = {
  eyebrow: PropTypes.node,
  value: PropTypes.node,
  valueSize: PropTypes.number,
  title: PropTypes.node,
  meta: PropTypes.node,
  children: PropTypes.node,
  footer: PropTypes.node,
  className: PropTypes.string,
};
