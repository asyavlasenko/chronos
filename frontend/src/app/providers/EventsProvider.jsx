import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { parseApiError } from '../../api/errors';
import * as eventsApi from '../../api/events.api';
import * as holidaysApi from '../../api/holidays.api';
import * as invitesApi from '../../api/invites.api';
import useAuth from '../../hooks/useAuth';
import useCalendars from '../../hooks/useCalendars';
import useToast from '../../hooks/useToast';
import { normalizeEvent, normalizeInvite, toEventPayload } from '../../utils/normalize';

export const EventsContext = createContext(null);

const FOCUS_REFETCH_MS = 60 * 1000;

export default function EventsProvider({ children }) {
  const { user } = useAuth();
  const { revision, reloadSilently: reloadCalendars, refresh: refreshCalendars } = useCalendars();
  const { notifyError } = useToast();
  const [events, setEvents] = useState([]);
  const [invites, setInvites] = useState([]);
  const [holidaysByKey, setHolidaysByKey] = useState({});
  const [loadedFor, setLoadedFor] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestedHolidays = useRef(new Set());
  const userId = user?.id || null;
  const country = user?.country || null;

  useEffect(() => {
    if (!userId) {
      setEvents([]);
      setInvites([]);
      setError(null);
      setLoadedFor(null);
      return undefined;
    }

    let isActive = true;
    Promise.all([eventsApi.listEvents({ includeHidden: true }), invitesApi.listMyInvites()])
      .then(([list, myInvites]) => {
        if (!isActive) return;
        setEvents(list.map(normalizeEvent));
        setInvites(myInvites.map(normalizeInvite));
        setError(null);
      })
      .catch((err) => {
        if (isActive) setError(parseApiError(err).message);
      })
      .finally(() => {
        if (isActive) setLoadedFor(userId);
      });

    return () => {
      isActive = false;
    };
  }, [userId, revision, reloadKey]);

  useEffect(() => {
    if (!userId) return undefined;

    let lastFetch = Date.now();
    const onFocus = () => {
      if (Date.now() - lastFetch < FOCUS_REFETCH_MS) return;
      lastFetch = Date.now();
      setReloadKey((key) => key + 1);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [userId]);

  const ensureHolidays = useCallback(
    (year) => {
      if (!userId || !country) return;

      const key = `${country}:${year}`;
      if (requestedHolidays.current.has(key)) return;
      requestedHolidays.current.add(key);

      holidaysApi
        .listHolidays({ year })
        .then((data) => setHolidaysByKey((map) => ({ ...map, [key]: data.holidays })))
        .catch(() => requestedHolidays.current.delete(key));
    },
    [userId, country],
  );

  useEffect(() => {
    requestedHolidays.current = new Set();
    setHolidaysByKey({});
    if (!userId || !country) return;

    const year = new Date().getFullYear();
    ensureHolidays(year);
    ensureHolidays(year + 1);
  }, [userId, country, ensureHolidays]);

  const reload = useCallback(() => {
    setLoadedFor(null);
    setReloadKey((key) => key + 1);
  }, []);

  const upsert = useCallback((event) => {
    const next = normalizeEvent(event);
    setEvents((list) =>
      list.some((e) => e.id === next.id)
        ? list.map((e) => (e.id === next.id ? next : e))
        : [...list, next],
    );
    return next;
  }, []);

  const createEvent = useCallback(
    async (dto) => {
      const created = upsert(await eventsApi.createEvent(toEventPayload(dto)));
      reloadCalendars();
      return created.id;
    },
    [upsert, reloadCalendars],
  );

  const saveEvent = useCallback(
    async (id, dto) => upsert(await eventsApi.updateEvent(id, toEventPayload(dto))),
    [upsert],
  );

  const updateEvent = useCallback(
    async (id, changes) => {
      const current = events.find((e) => e.id === id);
      if (!current) return false;

      const patch = typeof changes === 'function' ? changes(current) : changes;
      setEvents((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      try {
        upsert(await eventsApi.updateEvent(id, toEventPayload(patch)));
        return true;
      } catch (err) {
        setEvents((list) => list.map((e) => (e.id === id ? current : e)));
        notifyError(err);
        return false;
      }
    },
    [events, upsert, notifyError],
  );

  const toggleCompleted = useCallback(
    (id) =>
      updateEvent(id, (e) => ({
        isCompleted: !e.isCompleted,
        completedAt: e.isCompleted ? null : new Date(),
      })),
    [updateEvent],
  );

  const deleteEvent = useCallback(
    async (id) => {
      const current = events.find((e) => e.id === id);
      if (!current) return false;

      setEvents((list) => list.filter((e) => e.id !== id));
      try {
        await eventsApi.deleteEvent(id);
        reloadCalendars();
        return true;
      } catch (err) {
        setEvents((list) => [...list, current]);
        notifyError(err);
        return false;
      }
    },
    [events, reloadCalendars, notifyError],
  );

  const inviteToEvent = useCallback(
    async (id, emails) => upsert(await eventsApi.inviteToEvent(id, emails)),
    [upsert],
  );

  const respondInvite = useCallback(
    async (id, status) => {
      const invite = invites.find((i) => i.id === id);
      if (!invite) return false;

      try {
        if (status === 'accepted') await invitesApi.acceptInvite(invite.token);
        else await invitesApi.declineInvite(invite.token);
        setInvites((list) => list.map((i) => (i.id === id ? { ...i, status } : i)));
        if (status === 'accepted') await refreshCalendars();
        return true;
      } catch (err) {
        notifyError(err);
        return false;
      }
    },
    [invites, refreshCalendars, notifyError],
  );

  const value = useMemo(() => {
    const holidays = Object.entries(holidaysByKey)
      .filter(([key]) => key.startsWith(`${country}:`))
      .flatMap(([, list]) => list);

    return {
      events,
      holidays,
      invites,
      pendingInvites: invites.filter((i) => i.status === 'pending'),
      isLoading: Boolean(userId) && loadedFor !== userId,
      error,
      getEvent: (id) => events.find((e) => e.id === id) || null,
      createEvent,
      saveEvent,
      updateEvent,
      deleteEvent,
      toggleCompleted,
      inviteToEvent,
      respondInvite,
      ensureHolidays,
      reload,
    };
  }, [
    events,
    holidaysByKey,
    invites,
    country,
    userId,
    loadedFor,
    error,
    createEvent,
    saveEvent,
    updateEvent,
    deleteEvent,
    toggleCompleted,
    inviteToEvent,
    respondInvite,
    ensureHolidays,
    reload,
  ]);

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

EventsProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
