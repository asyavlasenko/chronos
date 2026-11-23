import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
const byNewest = (a, b) => toDate(b.createdAt || b.startAt) - toDate(a.createdAt || a.startAt);
const WEEKDAYS_LOCATIVE = [
  'у понеділок',
  'у вівторок',
  'у середу',
  'у четвер',
  "у п'ятницю",
  'у суботу',
  'у неділю',
];
const ERROR_FIELDS = { title: 'title', startAt: 'date' };
const pluralActive = (n) => `${n} ${plural(n, ['активна', 'активні', 'активних'])}`;

function sectionKey(task, weekFrom, weekTo) {
  if (task.isFloating) return 'floating';
  if (!task.startAt) return 'later';
  if (isToday(task.startAt)) return 'today';
  const start = toDate(task.startAt);
  if (start < weekFrom) return 'overdue';
  return start < weekTo ? 'week' : 'later';
}

function deadlinesText(deadlines) {
  if (deadlines.length === 0) return 'без дедлайнів';
  if (deadlines.length === 1) {
    return `1 дедлайн ${WEEKDAYS_LOCATIVE[weekdayIndex(deadlines[0].startAt)]}`;
  }
  return pluralDeadlines(deadlines.length);
}

export default function TasksPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const { user } = useAuth();
  const userId = user?.id || null;
  const weekStartsOn = user?.weekStartsOn ?? 1;
  const timeFormat = user?.timeFormat ?? '24h';
  const { calendars, byId } = useCalendars();
  const { openDetails } = useModals();
  const {
    events: tasks,
    createEvent,
    toggleCompleted,
  } = useEvents({ types: TASK_TYPES, q, includeFloating: true });
  const { events: allTasks } = useEvents({ types: TASK_TYPES, includeFloating: true });

  const today = useMemo(() => startOfDay(new Date()), []);
  const weekFrom = useMemo(() => startOfWeek(today, weekStartsOn), [today, weekStartsOn]);
  const weekTo = useMemo(() => addDays(weekFrom, 7), [weekFrom]);
  const inWeek = (value) => Boolean(value) && toDate(value) >= weekFrom && toDate(value) < weekTo;

  const [calFilter, setCalFilter] = useState('all');
  const [showDone, setShowDone] = useState(true);
  const [highOnly, setHighOnly] = useState(false);
  const [allDone, setAllDone] = useState(false);

  const editableCalendars = useMemo(
    () => calendars.filter((c) => isWritableCalendar(c) && !c.isHidden),
    [calendars],
  );
  const [title, setTitle] = useState('');
  const [preferredCalendar, setPreferredCalendar] = useState('');
  const [dateStr, setDateStr] = useState(() => toDateParam(today));
  const [isDateless, setIsDateless] = useState(false);
  const [error, setError] = useState(null);
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
    const startAt = isDateless ? null : combineDateTime(dateStr);
    if (!name) {
      setError({ field: 'title', text: 'Вкажи назву задачі' });
      return;
    }
    if (!isDateless && !startAt) {
      setError({ field: 'date', text: 'Вкажи дату' });
      return;
    }
    if (!calendarId) {
      setError({ field: null, text: 'Немає календаря, у який можна додати задачу' });
      return;
    }

    inFlight.current = true;
    setIsAdding(true);
    setError(null);
    try {
      const when = isDateless ? { isFloating: true } : { startAt, allDay: true };
      await createEvent({
        type: 'task',
        title: name,
        calendar: calendarId,
        priority: 'medium',
        ...when,
      });
      if (isMounted.current) setTitle('');
    } catch (err) {
      const { message, fields } = parseApiError(err);
      const [path] = Object.keys(fields);
      if (isMounted.current) {
        setError({ field: ERROR_FIELDS[path] || null, text: fields[path] || message });
      }
    } finally {
      inFlight.current = false;
      if (isMounted.current) setIsAdding(false);
    }
  };

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
  const inSection = (key) => (t) => sectionKey(t, weekFrom, weekTo) === key;
  const todayList = active.filter(inSection('today'));
  const overdueList = active.filter(inSection('overdue'));
  const weekList = active.filter(inSection('week'));
  const laterList = active.filter(inSection('later'));
  const floatingList = active.filter(inSection('floating')).sort(byNewest);
  const doneAll = visible.filter((t) => t.isCompleted);
  const doneWeek = doneAll.filter((t) => inWeek(t.completedAt));
  const doneList = allDone ? doneAll : doneWeek;

  const activeAll = allTasks.filter((t) => !t.isCompleted);
  const doneWeekCount = allTasks.filter((t) => t.isCompleted && inWeek(t.completedAt)).length;
  const weekTasks = allTasks.filter(
    (t) => (!t.isFloating && inWeek(t.startAt)) || (t.isCompleted && inWeek(t.completedAt)),
  );
  const weekDoneCount = weekTasks.filter((t) => t.isCompleted).length;
  const todayCount = activeAll.filter(inSection('today')).length;
  const deadlines = activeAll.filter((t) => t.isDeadline && inWeek(t.startAt));
  const progress = weekTasks.length ? Math.round((weekDoneCount / weekTasks.length) * 100) : 0;

  const perCalendar = taskCalendars
    .map((c) => ({ calendar: c, count: activeAll.filter((t) => t.calendar === c.id).length }))
    .filter((row) => row.count > 0);

  const selectedCalendar = byId[calendarId] || null;
  const titleInvalid = error?.field === 'title';
  const dateInvalid = error?.field === 'date';
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
      key: 'floating',
      title: 'Колись',
      subtitle: 'без дедлайну',
      list: floatingList,
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
                if (error) setError(null);
              }}
              invalid={titleInvalid}
              aria-invalid={titleInvalid}
              aria-describedby={titleInvalid ? 'new-task-error' : undefined}
              className={styles.titleInput}
            />
            <Chip
              variant="plain"
              label="Без дати"
              checked={isDateless}
              onChange={(value) => {
                setIsDateless(value);
                if (error) setError(null);
              }}
              className={styles.dateless}
            />
            {isDateless ? null : (
              <Input
                type="date"
                size="xs"
                aria-label="Дата задачі"
                value={dateStr}
                readOnly={isAdding}
                onChange={(e) => {
                  setDateStr(e.target.value);
                  if (error) setError(null);
                }}
                invalid={dateInvalid}
                aria-invalid={dateInvalid}
                aria-describedby={dateInvalid ? 'new-task-error' : undefined}
                className={styles.dateInput}
              />
            )}
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
            <PillButton variant="primary" size="xs" type="submit" disabled={isAdding}>
              {isAdding ? 'Додаємо…' : 'Додати'}
            </PillButton>
          </div>
          {error ? (
            <span id="new-task-error" className={styles.error} role="alert">
              {error.text}
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
              {s.list.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  calendar={byId[t.calendar]}
                  timeFormat={timeFormat}
                  onToggleComplete={toggleCompleted}
                  canToggle={canModify(t)}
                  onOpen={openDetails}
                />
              ))}
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
