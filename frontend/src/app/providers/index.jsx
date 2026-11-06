import PropTypes from 'prop-types';
import AuthProvider from './AuthProvider';
import CalendarsProvider from './CalendarsProvider';
import EventsProvider from './EventsProvider';

// Глобальні провайдери. ModalsProvider живе всередині роутера (потрібен useSearchParams) — див. PageShell.
export default function Providers({ children }) {
  return (
    <AuthProvider>
      <CalendarsProvider>
        <EventsProvider>{children}</EventsProvider>
      </CalendarsProvider>
    </AuthProvider>
  );
}

Providers.propTypes = {
  children: PropTypes.node.isRequired,
};
