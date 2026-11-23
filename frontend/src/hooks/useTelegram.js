import { useCallback, useEffect, useState } from 'react';
import {
  createTelegramLink,
  disconnectTelegram,
  getTelegramStatus,
  sendTelegramTest,
} from '../api/telegram.api';
import useToast from './useToast';

const POLL_MS = 3000;

function openBlankTab() {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  return tab;
}

export default function useTelegram() {
  const { notifyError, notifySuccess } = useToast();
  const [status, setStatus] = useState(null);
  const [waitingUntil, setWaitingUntil] = useState(null);
  const [pending, setPending] = useState(null);

  useEffect(() => {
    let isActive = true;
    getTelegramStatus()
      .then((next) => {
        if (isActive) setStatus(next);
      })
      .catch(() => {
        if (isActive) setStatus(null);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!waitingUntil) return undefined;

    const timer = setInterval(async () => {
      if (Date.now() > waitingUntil) {
        setWaitingUntil(null);
        return;
      }
      try {
        const next = await getTelegramStatus();
        setStatus(next);
        if (next.isConnected) {
          setWaitingUntil(null);
          notifySuccess('Telegram підключено');
        }
      } catch {
        setWaitingUntil(null);
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [waitingUntil, notifySuccess]);

  const run = useCallback(
    async (name, action) => {
      setPending(name);
      try {
        await action();
      } catch (err) {
        notifyError(err);
      } finally {
        setPending(null);
      }
    },
    [notifyError],
  );

  const connect = () => {
    const tab = openBlankTab();
    return run('connect', async () => {
      try {
        const link = await createTelegramLink();
        if (tab) tab.location.href = link.url;
        else window.location.assign(link.url);
        setWaitingUntil(new Date(link.expiresAt).getTime());
      } catch (err) {
        if (tab) tab.close();
        throw err;
      }
    });
  };

  const disconnect = () =>
    run('disconnect', async () => {
      await disconnectTelegram();
      setStatus((current) => ({ ...current, isConnected: false, username: null }));
    });

  const sendTest = () =>
    run('test', async () => {
      await sendTelegramTest();
      notifySuccess('Тестове повідомлення надіслано');
    });

  const cancel = () => setWaitingUntil(null);

  return {
    status,
    pending,
    isWaiting: Boolean(waitingUntil),
    connect,
    disconnect,
    sendTest,
    cancel,
  };
}
