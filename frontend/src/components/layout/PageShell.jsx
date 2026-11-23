import { useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { EventsContext } from '../../app/providers/EventsProvider';
import ModalsProvider from '../../app/providers/ModalsProvider';
import useCalendars from '../../hooks/useCalendars';
import EventDetailsModal from '../../modals/EventDetailsModal';
import QuickCreateModal from '../../modals/QuickCreateModal';
import AssistantWidget from '../assistant/AssistantWidget';
import Card from '../ui/Card';
import PageLoader from '../ui/PageLoader';
import PillButton from '../ui/PillButton';
import AppHeader from './AppHeader';
import Fab from './Fab';
import MobileTabBar from './MobileTabBar';
import styles from './PageShell.module.css';

function ShellContent() {
  const calendars = useCalendars();
  const events = useContext(EventsContext);

  if (calendars.isLoading || events.isLoading) {
    return (
      <div className={styles.state}>
        <PageLoader />
      </div>
    );
  }

  const error = calendars.error || events.error;
  if (error) {
    const retry = () => {
      calendars.reload();
      events.reload();
    };
    return (
      <Card className={styles.error} title="Не вдалося завантажити дані" gap={12}>
        <p className={styles.errorText}>{error}</p>
        <PillButton onClick={retry}>Спробувати ще</PillButton>
      </Card>
    );
  }

  return <Outlet />;
}

export default function PageShell() {
  return (
    <ModalsProvider>
      <div className={styles.page}>
        <AppHeader />
        <main className={styles.main}>
          <ShellContent />
        </main>
      </div>
      <MobileTabBar />
      <Fab />
      <AssistantWidget />
      <QuickCreateModal />
      <EventDetailsModal />
    </ModalsProvider>
  );
}
