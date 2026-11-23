import PropTypes from 'prop-types';
import Modal from '../ui/Modal';
import IconButton from '../ui/IconButton';
import Toggle from '../ui/Toggle';
import { MODULE_KEYS, MODULE_LABELS } from './useHiddenModules';
import styles from './ModulesSettingsModal.module.css';

const TITLE = 'Що показувати на головній';

export default function ModulesSettingsModal({ open, onClose, hidden, onChange }) {
  return (
    <Modal open={open} onClose={onClose} label={TITLE} width={420} padding={22} gap={14}>
      <div className={styles.head}>
        <h2 className={styles.title}>{TITLE}</h2>
        <IconButton
          icon="x"
          label="Закрити"
          size="round"
          variant="muted"
          iconSize={14}
          onClick={onClose}
        />
      </div>
      <span className={styles.note}>Дошка завжди на місці, решту блоків можна сховати.</span>
      <ul className={styles.list}>
        {MODULE_KEYS.map((key) => (
          <li key={key} className={styles.row}>
            <span className={styles.name}>{MODULE_LABELS[key]}</span>
            <Toggle
              checked={!hidden.includes(key)}
              onChange={(isShown) => onChange(key, !isShown)}
              label={`Показувати блок «${MODULE_LABELS[key]}»`}
            />
          </li>
        ))}
      </ul>
    </Modal>
  );
}

ModulesSettingsModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  hidden: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
};
