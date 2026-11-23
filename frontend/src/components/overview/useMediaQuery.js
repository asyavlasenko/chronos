import { useEffect, useState } from 'react';

export default function useMediaQuery(query) {
  const [isMatch, setIsMatch] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setIsMatch(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return isMatch;
}
