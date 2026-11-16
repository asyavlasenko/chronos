import PropTypes from 'prop-types';
import styles from './PageLoader.module.css';

export default function PageLoader({ label = 'Завантаження…' }) {
  return (
    <div className={styles.page} role="status" aria-live="polite" aria-label={label}>
      <span className={styles.spinner} />
    </div>
  );
}

PageLoader.propTypes = {
  label: PropTypes.string,
};
