import { useContext, useMemo } from 'react';
import { EventsContext } from '../app/providers/EventsProvider';
import { CalendarsContext } from '../app/providers/CalendarsProvider';
import { toDate } from '../utils/dates';

/**
 * Події для подання: фільтр за діапазоном [from, to), видимими календарями, типами й пошуком.
 * Свята підмішуються як події типу 'holiday' календаря 'holidays' (весь день).
 * Без аргументів повертає всі події (для задач «без дати» тощо).
 */
export default function useEvents({ from, to, calendarIds, types, q, includeHidden = false } = {}) {
  const ctx = useContext(EventsContext);
  const cals = useContext(CalendarsContext);

  const holidayEvents = useMemo(
    () =>
      ctx.holidays.map((h) => {
        const [y, m, d] = h.date.split('-').map(Number);
        return {
          id: `holiday-${h.date}`,
          type: 'holiday',
          title: h.localName,
          calendar: 'holidays',
          startAt: new Date(y, m - 1, d),
          endAt: null,
          allDay: true,
          color: null,
          participants: [],
        };
      }),
    [ctx.holidays],
  );

  const events = useMemo(() => {
    const visible = new Set(includeHidden ? cals.calendars.map((c) => c.id) : cals.visibleIds);
    const allowedCals = calendarIds ? new Set(calendarIds) : null;
    const allowedTypes = types ? new Set(types) : null;
    const query = q ? q.trim().toLowerCase() : '';

    return [...ctx.events, ...holidayEvents]
      .filter((e) => visible.has(e.calendar))
      .filter((e) => !allowedCals || allowedCals.has(e.calendar))
      .filter((e) => !allowedTypes || allowedTypes.has(e.type))
      .filter(
        (e) =>
          !query ||
          e.title.toLowerCase().includes(query) ||
          (e.description || '').toLowerCase().includes(query),
      )
      .filter((e) => {
        if (!from && !to) return true;
        if (!e.startAt) return false;
        const s = toDate(e.startAt);
        const end = e.endAt ? toDate(e.endAt) : s;
        return (!to || s < to) && (!from || end >= from);
      })
      .sort((a, b) => (toDate(a.startAt) || 0) - (toDate(b.startAt) || 0));
  }, [
    ctx.events,
    holidayEvents,
    cals.calendars,
    cals.visibleIds,
    includeHidden,
    calendarIds,
    types,
    q,
    from,
    to,
  ]);

  return { ...ctx, events, holidayEvents };
}
