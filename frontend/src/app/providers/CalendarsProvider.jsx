import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import * as calendarsApi from '../../api/calendars.api';
import { parseApiError } from '../../api/errors';
import useAuth from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import { normalizeCalendar } from '../../utils/normalize';

export const CalendarsContext = createContext(null);

export const HOLIDAYS_CALENDAR_ID = 'holidays';

const COUNTRY_GENITIVE = {
  UA: 'України',
  PL: 'Польщі',
  DE: 'Німеччини',
  US: 'США',
  GB: 'Великої Британії',
};

const EDITABLE_FIELDS = ['name', 'description', 'color'];

function holidaysCalendar(user) {
  const country = COUNTRY_GENITIVE[user.country];
  return {
    id: HOLIDAYS_CALENDAR_ID,
    name: country ? `Свята ${country}` : `Свята (${user.country})`,
    description: 'Автоматично за країною з профілю',
    color: 'holidays',
    owner: null,
    isMain: false,
    isShared: false,
    isReadOnly: true,
    myRole: 'viewer',
    myColor: null,
    isHidden: !user.showHolidays,
    members: [],
    pendingInvites: [],
    eventsCount: 0,
  };
}

export default function CalendarsProvider({ children }) {
  const { user, updateUser } = useAuth();
  const { notifyError } = useToast();
  const [items, setItems] = useState([]);
  const [loadedFor, setLoadedFor] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [revision, setRevision] = useState(0);
  const userId = user?.id || null;

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setError(null);
      setLoadedFor(null);
      return undefined;
    }

    let isActive = true;
    calendarsApi
      .listCalendars()
      .then((list) => {
        if (!isActive) return;
        setItems(list.map(normalizeCalendar));
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
  }, [userId, reloadKey]);

  const replace = useCallback((calendar) => {
    const next = normalizeCalendar(calendar);
    setItems((list) => list.map((c) => (c.id === next.id ? next : c)));
    return next;
  }, []);

  const patchLocal = useCallback((id, changes) => {
    setItems((list) => list.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  }, []);

  const reload = useCallback(() => {
    setLoadedFor(null);
    setReloadKey((key) => key + 1);
  }, []);

  const reloadSilently = useCallback(async () => {
    try {
      const list = await calendarsApi.listCalendars();
      setItems(list.map(normalizeCalendar));
    } catch {
      setReloadKey((key) => key + 1);
    }
  }, []);

  const refresh = useCallback(async () => {
    await reloadSilently();
    setRevision((value) => value + 1);
  }, [reloadSilently]);

  const toggleVisibility = useCallback(
    async (id) => {
      if (id === HOLIDAYS_CALENDAR_ID) {
        try {
          await updateUser({ showHolidays: !user.showHolidays });
        } catch (err) {
          notifyError(err);
        }
        return;
      }

      const current = items.find((c) => c.id === id);
      if (!current || current.isMain) return;

      const isHidden = !current.isHidden;
      patchLocal(id, { isHidden });
      try {
        replace(await calendarsApi.updateVisibility(id, { isHidden }));
      } catch (err) {
        patchLocal(id, { isHidden: current.isHidden });
        notifyError(err);
      }
    },
    [items, user, updateUser, patchLocal, replace, notifyError],
  );

  const setMyColor = useCallback(
    async (id, color) => {
      const current = items.find((c) => c.id === id);
      if (!current) return;

      patchLocal(id, {
        myColor: color,
        members: current.members.map((m) => (m.user === userId ? { ...m, color } : m)),
      });
      try {
        replace(await calendarsApi.updateVisibility(id, { color }));
      } catch (err) {
        patchLocal(id, { myColor: current.myColor, members: current.members });
        notifyError(err);
      }
    },
    [items, userId, patchLocal, replace, notifyError],
  );

  const updateCalendar = useCallback(
    async (id, patch) => {
      const payload = {};
      EDITABLE_FIELDS.forEach((key) => {
        if (patch[key] !== undefined) payload[key] = patch[key];
      });
      return replace(await calendarsApi.updateCalendar(id, payload));
    },
    [replace],
  );

  const createCalendar = useCallback(async (dto) => {
    const created = normalizeCalendar(await calendarsApi.createCalendar(dto));
    setItems((list) => [...list, created]);
    return created.id;
  }, []);

  const removeCalendar = useCallback(async (id) => {
    await calendarsApi.deleteCalendar(id);
    setItems((list) => list.filter((c) => c.id !== id));
    setRevision((value) => value + 1);
  }, []);

  const reloadOne = useCallback(
    async (id) => replace(await calendarsApi.getCalendar(id)),
    [replace],
  );

  const shareCalendar = useCallback(
    async (id, { email, role }) => {
      const invite = await calendarsApi.shareCalendar(id, { email, role });
      await reloadOne(id);
      return invite;
    },
    [reloadOne],
  );

  const updateMemberRole = useCallback(
    async (id, memberId, role) => replace(await calendarsApi.updateMemberRole(id, memberId, role)),
    [replace],
  );

  const removeMember = useCallback(
    async (id, memberId) => {
      await calendarsApi.removeMember(id, memberId);
      if (memberId === userId) {
        setItems((list) => list.filter((c) => c.id !== id));
      } else {
        await reloadOne(id);
      }
      setRevision((value) => value + 1);
    },
    [userId, reloadOne],
  );

  const cancelInvite = useCallback(
    async (id, inviteId) => {
      await calendarsApi.cancelInvite(id, inviteId);
      await reloadOne(id);
    },
    [reloadOne],
  );

  const value = useMemo(() => {
    const calendars = user ? [...items, holidaysCalendar(user)] : [];
    const byId = Object.fromEntries(calendars.map((c) => [c.id, c]));
    return {
      calendars,
      byId,
      getCalendar: (id) => byId[id],
      visibleIds: calendars.filter((c) => !c.isHidden).map((c) => c.id),
      mainCalendar: calendars.find((c) => c.isMain) || null,
      isLoading: Boolean(userId) && loadedFor !== userId,
      error,
      revision,
      reload,
      reloadSilently,
      refresh,
      toggleVisibility,
      setMyColor,
      updateCalendar,
      createCalendar,
      removeCalendar,
      shareCalendar,
      updateMemberRole,
      removeMember,
      cancelInvite,
    };
  }, [
    user,
    userId,
    items,
    loadedFor,
    error,
    revision,
    reload,
    reloadSilently,
    refresh,
    toggleVisibility,
    setMyColor,
    updateCalendar,
    createCalendar,
    removeCalendar,
    shareCalendar,
    updateMemberRole,
    removeMember,
    cancelInvite,
  ]);

  return <CalendarsContext.Provider value={value}>{children}</CalendarsContext.Provider>;
}

CalendarsProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
