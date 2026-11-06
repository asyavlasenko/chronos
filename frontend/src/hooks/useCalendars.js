import { useContext } from 'react';
import { CalendarsContext } from '../app/providers/CalendarsProvider';

/** { calendars, byId, getCalendar, visibleIds, toggleVisibility, updateCalendar, createCalendar, removeCalendar } */
export default function useCalendars() {
  return useContext(CalendarsContext);
}
