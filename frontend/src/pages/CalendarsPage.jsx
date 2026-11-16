import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useCalendars from '../hooks/useCalendars';
import useEvents from '../hooks/useEvents';
import usePeople from '../hooks/usePeople';
import useToast from '../hooks/useToast';
import { plural, pluralCalendars } from '../utils/text';
import Card from '../components/ui/Card';
import PillButton from '../components/ui/PillButton';
import CalendarRow from '../components/calendars/CalendarRow';
import CalendarSettingsPanel from '../components/calendars/CalendarSettingsPanel';
import { membersToAvatars } from '../components/calendars/members';
import styles from './CalendarsPage.module.css';

const SHARED_FORMS = ['спільний', 'спільні', 'спільних'];
const HIDDEN_FORMS = ['прихований', 'приховані', 'прихованих'];
const NEW_CALENDAR = { name: 'Новий календар', color: 'blue' };

export default function CalendarsPage() {
  const { calendars, byId, toggleVisibility, createCalendar } = useCalendars();
  const { holidayEvents } = useEvents();
  const people = usePeople();
  const { notifyError } = useToast();
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(searchParams.get('id'));
  const [creating, setCreating] = useState(false);

  const selected = byId[selectedId] || calendars.find((c) => c.isShared) || calendars[0] || null;

  const stats = useMemo(
    () => ({
      total: calendars.length,
      shared: calendars.filter((c) => c.isShared).length,
      hidden: calendars.filter((c) => c.isHidden).length,
    }),
    [calendars],
  );

  const holidaysCount = useMemo(() => {
    const year = new Date().getFullYear();
    return holidayEvents.filter((h) => h.startAt.getFullYear() === year).length;
  }, [holidayEvents]);

  const onCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const id = await createCalendar(NEW_CALENDAR);
      setSelectedId(id);
    } catch (err) {
      notifyError(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.layout}>
      <section aria-label="Мої календарі" className={styles.list}>
        <div className={styles.head}>
          <div className={styles.titles}>
            <h1 className={styles.h1}>Календарі</h1>
            <span className={styles.sub}>
              {pluralCalendars(stats.total)} · {stats.shared} {plural(stats.shared, SHARED_FORMS)} ·{' '}
              {stats.hidden} {plural(stats.hidden, HIDDEN_FORMS)}
            </span>
          </div>
          <PillButton
            variant="primary"
            size="sm"
            icon="plus"
            disabled={creating}
            onClick={onCreate}
          >
            Новий календар
          </PillButton>
        </div>

        <Card as="div" padding="0" gap={0} className={styles.card}>
          {calendars.map((c) => (
            <CalendarRow
              key={c.id}
              calendar={c.isReadOnly ? { ...c, eventsCount: holidaysCount } : c}
              members={c.isShared && !c.isHidden ? membersToAvatars(c.members, people) : []}
              selected={c.id === selected?.id}
              onSelect={setSelectedId}
              onToggleVisibility={toggleVisibility}
            />
          ))}
        </Card>

        <span className={styles.note}>
          Чекбокс ховає календар лише для тебе — інші учасники бачать його як і раніше. Головний
          календар не можна сховати чи видалити.
        </span>
      </section>

      {selected ? (
        <aside aria-label={`Налаштування календаря ${selected.name}`} className={styles.side}>
          <CalendarSettingsPanel
            key={selected.id}
            calendar={selected}
            variant="full"
            onRemoved={() => setSelectedId(null)}
          />
        </aside>
      ) : null}
    </div>
  );
}
