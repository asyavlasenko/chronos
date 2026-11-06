// Дизайн: 16-mobile.html (FAB «+» 56px, тінь --shadow-fab, над нижньою навігацією)
import useModals from '../../hooks/useModals';
import Icon from '../ui/Icon';
import styles from './Fab.module.css';

export default function Fab() {
  const { openQuickCreate } = useModals();
  return (
    <button
      type="button"
      aria-label="Створити подію"
      className={styles.fab}
      onClick={() => openQuickCreate({ date: new Date() })}
    >
      <Icon name="plus" size={22} strokeWidth={2.4} />
    </button>
  );
}
