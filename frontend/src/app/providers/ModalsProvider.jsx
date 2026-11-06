import { createContext, useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useSearchParams } from 'react-router-dom';

// Модалки: швидке створення (локальний стан) і деталі події (?event=<id> в URL, щоб посилання працювали).
export const ModalsContext = createContext(null);

export default function ModalsProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [quickCreate, setQuickCreate] = useState(null); // { date: Date, startAt?: Date, endAt?: Date, calendarId?: string }

  const openQuickCreate = useCallback((opts = {}) => {
    setQuickCreate({ date: opts.date || new Date(), ...opts });
  }, []);
  const closeQuickCreate = useCallback(() => setQuickCreate(null), []);

  const openDetails = useCallback(
    (id) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('event', id);
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const closeDetails = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('event');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const value = useMemo(
    () => ({
      quickCreate,
      openQuickCreate,
      closeQuickCreate,
      detailsEventId: searchParams.get('event'),
      openDetails,
      closeDetails,
    }),
    [quickCreate, openQuickCreate, closeQuickCreate, searchParams, openDetails, closeDetails],
  );

  return <ModalsContext.Provider value={value}>{children}</ModalsContext.Provider>;
}

ModalsProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
