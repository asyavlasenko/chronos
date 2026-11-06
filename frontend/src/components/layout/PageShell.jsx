// Дизайн: 01-overview.html (десктоп), 16-mobile.html (мобільний)
import { Outlet } from 'react-router-dom';
import ModalsProvider from '../../app/providers/ModalsProvider';
import AppHeader from './AppHeader';
import MobileTabBar from './MobileTabBar';
import Fab from './Fab';
import QuickCreateModal from '../../modals/QuickCreateModal';
import EventDetailsModal from '../../modals/EventDetailsModal';
import styles from './PageShell.module.css';

/** Оболонка захищених сторінок: хедер + контент + мобільна навігація + FAB + глобальні модалки. */
export default function PageShell() {
  return (
    <ModalsProvider>
      <div className={styles.page}>
        <AppHeader />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      <MobileTabBar />
      <Fab />
      <QuickCreateModal />
      <EventDetailsModal />
    </ModalsProvider>
  );
}
