import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseDateParam, toDateParam, startOfDay } from '../utils/dates';

/** Дата подання календаря живе в URL: ?date=YYYY-MM-DD. За замовчуванням — сьогодні. */
export default function useViewDate() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('date');
  const date = useMemo(() => parseDateParam(param), [param]);

  const setDate = useCallback(
    (next) => {
      setSearchParams((prev) => {
        const sp = new URLSearchParams(prev);
        const value = toDateParam(next);
        if (value === toDateParam(new Date())) sp.delete('date');
        else sp.set('date', value);
        return sp;
      });
    },
    [setSearchParams],
  );

  /** Рядок для збереження ?date= у посиланнях між поданнями */
  const dateSearch = param ? `?date=${param}` : '';

  return {
    date,
    setDate,
    dateSearch,
    isTodaySelected: !param || toDateParam(startOfDay(new Date())) === param,
  };
}
