import { useEffect, useState } from 'react';

/** «Зараз», що оновлюється кожні intervalMs (лінія часу, «через N хв», годинник). */
export default function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
