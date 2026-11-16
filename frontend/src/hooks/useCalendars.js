import { useContext } from 'react';
import { CalendarsContext } from '../app/providers/CalendarsProvider';

export default function useCalendars() {
  return useContext(CalendarsContext);
}
