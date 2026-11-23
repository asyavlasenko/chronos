import Card from '../components/ui/Card';
import PillButton from '../components/ui/PillButton';
import styles from './ErrorPage.module.css';

const reload = () => window.location.reload();

export default function ErrorPage() {
  return (
    <div className={styles.page}>
      <Card padding="28px" gap={8} className={styles.card}>
        <span className={styles.code}>Помилка</span>
        <h1 className={styles.title}>Щось пішло не так</h1>
        <p className={styles.text}>
          Сторінка зіткнулася з несподіваною помилкою. Твої дані збережено: онови сторінку або
          повернись на Огляд.
        </p>
        <div className={styles.actions}>
          <PillButton onClick={reload}>Оновити сторінку</PillButton>
          <PillButton variant="secondary" href="/">
            На Огляд
          </PillButton>
        </div>
      </Card>
    </div>
  );
}
