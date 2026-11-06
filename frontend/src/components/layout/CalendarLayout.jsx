// Дизайн: 02-week-cards.html — лейаут маршрутів /calendar/*: тулбар + подання. Дата — ?date=, подання — з URL.
import { Outlet, useLocation } from 'react-router-dom';
import CalendarToolbar from './CalendarToolbar';

export function viewFromPath(pathname) {
  if (pathname.startsWith('/calendar/day')) return { view: 'day', mode: 'cards' };
  if (pathname.startsWith('/calendar/week/timeline')) return { view: 'week', mode: 'timeline' };
  if (pathname.startsWith('/calendar/week')) return { view: 'week', mode: 'cards' };
  if (pathname.startsWith('/calendar/month')) return { view: 'month', mode: 'cards' };
  if (pathname.startsWith('/calendar/year')) return { view: 'year', mode: 'cards' };
  return { view: 'week', mode: 'cards' };
}

export default function CalendarLayout() {
  const { pathname } = useLocation();
  const { view, mode } = viewFromPath(pathname);
  return (
    <>
      <CalendarToolbar view={view} mode={mode} />
      <Outlet context={{ view, mode }} />
    </>
  );
}
