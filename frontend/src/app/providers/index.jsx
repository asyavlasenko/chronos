import PropTypes from 'prop-types';
import AuthProvider from './AuthProvider';
import CalendarsProvider from './CalendarsProvider';
import EventsProvider from './EventsProvider';
import ToastProvider from './ToastProvider';

export default function Providers({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <CalendarsProvider>
          <EventsProvider>{children}</EventsProvider>
        </CalendarsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

Providers.propTypes = {
  children: PropTypes.node.isRequired,
};
