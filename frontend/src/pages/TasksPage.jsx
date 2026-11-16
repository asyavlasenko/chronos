import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { parseApiError } from '../api/errors';
import useAuth from '../hooks/useAuth';
import useEvents from '../hooks/useEvents';
import useCalendars from '../hooks/useCalendars';
import useModals from '../hooks/useModals';
import cx from '../utils/cx';
import {
  addDays,
  formatDate,
  isToday,
  startOfDay,
  startOfWeek,
  toDate,
  toDateParam,
  weekdayIndex,
} from '../utils/dates';
import { plural, pluralDeadlines, pluralTasks } from '../utils/text';
import { colorVars } from '../utils/colors';
import Card from '../components/ui/Card';
import DarkCard from '../components/ui/DarkCard';
import PillButton from '../components/ui/PillButton';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Chip from '../components/ui/Chip';
import Badge from '../components/ui/Badge';
import Icon from '../components/ui/Icon';
import TaskRow from '../components/tasks/TaskRow';
import {
  canModifyEvent,
  combineDateTime,
  isWritableCalendar,
  pickWritableCalendarId,
} from '../modals/eventFormUtils';
import styles from './TasksPage.module.css';

const TASK_TYPES = ['task'];
const WEEKDAYS_LOCATIVE = [
  'у понеділок',
  'у вівторок',
  'у середу',
  'у четвер',
  "у п'ятницю",
  'у суботу',
  'у неділю',
];
const pluralActive = (n) => `${n} ${plural(n, ['активна', 'активні', 'активних'])}`;

function deadlinesText(deadlines) {
  if (deadlines.length === 0) return 'без дедлайнів';
  if (deadlines.length === 1) {
    return `1 дедлайн ${WEEKDAYS_LOCATIVE[weekdayIndex(deadlines[0].startAt)]}`;
  }
  return pluralDeadlines(deadlines.length);
}

export default function TasksPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const { user } = useAuth();
  const userId = user?.id || null;
  const weekStartsOn = user?.weekStartsOn ?? 1;
  const timeFormat = user?.timeFormat ?? '24h';
  const { calendars, byId } = useCalendars();
  const { openDetails } = useModals();
  const { events: tasks, createEvent, toggleCompleted } = useEvents({ types: TASK_TYPES, q });
  const { events: allTasks } = useEvents({ types: TASK_TYPES });

  const today = useMemo(() => startOfDay(new Date()), []);
  const weekFrom = useMemo(() => startOfWeek(today, weekStartsOn), [today, weekStartsOn]);
  const weekTo = useMemo(() => addDays(weekFrom, 7), [weekFrom]);
  const inWeek = (value) => Boolean(value) && toDate(value) >= weekFrom && toDate(value) < weekTo;

  const [calFilter, setCalFilter] = useState('all');
  const [showDone, setShowDone] = useState(true);
  const [showNoDate, setShowNoDate] = useState(true);
  const [highOnly, setHighOnly] = useState(false);
  const [allDone, setAllDone] = useState(false);

  const editableCalendars = useMemo(
    () => calendars.filter((c) => isWritableCalendar(c) && !c.isHidden),
    [calendars],
  );
  const [title, setTitle] = useState('');
  const [preferredCalendar, setPreferredCalendar] = useState('');
  const [withDate, setWithDate] = useState(false);
  const [dateStr, setDateStr] = useState(() => toDateParam(today));
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const isMounted = useRef(true);
  const inFlight = useRef(false);
  const calendarId = pickWritableCalendarId(editableCalendars, preferredCalendar);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (inFlight.current) return;

    const name = title.trim();
    const startAt = withDate ? combineDateTime(dateStr) : null;
    if (!name) {
      setError('Вкажи назву задачі');
      return;
    }
    if (withDate && !startAt) {
      setError('Вкажи дату або обери «Без дати»');
      return;
    }
    if (!calendarId) {
      setError('Немає календаря, у який можна додати задачу');
      return;
    }

    inFlight.current = true;
    setIsAdding(true);
    setError('');
    try {
      await createEvent({
        type: 'task',
        title: name,
        calendar: calendarId,
        startAt,
        allDay: true,
        priority: 'medium',
      });
      if (isMounted.current) setTitle('');
    } catch (err) {
      const { message, fields } = parseApiError(err);
      if (isMounted.current) setError(Object.values(fields)[0] || message);
    } finally {
      inFlight.current = false;
      if (isMounted.current) setIsAdding(false);
    }
  };

  const schedule = (task) => navigate(`/events/${task.id}`);
  const canModify = (task) => canModifyEvent(task, byId[task.calendar], userId);

  const taskCalendars = calendars.filter((c) => allTasks.some((t) => t.calendar === c.id));
  const activeFilter = taskCalendars.some((c) => c.id === calFilter) ? calFilter : 'all';

  const visible = useMemo(
    () =>
      tasks
        .filter((t) => activeFilter === 'all' || t.calendar === activeFilter)
        .filter((t) => !highOnly || t.priority === 'high'),
    [tasks, activeFilter, highOnly],
  );
  const active = visible.filter((t) => !t.isCompleted);
  const todayList = active.filter((t) => t.startAt && isToday(t.startAt));
  const overdueList = active.filter((t) => t.startAt && toDate(t.startAt) < weekFrom);
  const weekList = active.filter((t) => inWeek(t.startAt) && !isToday(t.startAt));
  const laterList = active.filter((t) => t.startAt && toDate(t.startAt) >= weekTo);
  const noDateList = active.filter((t) => !t.startAt);
  const doneAll = visible.filter((t) => t.isCompleted);
  const doneWeek = doneAll.filter((t) => inWeek(t.completedAt));
  const doneList = allDone ? doneAll : doneWeek;

  const activeAll = allTasks.filter((t) => !t.isCompleted);
  const doneWeekCount = allTasks.filter((t) => t.isCompleted && inWeek(t.completedAt)).length;
  const weekTasks = allTasks.filter(
    (t) => inWeek(t.startAt) || (t.isCompleted && inWeek(t.completedAt)),
  );
  const weekDoneCount = weekTasks.filter((t) => t.isCompleted).length;
  const todayCount = activeAll.filter((t) => t.startAt && isToday(t.startAt)).length;
  const deadlines = activeAll.filter((t) => t.isDeadline && inWeek(t.startAt));
  const progress = weekTasks.length ? Math.round((weekDoneCount / weekTasks.length) * 100) : 0;

  const perCalendar = taskCalendars
    .map((c) => ({ calendar: c, count: activeAll.filter((t) => t.calendar === c.id).length }))
    .filter((row) => row.count > 0);

  const selectedCalendar = byId[calendarId] || null;
  const calendarOptions = editableCalendars.map((c) => ({ value: c.id, label: c.name }));

  const sections = [
    {
      key: 'overdue',
      title: 'Прострочені',
      subtitle: 'до початку цього тижня',
      list: overdueList,
      hidden: overdueList.length === 0,
    },
    {
      key: 'today',
      title: 'Сьогодні',
      subtitle: formatDate(today, 'weekday-short'),
      action: (
        <Badge variant="accent" size="md" className={styles.count}>
          {pluralTasks(todayList.length)}
        </Badge>
      ),
      list: todayList,
      empty: 'На сьогодні задач немає',
    },
    {
      key: 'week',
      title: 'Цього тижня',
      subtitle: `до ${formatDate(addDays(weekFrom, 6), 'weekday-short')}`,
      list: weekList,
      empty: 'Цього тижня більше нічого не заплановано',
    },
    {
      key: 'later',
      title: 'Пізніше',
      subtitle: 'після цього тижня',
      list: laterList,
      hidden: laterList.length === 0,
    },
    {
      key: 'nodate',
      title: 'Без дати',
      subtitle: 'натисни «Запланувати», щоб додати дату',
      list: noDateList,
      hidden: !showNoDate,
      empty: 'Задач без дати немає',
    },
    {
      key: 'done',
      title: 'Виконані',
      muted: true,
      subtitle: allDone ? `усього · ${doneAll.length}` : `цього тижня · ${doneWeek.length}`,
      action: (
        <button type="button" className={styles.link} onClick={() => setAllDone((v) => !v)}>
          {allDone ? 'Згорнути' : 'Показати всі'}
        </button>
      ),
      list: doneList,
      hidden: !showDone,
      empty: 'Ще нічого не виконано',
    },
  ];

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <div className={styles.titleRow}>
          <h1 className={styles.h1}>Задачі</h1>
          <span className={styles.subtitle}>
            {pluralActive(activeAll.length)} · {doneWeekCount} виконано цього тижня
          </span>
          <span className={styles.spacer} />
          <div className={styles.filters} role="group" aria-label="Фільтр за календарем">
            <PillButton
              size="xxs"
              variant={activeFilter === 'all' ? 'primary' : 'white'}
              className={cx(activeFilter !== 'all' && styles.filterOff)}
              aria-pressed={activeFilter === 'all'}
              onClick={() => setCalFilter('all')}
            >
              Усі
            </PillButton>
            {taskCalendars.map((c) => (
              <PillButton
                key={c.id}
                size="xxs"
                variant={activeFilter === c.id ? 'primary' : 'white'}
                className={cx(activeFilter !== c.id && styles.filterOff)}
                aria-pressed={activeFilter === c.id}
                onClick={() => setCalFilter(c.id)}
              >
                {c.name}
              </PillButton>
            ))}
          </div>
        </div>

        <Card
          as="form"
          padding="8px 8px 8px 16px"
          gap={6}
          className={styles.form}
          onSubmit={onSubmit}
          noValidate
          aria-label="Нова задача"
        >
          <div className={styles.formRow}>
            <Icon name="plus" size={16} strokeWidth={2.4} className={styles.plus} />
            <Input
              id="new-task-title"
              size="sm"
              maxLength={120}
              placeholder="Нова задача… напр., «Оновити README до п'ятниці»"
              aria-label="Нова задача"
              value={title}
              readOnly={isAdding}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              invalid={Boolean(error)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'new-task-error' : undefined}
              className={styles.titleInput}
            />
            {withDate ? (
              <Input
                type="date"
                size="xs"
                aria-label="Дата задачі"
                value={dateStr}
                onChange={(e) => {
                  setDateStr(e.target.value);
                  if (error) setError('');
                }}
                className={styles.dateInput}
              />
            ) : null}
            <Select
              size="xs"
              aria-label="Календар"
              options={calendarOptions}
              value={calendarId}
              onChange={setPreferredCalendar}
              leading={
                <span
                  className={styles.dot}
                  style={{ background: colorVars(selectedCalendar?.color).base }}
                />
              }
              className={styles.calSelect}
            />
            <PillButton
              variant="secondary"
              size="xs"
              aria-pressed={!withDate}
              className={cx(withDate && styles.dateOff)}
              onClick={() => setWithDate((v) => !v)}
            >
              Без дати
            </PillButton>
            <PillButton variant="primary" size="xs" type="submit" disabled={isAdding}>
              {isAdding ? 'Додаємо…' : 'Додати'}
            </PillButton>
          </div>
          {error ? (
            <span id="new-task-error" className={styles.error} role="alert">
              {error}
            </span>
          ) : null}
        </Card>

        {sections
          .filter((s) => !s.hidden)
          .map((s) => (
            <Card
              key={s.key}
              as="section"
              padding="0"
              gap={0}
              className={styles.group}
              aria-label={s.title}
            >
              <div className={styles.groupHead}>
                <h2 className={cx(styles.groupTitle, s.muted && styles.groupTitleMuted)}>
                  {s.title}
                </h2>
                <span className={styles.groupSub}>{s.subtitle}</span>
                {s.action || null}
              </div>
              {s.list.map((t) => {
                const editable = canModify(t);
                return (
                  <TaskRow
                    key={t.id}
                    task={t}
                    calendar={byId[t.calendar]}
                    timeFormat={timeFormat}
                    onToggleComplete={toggleCompleted}
                    canToggle={editable}
                    onOpen={openDetails}
                    onSchedule={editable ? schedule : null}
                  />
                );
              })}
              {s.list.length === 0 && s.empty ? (
                <div className={styles.empty}>{s.empty}</div>
              ) : null}
            </Card>
          ))}
      </div>

      <aside className={styles.side}>
        <DarkCard
          eyebrow="Цього тижня"
          valueSize={28}
          value={
            <>
              {weekDoneCount} <span className={styles.valueSub}>з {weekTasks.length} виконано</span>
            </>
          }
        >
          <div className={styles.bar} aria-hidden="true">
            <span className={styles.barFill} style={{ width: `${progress}%` }} />
          </div>
          <span className={styles.darkMeta}>
            {todayCount} на сьогодні · {deadlinesText(deadlines)}
          </span>
        </DarkCard>

        <Card gap={8}>
          <span className={styles.sideTitle}>За календарями</span>
          {perCalendar.map(({ calendar, count }) => (
            <div key={calendar.id} className={styles.calRow}>
              <span className={styles.dot} style={{ background: colorVars(calendar.color).base }} />
              <span className={styles.calName}>{calendar.name}</span>
              <span className={styles.calCount}>{count}</span>
            </div>
          ))}
          {perCalendar.length === 0 ? (
            <span className={styles.sideEmpty}>Активних задач немає</span>
          ) : null}
        </Card>

        <Card gap={8}>
          <span className={styles.sideTitle}>Показувати</span>
          <Chip variant="plain" label="Виконані" checked={showDone} onChange={setShowDone} />
          <Chip variant="plain" label="Без дати" checked={showNoDate} onChange={setShowNoDate} />
          <Chip
            variant="plain"
            label="Лише з високим пріоритетом"
            checked={highOnly}
            onChange={setHighOnly}
          />
        </Card>
      </aside>
    </div>
  );
}
