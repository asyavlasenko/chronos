import { createContext, useCallback, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { parseApiError } from '../../api/errors';
import Toaster from '../../components/ui/Toaster';

export const ToastContext = createContext(null);

const MAX_VISIBLE = 3;

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message, { type = 'info', duration = 4500 } = {}) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((list) => [...list.slice(1 - MAX_VISIBLE), { id, message, type }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const notifyError = useCallback(
    (error, fallback) => {
      const parsed = parseApiError(error);
      notify(fallback && parsed.status === 0 ? fallback : parsed.message, { type: 'error' });
    },
    [notify],
  );

  const notifySuccess = useCallback((message) => notify(message, { type: 'success' }), [notify]);

  const value = useMemo(
    () => ({ notify, notifyError, notifySuccess }),
    [notify, notifyError, notifySuccess],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
