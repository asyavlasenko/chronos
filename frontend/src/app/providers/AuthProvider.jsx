import { createContext, useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { currentUser } from '../../mocks/data';

// Стан авторизації. Зараз — мок-користувач; TODO(@teammate2): POST /auth/refresh → GET /users/me,
// accessToken тримати в пам'яті (api/client.setAccessToken), refresh — httpOnly cookie.
export const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(currentUser);
  const [isLoading] = useState(false);

  const login = useCallback(async () => setUser(currentUser), []);
  const register = useCallback(async () => setUser(currentUser), []);
  const logout = useCallback(async () => setUser(null), []);
  const updateUser = useCallback((patch) => setUser((u) => ({ ...u, ...patch })), []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout, updateUser }),
    [user, isLoading, login, register, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
