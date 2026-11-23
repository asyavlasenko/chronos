import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import Icon from '../ui/Icon';
import styles from './BoardModule.module.css';

export default function BoardModule({ label, onHide, children, className = '' }) {
  return (
    <div className={cx(styles.module, className)}>
      {children}
      <button
        type="button"
        className={styles.hide}
        aria-label={`Сховати блок «${label}»`}
        title="Сховати"
        onClick={onHide}
      >
        <Icon name="x" size={11} strokeWidth={2.6} />
      </button>
    </div>
  );
}

BoardModule.propTypes = {
  label: PropTypes.string.isRequired,
  onHide: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};
