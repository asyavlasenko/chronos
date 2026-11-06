// Дизайн: design/screens/08-calendars.html (variant 'full' — панель налаштувань праворуч від списку),
// design/screens/09-shared-calendar.html (variant 'compact' — три картки ліворуч від сітки тижня).
// Форма (назва/колір/опис) — локальний стан; батько передає key={calendar.id}, щоб форма скидалась при зміні календаря.
import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import useCalendars from '../../hooks/useCalendars';
import useAuth from '../../hooks/useAuth';
import { people } from '../../mocks/data';
import { colorVars, COLOR_LABELS } from '../../utils/colors';
import { pluralEvents, pluralMembers } from '../../utils/text';
import { calendarShape } from '../../utils/propTypes';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Field from '../ui/Field';
import Input from '../ui/Input';
import Select from '../ui/Select';
import ColorPicker from '../ui/ColorPicker';
import PillButton from '../ui/PillButton';
import Icon from '../ui/Icon';
import MemberRow from './MemberRow';
import { memberAvatar, ROLE_LABELS, ROLE_OPTIONS } from './members';
import styles from './CalendarSettingsPanel.module.css';

const CALENDAR_COLORS = ['graphite', 'blue', 'purple', 'green', 'orange', 'pink'];
const MEMBER_COLORS = ['blue', 'purple', 'green', 'orange', 'pink', 'graphite'];
const ROLE_HINT_FULL =
  'Власник видаляє будь-які події, редактор створює і видаляє свої, глядач тільки дивиться. ' +
  'Якщо email ще не зареєстрований — запрошення спрацює після реєстрації.';
const ROLE_HINT_COMPACT =
  'Власник видаляє будь-які події, редактор — лише свої, глядач тільки дивиться.';

const localPart = (email) => email.split('@')[0];

export default function CalendarSettingsPanel({ calendar, variant = 'full', onRemoved = null }) {
  const uid = useId();
  const { user } = useAuth();
  const { updateCalendar, toggleVisibility, removeCalendar } = useCalendars();
  const meId = user?.id || 'u-me';
  const members = calendar.members || [];
  const isOwner = calendar.myRole === 'owner';
  const readOnly = Boolean(calendar.isReadOnly);
  const canEdit = isOwner && !readOnly;
  const compact = variant === 'compact';

  const [form, setForm] = useState({
    name: calendar.name,
    description: calendar.description || '',
    color: calendar.color,
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviteError, setInviteError] = useState(null);

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const save = () =>
    updateCalendar(calendar.id, {
      name: form.name.trim() || calendar.name,
      description: form.description.trim(),
      color: form.color,
    });

  const changeRole = (member, role) =>
    updateCalendar(calendar.id, (c) => ({
      members: c.members.map((m) => (m.user === member.user ? { ...m, role } : m)),
    }));

  const removeMember = (member) =>
    updateCalendar(calendar.id, (c) => {
      const rest = c.members.filter((m) => m.user !== member.user);
      return { members: rest, isShared: rest.length > 1 };
    });

  const changeMyColor = (key) =>
    updateCalendar(calendar.id, (c) => ({
      myColor: key,
      members: c.members.map((m) => (m.user === meId ? { ...m, color: key } : m)),
    }));

  const invite = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setInviteError('Введи email учасника');
      return;
    }
    if (members.some((m) => (m.email || '').toLowerCase() === email)) {
      setInviteError('Цей учасник уже є в календарі');
      return;
    }
    const known = Object.values(people).find((p) => p.email === email);
    const used = members.map((m) => m.color);
    const color = known?.color || MEMBER_COLORS.find((c) => !used.includes(c)) || 'graphite';
    const newMember = {
      user: known?.id || `u-${localPart(email)}`,
      name: known?.name || localPart(email),
      email,
      role: inviteRole,
      color,
      isHidden: false,
    };
    updateCalendar(calendar.id, (c) => ({ members: [...c.members, newMember], isShared: true }));
    setInviteEmail('');
    setInviteError(null);
  };

  const remove = () => {
    // eslint-disable-next-line no-alert
    const ok = window.confirm(
      `Видалити календар «${calendar.name}»? Усі його події теж буде видалено.`,
    );
    if (!ok) return;
    removeCalendar(calendar.id);
    onRemoved?.(calendar.id);
  };

  const hideLabel = calendar.isHidden ? 'Показати для мене' : 'Сховати для мене';
  const roleBadge = readOnly
    ? 'тільки читання'
    : `ти — ${ROLE_LABELS[calendar.myRole] || 'глядач'}`;
  const vars = colorVars(calendar.color);

  const membersList = (
    <>
      {members.map((m) => {
        const av = memberAvatar(m);
        return (
          <MemberRow
            key={m.user}
            as={compact ? 'li' : 'div'}
            member={m}
            initials={av.initials}
            color={av.color}
            isMe={m.user === meId}
            canManage={isOwner}
            variant={variant}
            onRoleChange={changeRole}
            onRemove={removeMember}
          />
        );
      })}
    </>
  );

  const inviteInput = (
    <div className={styles.inviteField}>
      <Input
        type="email"
        size={compact ? 'xs' : 'md'}
        placeholder="email нового учасника"
        aria-label="Email для запрошення"
        value={inviteEmail}
        invalid={Boolean(inviteError)}
        onChange={(e) => {
          setInviteEmail(e.target.value);
          if (inviteError) setInviteError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') invite();
        }}
      />
    </div>
  );

  // ---------- compact: три картки (09) ----------
  if (compact) {
    const subtitle = calendar.isShared
      ? `спільний · ${pluralMembers(members.length)}`
      : `особистий · ${pluralEvents(calendar.eventsCount ?? 0)}`;
    return (
      <>
        <Card as="div" gap={10}>
          <div className={styles.cHead}>
            <span className={styles.cIcon} style={{ background: vars.tint, color: vars.text }}>
              <Icon name={calendar.isShared ? 'users' : 'calendar'} size={18} />
            </span>
            <div className={styles.cTitles}>
              <h1 className={styles.cTitle}>{calendar.name}</h1>
              <span className={styles.cSub}>{readOnly ? 'тільки читання' : subtitle}</span>
            </div>
          </div>
          {calendar.description ? <p className={styles.cDesc}>{calendar.description}</p> : null}
          <div className={styles.cBtns}>
            {canEdit ? (
              <PillButton
                variant="secondary"
                size="xs"
                shape="rounded"
                to={`/calendars?id=${calendar.id}`}
                className={styles.half}
              >
                Редагувати
              </PillButton>
            ) : null}
            <PillButton
              variant="secondary"
              size="xs"
              shape="rounded"
              className={styles.half}
              disabled={calendar.isMain}
              onClick={() => toggleVisibility(calendar.id)}
            >
              {hideLabel}
            </PillButton>
          </div>
        </Card>

        {!readOnly ? (
          <Card as="div" gap={10}>
            <span className={styles.cCardTitle}>Учасники</span>
            <ul className={styles.cList}>{membersList}</ul>
            {isOwner ? (
              <>
                <div className={styles.cInvite}>
                  {inviteInput}
                  <PillButton variant="primary" size="xs" shape="rounded" onClick={invite}>
                    Запросити
                  </PillButton>
                </div>
                {inviteError ? <span className={styles.error}>{inviteError}</span> : null}
                <span className={styles.hint}>{ROLE_HINT_COMPACT}</span>
              </>
            ) : null}
          </Card>
        ) : null}

        {calendar.isShared ? (
          <Card as="div" gap={10}>
            <span className={styles.cCardTitle}>Мій колір подій тут</span>
            <ColorPicker
              value={calendar.myColor}
              onChange={changeMyColor}
              options={MEMBER_COLORS}
              size={28}
              label="Колір моїх подій"
            />
            <span className={styles.hint}>Інші учасники бачать твої події саме цим кольором.</span>
          </Card>
        ) : null}
      </>
    );
  }

  // ---------- full: одна картка (08) ----------
  const header = (
    <div className={styles.head}>
      <span className={styles.sw} style={{ background: vars.base }} />
      <h2 className={styles.title}>{calendar.name}</h2>
      <Badge variant="muted" size="sm">
        {roleBadge}
      </Badge>
      <Link to={`/calendars/${calendar.id}`} className={styles.open}>
        Відкрити календар →
      </Link>
    </div>
  );

  if (readOnly) {
    return (
      <Card as="div" padding="20px" gap={16}>
        {header}
        <p className={styles.note}>{calendar.description || 'Автоматично за країною з профілю'}</p>
        <div className={styles.actions}>
          <PillButton variant="secondary" size="lg" onClick={() => toggleVisibility(calendar.id)}>
            {hideLabel}
          </PillButton>
        </div>
      </Card>
    );
  }

  return (
    <Card as="div" padding="20px" gap={16}>
      {header}

      <div className={styles.grid}>
        <Field label="Назва" htmlFor={`${uid}-name`}>
          <Input
            id={`${uid}-name`}
            size="md"
            value={form.name}
            readOnly={!canEdit}
            onChange={(e) => setField('name')(e.target.value)}
          />
        </Field>
        <Field label="Колір">
          {canEdit ? (
            <ColorPicker
              value={form.color}
              onChange={setField('color')}
              options={CALENDAR_COLORS}
              label="Колір календаря"
              className={styles.colorRow}
            />
          ) : (
            <span className={styles.colorStatic}>
              <span className={styles.sw} style={{ background: vars.base }} />
              {COLOR_LABELS[calendar.color] || calendar.color}
            </span>
          )}
        </Field>
      </div>
      <Field label="Опис" htmlFor={`${uid}-desc`}>
        <Input
          id={`${uid}-desc`}
          size="md"
          value={form.description}
          readOnly={!canEdit}
          onChange={(e) => setField('description')(e.target.value)}
        />
      </Field>

      <div className={styles.section}>
        <span className={styles.lbl}>Учасники · {members.length}</span>
        {membersList}
        {isOwner ? (
          <>
            <div className={styles.invite}>
              {inviteInput}
              <Select
                size="md"
                options={ROLE_OPTIONS}
                value={inviteRole}
                onChange={setInviteRole}
                aria-label="Роль нового учасника"
              />
              <PillButton variant="primary" size="lg" shape="rounded" onClick={invite}>
                Запросити
              </PillButton>
            </div>
            {inviteError ? <span className={styles.error}>{inviteError}</span> : null}
            <span className={styles.hint}>{ROLE_HINT_FULL}</span>
          </>
        ) : null}
      </div>

      {calendar.isShared ? (
        <div className={styles.sectionTight}>
          <span className={styles.lbl}>Мій колір подій у цьому календарі</span>
          <div className={styles.myColorRow}>
            <ColorPicker
              value={calendar.myColor}
              onChange={changeMyColor}
              options={MEMBER_COLORS}
              label="Мій колір"
            />
            <span className={styles.hintInline}>так інші бачать твої події</span>
          </div>
        </div>
      ) : null}

      <div className={styles.actions}>
        {canEdit ? (
          <PillButton variant="primary" size="lg" onClick={save}>
            Зберегти
          </PillButton>
        ) : null}
        <PillButton
          variant="secondary"
          size="lg"
          disabled={calendar.isMain}
          onClick={() => toggleVisibility(calendar.id)}
        >
          {hideLabel}
        </PillButton>
        {canEdit ? (
          <button
            type="button"
            className={styles.delete}
            disabled={calendar.isMain}
            onClick={remove}
          >
            Видалити календар
          </button>
        ) : null}
      </div>
    </Card>
  );
}

CalendarSettingsPanel.propTypes = {
  calendar: calendarShape.isRequired,
  variant: PropTypes.oneOf(['full', 'compact']),
  onRemoved: PropTypes.func,
};
