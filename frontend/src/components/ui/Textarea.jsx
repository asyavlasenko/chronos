// Дизайн: 10-event-create.html (опис події)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import styles from './Textarea.module.css';

export default function Textarea({ rows = 4, invalid = false, className = '', ...rest }) {
  return (
    <textarea
      rows={rows}
      className={cx(styles.textarea, invalid && styles.invalid, className)}
      {...rest}
    />
  );
}

Textarea.propTypes = {
  rows: PropTypes.number,
  invalid: PropTypes.bool,
  className: PropTypes.string,
};
