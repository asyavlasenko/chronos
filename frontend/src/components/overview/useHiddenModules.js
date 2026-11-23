import { useCallback, useMemo, useRef, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';

export const MODULE_KEYS = [
  'floating',
  'next',
  'tasks',
  'load',
  'shared',
  'invites',
  'holidays',
  'calendars',
];

export const MODULE_LABELS = {
  floating: 'Колись',
  next: 'Наступна подія',
  tasks: 'Задачі тижня',
  load: 'Навантаження тижня',
  shared: 'Спільні календарі',
  invites: 'Запрошення',
  holidays: 'Свята',
  calendars: 'Мої календарі',
};

const knownOnly = (list) => MODULE_KEYS.filter((key) => (list || []).includes(key));

export default function useHiddenModules() {
  const { user, updateUser } = useAuth();
  const { notifyError } = useToast();
  const [draft, setDraft] = useState(null);
  const lastRequest = useRef(0);
  const saved = user?.hiddenModules;
  const hidden = useMemo(() => draft || knownOnly(saved), [draft, saved]);

  const setModuleHidden = useCallback(
    async (key, isHidden) => {
      const next = MODULE_KEYS.filter((k) => (k === key ? isHidden : hidden.includes(k)));
      lastRequest.current += 1;
      const request = lastRequest.current;
      setDraft(next);
      try {
        await updateUser({ hiddenModules: next });
      } catch (err) {
        if (request === lastRequest.current) notifyError(err);
      } finally {
        if (request === lastRequest.current) setDraft(null);
      }
    },
    [hidden, updateUser, notifyError],
  );

  return { hidden, setModuleHidden };
}
