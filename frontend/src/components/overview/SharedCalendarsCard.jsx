import { Fragment, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { parseApiError } from '../../api/errors';
import useCalendars from '../../hooks/useCalendars';
import useToast from '../../hooks/useToast';
import { colorVars } from '../../utils/colors';
import { calendarShape } from '../../utils/propTypes';
import Card from '../ui/Card';
import Input from '../ui/Input';
import PillButton from '../ui/PillButton';
import { AvatarStack } from '../ui/Avatar';
import { membersToAvatars } from '../calendars/members';
import { membersSummary, peopleShape } from './overviewUtils';
import styles from './SharedCalendarsCard.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_ROLE = 'viewer';

export default function SharedCalendarsCard({
  calendars,
  people = {},
  meId = null,
  className = '',
}) {
  const { shareCalendar } = useCalendars();
  const { notifySuccess, notifyError } = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const target = calendars.find((c) => c.myRole === 'owner') || null;

  const submit = async (e) => {
    e.preventDefault();
    if (busy || !target) return;
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError('Введи email учасника');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await shareCalendar(target.id, { email: value, role: INVITE_ROLE });
      setEmail('');
      notifySuccess(`Запрошення в «${target.name}» надіслано`);
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.status === 409 || parsed.status === 400) {
        setError(parsed.fields.email || parsed.message);
      } else {
        notifyError(err);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card aria-label="Спільні календарі" title="Спільні календарі" gap={10} className={className}>
      {calendars.map((c) => (
        <Fragment key={c.id}>
          <Link to={`/calendars/${c.id}`} className={styles.row}>
            <span className={styles.dot} style={{ background: colorVars(c.color).base }} />
            <span className={styles.name}>{c.name}</span>
            <AvatarStack
              items={membersToAvatars(c.members || [], people)}
              size={22}
              ring="var(--card)"
            />
          </Link>
          <span className={styles.roles}>{membersSummary(c.members || [], meId)}</span>
        </Fragment>
      ))}
      {!calendars.length ? <span className={styles.roles}>Немає спільних календарів</span> : null}
      {target ? (
        <form className={styles.invite} onSubmit={submit} noValidate>
          <div className={styles.inviteRow}>
            <Input
              type="email"
              size="xs"
              placeholder="email"
              aria-label={`Email для запрошення в календар «${target.name}»`}
              title={`Запросити в календар «${target.name}»`}
              value={email}
              invalid={Boolean(error)}
              aria-invalid={Boolean(error)}
              disabled={busy}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              className={styles.email}
            />
            <PillButton type="submit" shape="rounded" size="xs" disabled={busy}>
              Запросити
            </PillButton>
          </div>
          {error ? (
            <span className={styles.error} role="alert">
              {error}
            </span>
          ) : null}
        </form>
      ) : (
        <Link to="/calendars" className={styles.create}>
          Створити спільний календар →
        </Link>
      )}
    </Card>
  );
}

SharedCalendarsCard.propTypes = {
  calendars: PropTypes.arrayOf(calendarShape).isRequired,
  people: peopleShape,
  meId: PropTypes.string,
  className: PropTypes.string,
};
