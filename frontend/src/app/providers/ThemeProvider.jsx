import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import useAuth from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import {
  applyTheme,
  loadStoredTheme,
  normalizeTheme,
  sameTheme,
  storeTheme,
  watchSystemScheme,
} from '../../utils/theme';

export const ThemeContext = createContext(null);

export default function ThemeProvider({ children }) {
  const { user, updateUser } = useAuth();
  const { notifyError } = useToast();
  const [theme, setThemeState] = useState(loadStoredTheme);
  const savedColor = user?.theme?.color;
  const savedMode = user?.theme?.mode;

  useEffect(() => {
    if (!savedColor || !savedMode) return;
    const saved = normalizeTheme({ color: savedColor, mode: savedMode });
    setThemeState((current) => (sameTheme(current, saved) ? current : saved));
  }, [savedColor, savedMode]);

  useEffect(() => {
    applyTheme(theme);
    storeTheme(theme);
    if (theme.mode !== 'system') return undefined;
    return watchSystemScheme(() => applyTheme(theme));
  }, [theme]);

  const setTheme = useCallback(
    (changes) => {
      const next = normalizeTheme({ ...theme, ...changes });
      if (sameTheme(next, theme)) return;

      setThemeState(next);
      if (user) updateUser({ theme: next }).catch(notifyError);
    },
    [theme, user, updateUser, notifyError],
  );

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
