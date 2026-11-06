// 404: центрована картка з посиланням на Огляд (поза PageShell — без хедера).
import Card from '../components/ui/Card';
import PillButton from '../components/ui/PillButton';
import styles from './NotFoundPage.module.css';

export default function NotFoundPage() {
  return (
    <div className={styles.page}>
      <Card padding="28px" gap={8} className={styles.card}>
        <span className={styles.code}>404</span>
        <h1 className={styles.title}>Сторінку не знайдено</h1>
        <p className={styles.text}>Можливо, посилання застаріло або в адресі помилка.</p>
        <PillButton to="/" className={styles.btn}>
          На Огляд
        </PillButton>
      </Card>
    </div>
  );
}
