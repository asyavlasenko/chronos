// Дизайн: design/screens/01-overview.html (картка «Задачі»: «2 з 5», прогрес 6px, до 3 невиконаних задач, «Усі задачі →»)
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { isToday } from '../../utils/dates';
import { eventShape } from '../../utils/propTypes';
import Card from '../ui/Card';
import Checkbox from '../ui/Checkbox';
import Badge from '../ui/Badge';
import styles from './TasksCard.module.css';

const MAX_ITEMS = 3;

export default function TasksCard({ tasks, onToggleComplete, onOpen, className = '' }) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.isCompleted).length;
  const open = tasks.filter((t) => !t.isCompleted).slice(0, MAX_ITEMS);
  const percent = total ? Math.round((done / total) * 100) : 0;
  let emptyText = null;
  if (!total) emptyText = 'Немає задач цього тижня';
  else if (!open.length) emptyText = 'Усі задачі виконано';

  return (
    <Card
      aria-label="Задачі"
      title="Задачі"
      action={
        <span className={styles.count}>
          {done} з {total}
        </span>
      }
      gap={8}
      className={className}
    >
      <div className={styles.bar} aria-hidden="true">
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      <ul className={styles.list}>
        {open.map((t) => (
          <li key={t.id} className={styles.item}>
            <Checkbox
              checked={Boolean(t.isCompleted)}
              onChange={() => onToggleComplete(t)}
              size={15}
              label={`Виконано: ${t.title}`}
            />
            <button type="button" className={styles.title} onClick={() => onOpen(t)}>
              {t.title}
            </button>
            {t.startAt && isToday(t.startAt) ? (
              <Badge variant="accent" size="sm">
                сьогодні
              </Badge>
            ) : null}
          </li>
        ))}
        {emptyText ? <li className={styles.empty}>{emptyText}</li> : null}
      </ul>
      <Link to="/tasks" className={styles.more}>
        Усі задачі →
      </Link>
    </Card>
  );
}

TasksCard.propTypes = {
  tasks: PropTypes.arrayOf(eventShape).isRequired,
  onToggleComplete: PropTypes.func.isRequired,
  onOpen: PropTypes.func.isRequired,
  className: PropTypes.string,
};
