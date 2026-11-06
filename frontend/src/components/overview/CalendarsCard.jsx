// Дизайн: design/screens/01-overview.html (картка «Календарі»: чекбокси видимості, «· головний», кнопка керування)
import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import { calendarShape } from '../../utils/propTypes';
import Card from '../ui/Card';
import Chip from '../ui/Chip';
import IconButton from '../ui/IconButton';
import styles from './CalendarsCard.module.css';

export default function CalendarsCard({ calendars, onToggle, className = '' }) {
  return (
    <Card
      aria-label="Календарі"
      title="Календарі"
      action={
        <IconButton
          icon="settings"
          label="Керувати календарями"
          size="xs"
          variant="muted"
          iconSize={13}
          to="/calendars"
          className={styles.settings}
        />
      }
      gap={6}
      className={cx(styles.card, className)}
    >
      {calendars.map((c) => (
        <Chip
          key={c.id}
          variant="plain"
          label={c.name}
          checked={!c.isHidden}
          onChange={() => onToggle(c.id)}
          color={c.color}
          hint={c.isMain ? 'головний' : null}
          disabled={Boolean(c.isMain)}
        />
      ))}
    </Card>
  );
}

CalendarsCard.propTypes = {
  calendars: PropTypes.arrayOf(calendarShape).isRequired,
  onToggle: PropTypes.func.isRequired,
  className: PropTypes.string,
};
