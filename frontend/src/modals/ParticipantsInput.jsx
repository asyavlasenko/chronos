import { useState } from 'react';
import PropTypes from 'prop-types';
import useAuth from '../hooks/useAuth';
import usePeople from '../hooks/usePeople';
import cx from '../utils/cx';
import { participantsToAvatars } from '../utils/eventStats';
import { participantShape } from '../utils/propTypes';
import Avatar from '../components/ui/Avatar';
import IconButton from '../components/ui/IconButton';
import Input from '../components/ui/Input';
import { isValidEmail, normalizeEmail, participantFromEmail } from './eventFormUtils';
import styles from './ParticipantsInput.module.css';

const MAX_PARTICIPANTS = 20;

export default function ParticipantsInput({
  value,
  onChange,
  id = undefined,
  placeholder = 'додати email і Enter',
  error = null,
  disabled = false,
  className = '',
}) {
  const { user } = useAuth();
  const people = usePeople();
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState(null);
  const avatars = participantsToAvatars(value, people);
  const shownError = draftError || error;

  const commit = () => {
    const text = draft.trim();
    if (!text) return;
    if (!isValidEmail(text)) {
      setDraftError('Некоректний email');
      return;
    }
    const next = participantFromEmail(text, people);
    if (next.email === normalizeEmail(user?.email)) {
      setDraftError('Свій email додавати не потрібно');
      return;
    }
    const isKnown = value.some((p) => p.email === next.email);
    if (!isKnown && value.length >= MAX_PARTICIPANTS) {
      setDraftError(`У події може бути не більше ${MAX_PARTICIPANTS} учасників`);
      return;
    }
    if (!isKnown) onChange([...value, next]);
    setDraft('');
    setDraftError(null);
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
      <div className={cx(styles.box, shownError && styles.invalid)}>
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
              disabled={disabled}
              onClick={() => onChange(value.filter((x) => x.email !== p.email))}
            />
          </span>
        ))}
        <Input
          id={id}
          type="email"
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={shownError ? true : undefined}
          className={styles.input}
          onChange={(e) => {
            setDraft(e.target.value);
            if (draftError) setDraftError(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={commit}
        />
      </div>
      {shownError ? (
        <span className={styles.error} role="alert">
          {shownError}
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
  error: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};
