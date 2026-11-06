import { createContext, useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  events as mockEvents,
  holidays as mockHolidays,
  invites as mockInvites,
} from '../../mocks/data';

// Події, свята, запрошення. Локальний стан з мок-даних; CRUD оновлює стан, щоб UI поводився як справжній.
// TODO(@teammate2): замінити на events.api / holidays.api / invites.api
export const EventsContext = createContext(null);

export default function EventsProvider({ children }) {
  const [events, setEvents] = useState(mockEvents);
  const [holidays] = useState(mockHolidays);
  const [invites, setInvites] = useState(mockInvites);
  const [isLoading] = useState(false);

  const createEvent = useCallback((dto) => {
    const id = `e-${Date.now()}`;
    setEvents((list) => [
      ...list,
      {
        id,
        creator: 'u-me',
        allDay: false,
        color: null,
        location: '',
        description: '',
        reminderMinutesBefore: 10,
        isCompleted: false,
        priority: 'medium',
        participants: [],
        ...dto,
      },
    ]);
    return id;
  }, []);

  const updateEvent = useCallback((id, changes) => {
    setEvents((list) =>
      list.map((e) =>
        e.id === id ? { ...e, ...(typeof changes === 'function' ? changes(e) : changes) } : e,
      ),
    );
  }, []);

  const deleteEvent = useCallback((id) => {
    setEvents((list) => list.filter((e) => e.id !== id));
  }, []);

  const toggleCompleted = useCallback(
    (id) =>
      updateEvent(id, (e) => ({
        isCompleted: !e.isCompleted,
        completedAt: e.isCompleted ? null : new Date(),
      })),
    [updateEvent],
  );

  const respondInvite = useCallback(
    (id, status) => {
      setInvites((list) => list.map((i) => (i.id === id ? { ...i, status } : i)));
      if (status === 'accepted') {
        const invite = invites.find((i) => i.id === id);
        if (invite?.kind === 'event' && invite.event) {
          setEvents((list) =>
            list.some((e) => e.id === invite.event.id) ? list : [...list, invite.event],
          );
        }
      }
    },
    [invites],
  );

  const value = useMemo(
    () => ({
      events,
      holidays,
      invites,
      pendingInvites: invites.filter((i) => i.status === 'pending'),
      isLoading,
      getEvent: (id) => events.find((e) => e.id === id) || null,
      createEvent,
      updateEvent,
      deleteEvent,
      toggleCompleted,
      respondInvite,
      reload: async () => {},
    }),
    [
      events,
      holidays,
      invites,
      isLoading,
      createEvent,
      updateEvent,
      deleteEvent,
      toggleCompleted,
      respondInvite,
    ],
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

EventsProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
