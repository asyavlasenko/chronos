// Дизайн: design/screens/10-event-create.html (блок «Учасники»), 11-event-quick-modal.html
// Поле учасників: чіпи (аватар 20 + email + «Прибрати») і input без рамки «додати email і Enter».
import { useState } from 'react';
import PropTypes from 'prop-types';
import cx from '../utils/cx';
import { people } from '../mocks/data';
import { participantsToAvatars } from '../utils/eventStats';
import { participantShape } from '../utils/propTypes';
import Avatar from '../components/ui/Avatar';
import IconButton from '../components/ui/IconButton';
import Input from '../components/ui/Input';
import { isValidEmail, participantFromEmail } from './eventFormUtils';
import styles from './ParticipantsInput.module.css';

/** Enter, кома або blur додають email як учасника зі статусом pending; Backspace у порожньому полі прибирає останнього. */
export default function ParticipantsInput({
  value,
  onChange,
  id = undefined,
  placeholder = 'додати email і Enter',
  className = '',
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const avatars = participantsToAvatars(value, people);

  const commit = () => {
    const text = draft.trim();
    if (!text) return;
    if (!isValidEmail(text)) {
      setError('Некоректний email');
      return;
    }
    const next = participantFromEmail(text);
    if (!value.some((p) => p.email === next.email)) onChange([...value, next]);
    setDraft('');
    setError(null);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className={cx(styles.wrap, className)}>
      <div className={cx(styles.box, error && styles.invalid)}>
        {value.map((p, i) => (
          <span key={p.email} className={styles.chip}>
            <Avatar initials={avatars[i].initials} color={avatars[i].color} size={20} />
            {p.email}
            <IconButton
              icon="x"
              label={`Прибрати ${p.email}`}
              size="xs"
              variant="muted"
              iconSize={12}
              onClick={() => onChange(value.filter((x) => x.email !== p.email))}
            />
          </span>
        ))}
        <Input
          id={id}
          type="email"
          value={draft}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className={styles.input}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={commit}
        />
      </div>
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

ParticipantsInput.propTypes = {
  value: PropTypes.arrayOf(participantShape).isRequired,
  onChange: PropTypes.func.isRequired,
  id: PropTypes.string,
  placeholder: PropTypes.string,
  className: PropTypes.string,
};
