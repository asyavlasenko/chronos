// Дизайн: design/screens/01-overview.html (картка «Спільні календарі»: квадратик кольору, назва, стек аватарів, ролі, запрошення по email)
import { Fragment, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { colorVars } from '../../utils/colors';
import { participantsToAvatars } from '../../utils/eventStats';
import { calendarShape } from '../../utils/propTypes';
import Card from '../ui/Card';
import Input from '../ui/Input';
import PillButton from '../ui/PillButton';
import { AvatarStack } from '../ui/Avatar';
import { membersSummary, peopleShape } from './overviewUtils';
import styles from './SharedCalendarsCard.module.css';

export default function SharedCalendarsCard({ calendars, people = {}, className = '' }) {
  const [email, setEmail] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!email.trim() || !calendars.length) return;
    // TODO(@teammate2): calendars.api.shareCalendar(calendars[0].id, { email, role: 'viewer' })
    setEmail('');
  };

  return (
    <Card aria-label="Спільні календарі" title="Спільні календарі" gap={10} className={className}>
      {calendars.map((c) => (
        <Fragment key={c.id}>
          <Link to={`/calendars/${c.id}`} className={styles.row}>
            <span className={styles.dot} style={{ background: colorVars(c.color).base }} />
            <span className={styles.name}>{c.name}</span>
            <AvatarStack
              items={participantsToAvatars(c.members || [], people)}
              size={22}
              ring="var(--card)"
            />
          </Link>
          <span className={styles.roles}>{membersSummary(c.members || [])}</span>
        </Fragment>
      ))}
      {!calendars.length ? <span className={styles.roles}>Немає спільних календарів</span> : null}
      <form className={styles.invite} onSubmit={submit}>
        <Input
          type="email"
          size="xs"
          placeholder="email"
          aria-label="Email для запрошення"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.email}
        />
        <PillButton type="submit" shape="rounded" size="xs">
          Запросити
        </PillButton>
      </form>
    </Card>
  );
}

SharedCalendarsCard.propTypes = {
  calendars: PropTypes.arrayOf(calendarShape).isRequired,
  people: peopleShape,
  className: PropTypes.string,
};
