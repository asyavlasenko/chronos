import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useCalendars from '../hooks/useCalendars';
import useEvents from '../hooks/useEvents';
import useModals from '../hooks/useModals';
import usePeople from '../hooks/usePeople';
import cx from '../utils/cx';
import { colorVars } from '../utils/colors';
import { addMinutes, groupEventsByDay } from '../utils/eventStats';
import {
  addDays,
  eventToGridPosition,
  formatDate,
  formatTime,
  getIsoWeek,
  getViewRange,
  getWeekDays,
  isSameDay,
  isToday,
  MONTHS_GENITIVE,
  nowOffsetMinutes,
  startOfDay,
  toDate,
  weekdayIndex,
  WEEKDAYS_SHORT,
} from '../utils/dates';
import Card from '../components/ui/Card';
import DarkCard from '../components/ui/DarkCard';
import Avatar from '../components/ui/Avatar';
import Chip from '../components/ui/Chip';
import Icon from '../components/ui/Icon';
import IconButton from '../components/ui/IconButton';
import PillButton from '../components/ui/PillButton';
import SegmentedControl from '../components/ui/SegmentedControl';
import HourRuler from '../components/calendar/HourRuler';
import HourGrid from '../components/calendar/HourGrid';
import EventBlock from '../components/calendar/EventBlock';
import NowLine from '../components/calendar/NowLine';
import CalendarSettingsPanel from '../components/calendars/CalendarSettingsPanel';
import { memberAvatar, ROLE_LABELS } from '../components/calendars/members';
import styles from './SharedCalendarPage.module.css';

const START_HOUR = 8;
const END_HOUR = 20;
const HOUR_H = 48;
const RULER_W = 52;
const GRID_H = (END_HOUR - START_HOUR) * HOUR_H;
const ACTIVITY_LIMIT = 6;

function weekTitle(days) {
  const [first] = days;
  const last = days[days.length - 1];
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} – ${last.getDate()} ${MONTHS_GENITIVE[last.getMonth()]}`;
  }
  return `${first.getDate()} ${MONTHS_GENITIVE[first.getMonth()]} – ${last.getDate()} ${MONTHS_GENITIVE[last.getMonth()]}`;
}

function inviteMeta(invite) {
  const by = invite.invitedBy?.name ? `запрошує ${invite.invitedBy.name}` : null;
  if (invite.kind === 'calendar') return ['спільний календар', by].filter(Boolean).join(' · ');
  const { startAt, allDay } = invite.event || {};
  const date = startAt ? formatDate(startAt, 'short') : null;
  const time = startAt && !allDay ? formatTime(startAt) : null;
  return [date, time, by].filter(Boolean).join(' · ');
}

function blockHeightFor(event, height) {
  if (event.type === 'arrangement') return height;
  if (event.type === 'task') return HOUR_H;
  return 22;
}

function activityWhen(date, now) {
  if (isSameDay(date, now)) return `сьогодні, ${formatTime(date)}`;
  if (isSameDay(date, addDays(now, -1))) return `вчора, ${formatTime(date)}`;
  return formatDate(date, 'short');
}

function buildActivity(events, members, now) {
  const created = events
    .filter((e) => e.createdAt)
    .map((e) => ({
      id: `event-${e.id}`,
      user: e.creator,
      text: `· нова подія «${e.title}»`,
      note: activityWhen(e.createdAt, now),
      at: toDate(e.createdAt),
    }));
  const joined = members
    .filter((m) => m.joinedAt)
    .map((m) => ({
      id: `join-${m.user}`,
      user: m.user,
      text: `у календарі з ${formatDate(m.joinedAt, 'day-month')}`,
      note: ROLE_LABELS[m.role] || '',
      at: toDate(m.joinedAt),
    }));
  return [...created, ...joined].sort((a, b) => b.at - a.at).slice(0, ACTIVITY_LIMIT);
}

export default function SharedCalendarPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { calendars, byId } = useCalendars();
  const people = usePeople();
  const { openDetails, openQuickCreate, detailsEventId } = useModals();
  const calendar = byId[id] || null;
  const members = useMemo(() => calendar?.members || [], [calendar]);
  const weekStartsOn = user?.weekStartsOn ?? 1;

  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [q, setQ] = useState('');
  const [hiddenAuthors, setHiddenAuthors] = useState(() => new Set());
  const [respondingId, setRespondingId] = useState(null);

  const days = useMemo(() => getWeekDays(anchor, weekStartsOn), [anchor, weekStartsOn]);
  const { from, to } = useMemo(
    () => getViewRange('week', anchor, weekStartsOn),
    [anchor, weekStartsOn],
  );
  const calendarIds = useMemo(() => [id], [id]);
  const { events, pendingInvites, respondInvite, toggleCompleted } = useEvents({
    from,
    to,
    calendarIds,
    includeHidden: true,
    q,
  });
  const { events: calendarEvents } = useEvents({ calendarIds, includeHidden: true });

  const countsByAuthor = useMemo(() => {
    const map = new Map();
    events.forEach((e) => map.set(e.creator, (map.get(e.creator) || 0) + 1));
    return map;
  }, [events]);

  const byDay = useMemo(
    () => groupEventsByDay(events.filter((e) => !hiddenAuthors.has(e.creator))),
    [events, hiddenAuthors],
  );

  const authorsById = useMemo(() => {
    const map = { ...people };
    members.forEach((m) => {
      map[m.user] = memberAvatar(m, people);
    });
    return map;
  }, [members, people]);

  const activity = useMemo(
    () => buildActivity(calendarEvents, members, new Date()),
    [calendarEvents, members],
  );

  const navOptions = useMemo(
    () => [
      {
        value: 'all',
        to: '/calendar/week',
        label: (
          <>
            <span className={styles.dot} style={{ background: colorVars('graphite').base }} />
            Усі
          </>
        ),
      },
      ...calendars
        .filter((c) => !c.isReadOnly)
        .map((c) => ({
          value: c.id,
          to: `/calendars/${c.id}`,
          label: (
            <>
              <span className={styles.dot} style={{ background: colorVars(c.color).base }} />
              {c.name}
            </>
          ),
        })),
    ],
    [calendars],
  );

  const toggleAuthor = (userId) =>
    setHiddenAuthors((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const onSlotClick = (start) =>
    openQuickCreate({
      date: start,
      startAt: start,
      endAt: addMinutes(start, user?.defaultArrangementDuration ?? 60),
      calendarId: id,
    });

  const respond = async (inviteId, status) => {
    if (respondingId) return;
    setRespondingId(inviteId);
    try {
      await respondInvite(inviteId, status);
    } finally {
      setRespondingId(null);
    }
  };

  if (!calendar) {
    return (
      <Card as="div" className={styles.empty}>
        <h1 className={styles.emptyTitle}>Календар не знайдено</h1>
        <Link to="/calendars" className={styles.back}>
          <Icon name="chevron-left" size={14} />
          Усі календарі
        </Link>
      </Card>
    );
  }

  const weekNo = getIsoWeek(days[0]);
  const canCreate = !calendar.isReadOnly && calendar.myRole !== 'viewer';

  return (
    <>
      <div className={styles.top}>
        <Link to="/calendars" className={styles.back}>
          <Icon name="chevron-left" size={14} />
          Усі календарі
        </Link>
        <SegmentedControl options={navOptions} value={id} label="Календарі" />
        <span className={styles.spacer} />
        <IconButton
          icon="chevron-left"
          label="Попередній тиждень"
          onClick={() => setAnchor(addDays(anchor, -7))}
        />
        <span className={styles.weekTitle}>
          {weekTitle(days)} <span className={styles.weekNo}>· W{weekNo}</span>
        </span>
        <IconButton
          icon="chevron-right"
          label="Наступний тиждень"
          onClick={() => setAnchor(addDays(anchor, 7))}
        />
        <PillButton variant="white" size="sm" onClick={() => setAnchor(startOfDay(new Date()))}>
          Сьогодні
        </PillButton>
      </div>

      <div className={styles.layout}>
        <aside className={styles.sideLeft} aria-label={`Налаштування календаря ${calendar.name}`}>
          <CalendarSettingsPanel
            key={calendar.id}
            calendar={calendar}
            variant="compact"
            onRemoved={() => navigate('/calendars')}
          />
        </aside>

        <Card
          as="section"
          padding="0"
          gap={0}
          className={styles.main}
          aria-label={`Тиждень ${weekNo}, календар ${calendar.name}`}
        >
          <div className={styles.filters}>
            <span className={styles.filtersLabel}>Події за учасниками:</span>
            {members.map((m) => {
              const av = authorsById[m.user];
              return (
                <Chip
                  key={m.user}
                  color={av.color}
                  checked={!hiddenAuthors.has(m.user)}
                  onChange={() => toggleAuthor(m.user)}
                  hint={String(countsByAuthor.get(m.user) || 0)}
                  label={
                    <span className={styles.authorLabel}>
                      <Avatar initials={av.initials} color={av.color} size={16} />
                      {av.name}
                    </span>
                  }
                />
              );
            })}
            <span className={styles.spacer} />
            <label className={styles.search}>
              <Icon name="search" size={13} />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Пошук у ${calendar.name}`}
                aria-label="Пошук подій"
                className={styles.searchInput}
              />
            </label>
          </div>

          <div className={styles.scroll}>
            <div className={styles.inner}>
              <div className={styles.daysHead}>
                <div className={styles.rulerSpacer} />
                {days.map((d) => {
                  const today = isToday(d);
                  return (
                    <div
                      key={d.toISOString()}
                      className={cx(styles.dayHead, today && styles.dayToday)}
                    >
                      <span className={styles.dayName}>{WEEKDAYS_SHORT[weekdayIndex(d)]}</span>
                      <span className={styles.dayNum}>{d.getDate()}</span>
                    </div>
                  );
                })}
              </div>

              <div className={styles.gridWrap}>
                <HourRuler
                  startHour={START_HOUR}
                  endHour={END_HOUR}
                  hourHeight={HOUR_H}
                  width={RULER_W}
                  fontSize={10}
                  className={styles.ruler}
                />
                {days.map((d) => {
                  const today = isToday(d);
                  const nowMin = today ? nowOffsetMinutes(new Date(), START_HOUR, END_HOUR) : null;
                  const timed = (byDay.get(d.toDateString()) || []).filter(
                    (e) => !e.allDay && e.startAt,
                  );
                  return (
                    <HourGrid
                      key={d.toISOString()}
                      day={d}
                      startHour={START_HOUR}
                      endHour={END_HOUR}
                      hourHeight={HOUR_H}
                      lineColor="var(--line-grid)"
                      className={cx(styles.col, today && styles.colToday)}
                      onSlotClick={canCreate ? onSlotClick : null}
                    >
                      {timed.map((e) => {
                        const { top, height } = eventToGridPosition(e.startAt, e.endAt, {
                          gridStartHour: START_HOUR,
                          hourHeight: HOUR_H,
                        });
                        const blockHeight = blockHeightFor(e, height);
                        const clampedTop = Math.max(0, Math.min(top, GRID_H - blockHeight));
                        return (
                          <EventBlock
                            key={e.id}
                            event={e}
                            calendar={calendar}
                            variant="week"
                            top={clampedTop}
                            height={blockHeight}
                            left={4}
                            width="calc(100% - 8px)"
                            selected={e.id === detailsEventId}
                            author={authorsById[e.creator] || null}
                            onClick={() => openDetails(e.id)}
                            onToggleComplete={() => toggleCompleted(e.id)}
                          />
                        );
                      })}
                      {nowMin !== null ? <NowLine top={(nowMin / 60) * HOUR_H} /> : null}
                    </HourGrid>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        <aside className={styles.sideRight} aria-label="Активність">
          <Card title="Активність" gap={12}>
            {activity.length ? (
              <ul className={styles.activity}>
                {activity.map((a) => {
                  const person = authorsById[a.user];
                  return (
                    <li key={a.id} className={styles.activityItem}>
                      <Avatar
                        initials={person?.initials || '?'}
                        color={person?.color || 'graphite'}
                        size={24}
                      />
                      <span className={styles.activityText}>
                        <span>
                          <b>{person?.name || 'Учасник'}</b> {a.text}
                        </span>
                        {a.note ? <span className={styles.activityWhen}>{a.note}</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <span className={styles.activityEmpty}>Поки що тихо</span>
            )}
          </Card>

          {pendingInvites.map((inv) => (
            <DarkCard
              key={inv.id}
              eyebrow="Очікує відповіді"
              title={
                <Link to={`/invite/${inv.token}`} className={styles.inviteLink}>
                  {inv.event?.title || inv.calendar?.name || 'Запрошення'}
                </Link>
              }
              meta={inviteMeta(inv)}
              footer={
                <div className={styles.inviteBtns}>
                  <PillButton
                    variant="white"
                    size="xs"
                    shape="rounded"
                    className={styles.half}
                    disabled={respondingId === inv.id}
                    onClick={() => respond(inv.id, 'accepted')}
                  >
                    Прийняти
                  </PillButton>
                  <button
                    type="button"
                    className={styles.decline}
                    disabled={respondingId === inv.id}
                    onClick={() => respond(inv.id, 'declined')}
                  >
                    Відхилити
                  </button>
                </div>
              }
            />
          ))}
        </aside>
      </div>
    </>
  );
}
