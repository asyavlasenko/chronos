import { Outlet } from 'react-router-dom';

// TODO(@teammate2): якщо useAuth().user === null і не isLoading → <Navigate to="/login" state={{ from }} />.
// Під час isLoading показувати порожній екран/скелетон, а не редіректити.
// ЗАГЛУШКА: пропускає всіх, щоб роутер можна було перевірити без бекенду.
export default function RequireAuth() {
  return <Outlet />;
}
