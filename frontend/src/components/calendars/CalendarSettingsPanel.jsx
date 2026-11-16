import { useCallback, useId, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { parseApiError } from '../../api/errors';
import useAuth from '../../hooks/useAuth';
import useCalendars from '../../hooks/useCalendars';
import usePeople from '../../hooks/usePeople';
import useToast from '../../hooks/useToast';
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
import ConfirmDialog from './ConfirmDialog';
import MemberRow from './MemberRow';
import PendingInviteRow from './PendingInviteRow';
import { memberAvatar, ROLE_LABELS, ROLE_OPTIONS } from './members';
import styles from './CalendarSettingsPanel.module.css';

const CALENDAR_COLORS = ['graphite', 'blue', 'purple', 'green', 'orange', 'pink'];
const MEMBER_COLORS = ['blue', 'purple', 'green', 'orange', 'pink', 'graphite'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX = 60;
const DESCRIPTION_MAX = 300;
const ROLE_HINT_FULL =
  'Власник видаляє будь-які події, редактор створює і видаляє свої, глядач тільки дивиться. ' +
  'Якщо email ще не зареєстрований — запрошення спрацює після реєстрації.';
const ROLE_HINT_COMPACT =
  'Власник видаляє будь-які події, редактор — лише свої, глядач тільки дивиться.';
const MAIN_NOTE = 'Головний календар особистий, його не можна зробити спільним';
const MAIN_HIDE_TITLE = 'Головний календар не можна сховати';
const MAIN_DELETE_TITLE = 'Головний календар не можна видалити';

function confirmCopy(confirmation, calendar) {
  if (!confirmation) return { title: '', text: null, confirmLabel: '' };
  if (confirmation.kind === 'delete') {
    return {
      title: `Видалити календар «${calendar.name}»?`,
      text: 'Усі його події теж буде видалено. Цю дію не можна скасувати.',
      confirmLabel: 'Видалити',
    };
  }
  if (confirmation.kind === 'leave') {
    return {
      title: `Вийти з календаря «${calendar.name}»?`,
      text: 'Календар зникне з твого списку. Повернутися можна лише за новим запрошенням.',
      confirmLabel: 'Вийти',
    };
  }
  const name = confirmation.member.name || confirmation.member.email || 'учасника';
  return {
    title: `Прибрати з календаря: ${name}?`,
    text: 'Учасник втратить доступ до календаря, його події залишаться.',
    confirmLabel: 'Прибрати',
  };
}

export default function CalendarSettingsPanel({ calendar, variant = 'full', onRemoved = null }) {
  const uid = useId();
  const { user } = useAuth();
  const people = usePeople();
  const { notifySuccess, notifyError } = useToast();
  const {
    updateCalendar,
    toggleVisibility,
    setMyColor,
    removeCalendar,
    shareCalendar,
    updateMemberRole,
    removeMember,
    cancelInvite,
  } = useCalendars();
  const meId = user?.id || null;
  const members = calendar.members || [];
  const pendingInvites = calendar.pendingInvites || [];
  const isOwner = calendar.myRole === 'owner';
  const readOnly = Boolean(calendar.isReadOnly);
  const canEdit = isOwner && !readOnly;
  const canLeave = !isOwner && !readOnly && Boolean(calendar.myRole);
  const compact = variant === 'compact';

  const [form, setForm] = useState({
    name: calendar.name,
    description: calendar.description || '',
    color: calendar.color,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviteError, setInviteError] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState(null);
  const [busyInviteId, setBusyInviteId] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const setField = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: null }));
  };

  const save = async () => {
    if (saving) return;
    const name = form.name.trim();
    if (!name) {
      setErrors({ name: 'Введи назву календаря' });
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      const saved = await updateCalendar(calendar.id, {
        name,
        description: form.description.trim(),
        color: form.color,
      });
      setForm({ name: saved.name, description: saved.description || '', color: saved.color });
      notifySuccess('Збережено');
    } catch (err) {
      const { fields } = parseApiError(err);
      if (fields.name || fields.description) {
        setErrors({ name: fields.name || null, description: fields.description || null });
      } else {
        notifyError(err);
      }
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (member, role) => {
    if (role === member.role || busyMemberId) return;
    setBusyMemberId(member.user);
    try {
      await updateMemberRole(calendar.id, member.user, role);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusyMemberId(null);
    }
  };

  const invite = async () => {
    if (inviting) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setInviteError('Введи email учасника');
      return;
    }

    setInviting(true);
    setInviteError(null);
    try {
      await shareCalendar(calendar.id, { email, role: inviteRole });
      setInviteEmail('');
      notifySuccess('Запрошення надіслано');
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.status === 409 || parsed.status === 400) {
        setInviteError(parsed.fields.email || parsed.message);
      } else {
        notifyError(err);
      }
    } finally {
      setInviting(false);
    }
  };

  const cancelPending = async (pending) => {
    if (busyInviteId) return;
    setBusyInviteId(pending.id);
    try {
      await cancelInvite(calendar.id, pending.id);
    } catch (err) {
      notifyError(err);
    } finally {
      setBusyInviteId(null);
    }
  };

  const closeConfirm = useCallback(() => {
    if (!confirmBusy) setConfirmation(null);
  }, [confirmBusy]);

  const runConfirmed = async () => {
    if (!confirmation || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (confirmation.kind === 'delete') {
        await removeCalendar(calendar.id);
        onRemoved?.(calendar.id);
      } else if (confirmation.kind === 'leave') {
        await removeMember(calendar.id, meId);
        onRemoved?.(calendar.id);
      } else {
        await removeMember(calendar.id, confirmation.member.user);
      }
      setConfirmation(null);
    } catch (err) {
      notifyError(err);
    } finally {
      setConfirmBusy(false);
    }
  };

  const hideLabel = calendar.isHidden ? 'Показати для мене' : 'Сховати для мене';
  const roleBadge = readOnly
    ? 'тільки читання'
    : `ти — ${ROLE_LABELS[calendar.myRole] || 'глядач'}`;
  const vars = colorVars(calendar.color);
  const copy = confirmCopy(confirmation, calendar);

  const confirmDialog = (
    <ConfirmDialog
      open={Boolean(confirmation)}
      title={copy.title}
      text={copy.text}
      confirmLabel={copy.confirmLabel}
      busy={confirmBusy}
      onConfirm={runConfirmed}
      onCancel={closeConfirm}
    />
  );

  const rowTag = compact ? 'li' : 'div';

  const membersList = (
    <>
      {members.map((m) => {
        const av = memberAvatar(m, people);
        return (
          <MemberRow
            key={m.user}
            as={rowTag}
            member={m}
            initials={av.initials}
            color={av.color}
            isMe={m.user === meId}
            canManage={isOwner}
            disabled={busyMemberId === m.user}
            variant={variant}
            onRoleChange={changeRole}
            onRemove={(member) => setConfirmation({ kind: 'member', member })}
          />
        );
      })}
      {pendingInvites.map((pending) => (
        <PendingInviteRow
          key={pending.id}
          as={rowTag}
          invite={pending}
          variant={variant}
          disabled={busyInviteId === pending.id}
          onCancel={cancelPending}
        />
      ))}
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
        aria-invalid={Boolean(inviteError)}
        disabled={inviting}
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

  const inviteFeedback = (
    <>
      {inviteError ? (
        <span className={styles.error} role="alert">
          {inviteError}
        </span>
      ) : null}
      <span className={styles.hint}>{compact ? ROLE_HINT_COMPACT : ROLE_HINT_FULL}</span>
    </>
  );

  if (compact) {
    const subtitle = calendar.isShared
      ? `спільний · ${pluralMembers(members.length)}`
      : `особистий · ${pluralEvents(calendar.eventsCount ?? 0)}`;

    let inviteBlock = null;
    if (isOwner && calendar.isMain) {
      inviteBlock = <span className={styles.hint}>{MAIN_NOTE}</span>;
    } else if (isOwner) {
      inviteBlock = (
        <>
          <div className={styles.cInvite}>
            {inviteInput}
            <PillButton
              variant="primary"
              size="xs"
              shape="rounded"
              disabled={inviting}
              onClick={invite}
            >
              Запросити
            </PillButton>
          </div>
          {inviteFeedback}
        </>
      );
    }

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
              title={calendar.isMain ? MAIN_HIDE_TITLE : undefined}
              onClick={() => toggleVisibility(calendar.id)}
            >
              {hideLabel}
            </PillButton>
            {canLeave ? (
              <PillButton
                variant="danger"
                size="xs"
                shape="rounded"
                className={styles.half}
                aria-label="Вийти з календаря"
                onClick={() => setConfirmation({ kind: 'leave' })}
              >
                Вийти
              </PillButton>
            ) : null}
          </div>
        </Card>

        {!readOnly ? (
          <Card as="div" gap={10}>
            <span className={styles.cCardTitle}>Учасники</span>
            <ul className={styles.cList}>{membersList}</ul>
            {inviteBlock}
          </Card>
        ) : null}

        {calendar.isShared ? (
          <Card as="div" gap={10}>
            <span className={styles.cCardTitle}>Мій колір подій тут</span>
            <ColorPicker
              value={calendar.myColor}
              onChange={(key) => setMyColor(calendar.id, key)}
              options={MEMBER_COLORS}
              size={28}
              label="Колір моїх подій"
            />
            <span className={styles.hint}>Інші учасники бачать твої події саме цим кольором.</span>
          </Card>
        ) : null}

        {confirmDialog}
      </>
    );
  }

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

  let inviteBlock = null;
  if (isOwner && calendar.isMain) {
    inviteBlock = <span className={styles.hint}>{MAIN_NOTE}</span>;
  } else if (isOwner) {
    inviteBlock = (
      <>
        <div className={styles.invite}>
          {inviteInput}
          <Select
            size="md"
            options={ROLE_OPTIONS}
            value={inviteRole}
            onChange={setInviteRole}
            disabled={inviting}
            aria-label="Роль нового учасника"
          />
          <PillButton
            variant="primary"
            size="lg"
            shape="rounded"
            disabled={inviting}
            onClick={invite}
          >
            Запросити
          </PillButton>
        </div>
        {inviteFeedback}
      </>
    );
  }

  return (
    <>
      <Card as="div" padding="20px" gap={16}>
        {header}

        <div className={styles.grid}>
          <Field label="Назва" htmlFor={`${uid}-name`} error={errors.name}>
            <Input
              id={`${uid}-name`}
              size="md"
              value={form.name}
              maxLength={NAME_MAX}
              readOnly={!canEdit}
              invalid={Boolean(errors.name)}
              aria-invalid={Boolean(errors.name)}
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
        <Field label="Опис" htmlFor={`${uid}-desc`} error={errors.description}>
          <Input
            id={`${uid}-desc`}
            size="md"
            value={form.description}
            maxLength={DESCRIPTION_MAX}
            readOnly={!canEdit}
            invalid={Boolean(errors.description)}
            aria-invalid={Boolean(errors.description)}
            onChange={(e) => setField('description')(e.target.value)}
          />
        </Field>

        <div className={styles.section}>
          <span className={styles.lbl}>Учасники · {members.length}</span>
          {membersList}
          {inviteBlock}
        </div>

        {calendar.isShared ? (
          <div className={styles.sectionTight}>
            <span className={styles.lbl}>Мій колір подій у цьому календарі</span>
            <div className={styles.myColorRow}>
              <ColorPicker
                value={calendar.myColor}
                onChange={(key) => setMyColor(calendar.id, key)}
                options={MEMBER_COLORS}
                label="Мій колір"
              />
              <span className={styles.hintInline}>так інші бачать твої події</span>
            </div>
          </div>
        ) : null}

        <div className={styles.actions}>
          {canEdit ? (
            <PillButton variant="primary" size="lg" disabled={saving} onClick={save}>
              {saving ? 'Зберігаємо…' : 'Зберегти'}
            </PillButton>
          ) : null}
          <PillButton
            variant="secondary"
            size="lg"
            disabled={calendar.isMain}
            title={calendar.isMain ? MAIN_HIDE_TITLE : undefined}
            onClick={() => toggleVisibility(calendar.id)}
          >
            {hideLabel}
          </PillButton>
          {canEdit ? (
            <button
              type="button"
              className={styles.delete}
              disabled={calendar.isMain}
              title={calendar.isMain ? MAIN_DELETE_TITLE : undefined}
              onClick={() => setConfirmation({ kind: 'delete' })}
            >
              Видалити календар
            </button>
          ) : null}
          {canLeave ? (
            <button
              type="button"
              className={styles.delete}
              onClick={() => setConfirmation({ kind: 'leave' })}
            >
              Вийти з календаря
            </button>
          ) : null}
        </div>
      </Card>

      {confirmDialog}
    </>
  );
}

CalendarSettingsPanel.propTypes = {
  calendar: calendarShape.isRequired,
  variant: PropTypes.oneOf(['full', 'compact']),
  onRemoved: PropTypes.func,
};
