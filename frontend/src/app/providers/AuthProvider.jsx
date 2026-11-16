import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import * as authApi from '../../api/auth.api';
import * as usersApi from '../../api/users.api';
import { setAccessToken, setUnauthorizedHandler } from '../../api/client';

export const AuthContext = createContext(null);

function normalizeUser(user) {
  if (!user) return null;
  const firstName = (user.name || '').trim().split(' ')[0];
  return { ...user, firstName };
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  const applySession = useCallback((data) => {
    const nextUser = normalizeUser(data.user);
    setAccessToken(data.accessToken);
    setUser(nextUser);
    return nextUser;
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  useEffect(() => {
    let isActive = true;
    authApi
      .refresh()
      .then((data) => {
        if (isActive) setUser(normalizeUser(data.user));
      })
      .catch(() => null)
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  const login = useCallback(
    async ({ email, password, remember = true }) =>
      applySession(await authApi.login({ email, password, remember })),
    [applySession],
  );

  const register = useCallback(
    async ({ email, password, name }) =>
      applySession(await authApi.register({ email, password, name })),
    [applySession],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    clearSession();
  }, [clearSession]);

  const updateUser = useCallback(async (patch) => {
    const data = await usersApi.updateMe(patch);
    const nextUser = normalizeUser(data.user);
    setUser(nextUser);
    return nextUser;
  }, []);

  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    const data = await usersApi.changePassword({ currentPassword, newPassword });
    if (data?.accessToken) setAccessToken(data.accessToken);
  }, []);

  const logoutEverywhere = useCallback(async () => {
    await usersApi.logoutEverywhere();
    await authApi.logout().catch(() => null);
    clearSession();
  }, [clearSession]);

  const requestPasswordReset = useCallback((email) => authApi.requestPasswordReset(email), []);

  const confirmPasswordReset = useCallback(
    async ({ token, password }) => {
      await authApi.confirmPasswordReset({ token, password });
      clearSession();
    },
    [clearSession],
  );

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login,
      register,
      logout,
      updateUser,
      changePassword,
      logoutEverywhere,
      requestPasswordReset,
      confirmPasswordReset,
    }),
    [
      user,
      isLoading,
      login,
      register,
      logout,
      updateUser,
      changePassword,
      logoutEverywhere,
      requestPasswordReset,
      confirmPasswordReset,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
