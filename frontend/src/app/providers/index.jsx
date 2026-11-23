import PropTypes from 'prop-types';
import AuthProvider from './AuthProvider';
import CalendarsProvider from './CalendarsProvider';
import EventsProvider from './EventsProvider';
import ThemeProvider from './ThemeProvider';
import ToastProvider from './ToastProvider';

export default function Providers({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <ThemeProvider>
          <CalendarsProvider>
            <EventsProvider>{children}</EventsProvider>
          </CalendarsProvider>
        </ThemeProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

Providers.propTypes = {
  children: PropTypes.node.isRequired,
};
