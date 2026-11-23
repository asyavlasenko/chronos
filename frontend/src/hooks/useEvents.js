import { useContext, useEffect, useMemo } from 'react';
import { EventsContext } from '../app/providers/EventsProvider';
import { CalendarsContext } from '../app/providers/CalendarsProvider';
import { toDate } from '../utils/dates';

const matchesQuery = (event, query) =>
  !query ||
  event.title.toLowerCase().includes(query) ||
  (event.description || '').toLowerCase().includes(query);

const byCompletion = (a, b) => Number(Boolean(a.isCompleted)) - Number(Boolean(b.isCompleted));

const byNewest = (a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0);

export default function useEvents({
  from,
  to,
  calendarIds,
  types,
  q,
  includeHidden = false,
  includeFloating = false,
} = {}) {
  const ctx = useContext(EventsContext);
  const cals = useContext(CalendarsContext);
  const { ensureHolidays } = ctx;

  const fromYear = from ? from.getFullYear() : null;
  const toYear = to ? new Date(to.getTime() - 1).getFullYear() : null;

  useEffect(() => {
    if (fromYear === null || toYear === null) return;
    for (let year = fromYear; year <= toYear; year += 1) ensureHolidays(year);
  }, [fromYear, toYear, ensureHolidays]);

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
      .filter((e) => includeFloating || !e.isFloating)
      .filter((e) => !allowedCals || allowedCals.has(e.calendar))
      .filter((e) => !allowedTypes || allowedTypes.has(e.type))
      .filter((e) => matchesQuery(e, query))
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
    includeFloating,
    calendarIds,
    types,
    q,
    from,
    to,
  ]);

  const floatingTasks = useMemo(() => {
    const visible = new Set(cals.visibleIds);
    const query = q ? q.trim().toLowerCase() : '';

    return ctx.events
      .filter((e) => e.isFloating && visible.has(e.calendar))
      .filter((e) => matchesQuery(e, query))
      .sort((a, b) => byCompletion(a, b) || byNewest(a, b));
  }, [ctx.events, cals.visibleIds, q]);

  return { ...ctx, events, holidayEvents, floatingTasks };
}
