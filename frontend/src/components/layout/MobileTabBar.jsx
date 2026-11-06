// Дизайн: 16-mobile.html (нижня навігація: Огляд · Календар · Задачі · Календарі, активний — темна пілюля)
import { NavLink } from 'react-router-dom';
import cx from '../../utils/cx';
import Icon from '../ui/Icon';
import styles from './MobileTabBar.module.css';

const ITEMS = [
  { to: '/', label: 'Огляд', icon: 'layout-dashboard', end: true },
  { to: '/calendar', label: 'Календар', icon: 'calendar' },
  { to: '/tasks', label: 'Задачі', icon: 'check-square' },
  { to: '/calendars', label: 'Календарі', icon: 'layout-grid' },
];

export default function MobileTabBar() {
  return (
    <nav className={styles.bar} aria-label="Основна навігація">
      {ITEMS.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) => cx(styles.item, isActive && styles.active)}
        >
          <span className={styles.icon}>
            <Icon name={it.icon} size={20} />
          </span>
          <span className={styles.label}>{it.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
