// Дизайн: 01-overview.html (хедер: лого · Огляд · Календар · Задачі · Календарі · пошук · «Створити» · аватар),
// 16-mobile.html (мобільний: кнопка пошуку + аватар з ініціалами; навігація — у MobileTabBar)
import { useState } from 'react';
import { NavLink, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import cx from '../../utils/cx';
import { initials } from '../../utils/text';
import useAuth from '../../hooks/useAuth';
import Icon from '../ui/Icon';
import PillButton from '../ui/PillButton';
import styles from './AppHeader.module.css';

const NAV = [
  { to: '/', label: 'Огляд', end: true },
  { to: '/calendar', label: 'Календар' },
  { to: '/tasks', label: 'Задачі' },
  { to: '/calendars', label: 'Календарі' },
];

export default function AppHeader() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [mobileSearch, setMobileSearch] = useState(false);

  const isTasks = location.pathname.startsWith('/tasks');
  const isCalendar = location.pathname.startsWith('/calendar/');

  const submit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (isCalendar || isTasks) {
      setSearchParams((prev) => {
        const sp = new URLSearchParams(prev);
        if (q) sp.set('q', q);
        else sp.delete('q');
        return sp;
      });
    } else {
      navigate(q ? `/calendar/week?q=${encodeURIComponent(q)}` : '/calendar/week');
    }
  };

  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo} aria-label="Chronos">
        <span className={styles.logoMark}>
          <Icon name="logo" size={15} strokeWidth={2.4} />
        </span>
        <span className={styles.logoText}>Chronos</span>
      </Link>

      <nav className={styles.nav} aria-label="Розділи">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cx(styles.navLink, isActive && styles.navActive)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <span className={styles.spacer} />

      <form
        className={cx(styles.search, mobileSearch && styles.searchOpen)}
        role="search"
        onSubmit={submit}
      >
        <Icon name="search" size={14} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isTasks ? 'Пошук задач' : 'Пошук подій'}
          aria-label={isTasks ? 'Пошук задач' : 'Пошук подій'}
          className={styles.searchInput}
        />
      </form>

      <button
        type="button"
        className={styles.mobileSearchBtn}
        aria-label="Пошук"
        onClick={() => setMobileSearch((v) => !v)}
      >
        <Icon name="search" size={16} />
      </button>

      <PillButton to="/events/new" icon="plus" className={styles.create}>
        Створити
      </PillButton>

      <Link to="/profile" aria-label="Профіль" className={styles.avatar}>
        <Icon name="user" size={16} className={styles.avatarIcon} />
        <span className={styles.avatarInitials}>{initials(user?.name || '')}</span>
      </Link>
    </header>
  );
}
