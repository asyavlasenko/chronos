import { createBrowserRouter, Navigate } from 'react-router-dom';
import RequireAuth from './RequireAuth';
import PageShell from '../components/layout/PageShell';
import CalendarLayout from '../components/layout/CalendarLayout';
import OverviewPage from '../pages/OverviewPage';
import DayPage from '../pages/DayPage';
import WeekPage from '../pages/WeekPage';
import WeekTimelinePage from '../pages/WeekTimelinePage';
import MonthPage from '../pages/MonthPage';
import YearPage from '../pages/YearPage';
import TasksPage from '../pages/TasksPage';
import CalendarsPage from '../pages/CalendarsPage';
import SharedCalendarPage from '../pages/SharedCalendarPage';
import EventCreatePage from '../pages/EventCreatePage';
import AuthPage from '../pages/AuthPage';
import ProfilePage from '../pages/ProfilePage';
import InvitePage from '../pages/InvitePage';
import NotFoundPage from '../pages/NotFoundPage';

// Стан подання календаря живе в URL: ?date=2026-11-05 (яка дата показана), ?event=<id> (відкрита модалка деталей).
const router = createBrowserRouter([
  // Публічні сторінки (без хедера)
  { path: '/login', element: <AuthPage mode="login" /> },
  { path: '/register', element: <AuthPage mode="register" /> },
  { path: '/reset', element: <AuthPage mode="reset" /> },
  { path: '/invite/:token', element: <InvitePage /> },

  // Захищені сторінки у спільній оболонці (хедер + мобільна навігація)
  {
    element: <RequireAuth />,
    children: [
      {
        element: <PageShell />,
        children: [
          { index: true, element: <OverviewPage /> },
          {
            path: 'calendar',
            element: <CalendarLayout />,
            children: [
              { index: true, element: <Navigate to="week" replace /> },
              { path: 'day', element: <DayPage /> },
              { path: 'week', element: <WeekPage /> },
              { path: 'week/timeline', element: <WeekTimelinePage /> },
              { path: 'month', element: <MonthPage /> },
              { path: 'year', element: <YearPage /> },
            ],
          },
          { path: 'tasks', element: <TasksPage /> },
          { path: 'calendars', element: <CalendarsPage /> },
          { path: 'calendars/:id', element: <SharedCalendarPage /> },
          { path: 'events/new', element: <EventCreatePage /> },
          { path: 'events/:id', element: <EventCreatePage /> }, // редагування: та сама форма в режимі edit
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
]);

export default router;
