import { createContext, useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { calendars as mockCalendars } from '../../mocks/data';

// Календарі користувача + віртуальний 'holidays'. Видимість (isHidden) — налаштування учасника.
// TODO(@teammate2): замінити мок на calendars.api (GET /calendars, PATCH /calendars/:id/visibility …)
export const CalendarsContext = createContext(null);

export default function CalendarsProvider({ children }) {
  const [calendars, setCalendars] = useState(mockCalendars);
  const [isLoading] = useState(false);

  const patch = useCallback((id, changes) => {
    setCalendars((list) =>
      list.map((c) =>
        c.id === id ? { ...c, ...(typeof changes === 'function' ? changes(c) : changes) } : c,
      ),
    );
  }, []);

  const toggleVisibility = useCallback(
    (id) => patch(id, (c) => (c.isMain ? c : { isHidden: !c.isHidden })),
    [patch],
  );

  const createCalendar = useCallback((dto) => {
    const id = `cal-${Date.now()}`;
    setCalendars((list) => [
      ...list,
      {
        id,
        name: dto.name,
        description: dto.description || '',
        color: dto.color || 'blue',
        owner: 'u-me',
        isMain: false,
        isShared: false,
        myRole: 'owner',
        myColor: null,
        isHidden: false,
        members: [{ user: 'u-me', name: 'Ти', email: 'asia@mail.com', role: 'owner', color: null, isHidden: false }],
        eventsCount: 0,
      },
    ]);
    return id;
  }, []);

  const removeCalendar = useCallback((id) => {
    setCalendars((list) => list.filter((c) => c.id !== id || c.isMain));
  }, []);

  const value = useMemo(() => {
    const byId = Object.fromEntries(calendars.map((c) => [c.id, c]));
    return {
      calendars,
      isLoading,
      byId,
      getCalendar: (id) => byId[id],
      visibleIds: calendars.filter((c) => !c.isHidden).map((c) => c.id),
      toggleVisibility,
      updateCalendar: patch,
      createCalendar,
      removeCalendar,
      reload: async () => {},
    };
  }, [calendars, isLoading, toggleVisibility, patch, createCalendar, removeCalendar]);

  return <CalendarsContext.Provider value={value}>{children}</CalendarsContext.Provider>;
}

CalendarsProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
