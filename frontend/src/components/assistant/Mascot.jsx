import PropTypes from 'prop-types';
import cx from '../../utils/cx';
import styles from './Mascot.module.css';

const MOODS = ['idle', 'thinking', 'happy'];

function Eyes({ mood }) {
  if (mood === 'happy') {
    return (
      <g className={styles.smile}>
        <path d="M19.5 34.5q3.5-4.5 7 0" />
        <path d="M37.5 34.5q3.5-4.5 7 0" />
      </g>
    );
  }

  const shift = mood === 'thinking' ? { x: 1.2, y: -1.6 } : { x: 0, y: 0 };
  return (
    <g className={cx(styles.eyes, mood === 'idle' && styles.blink)}>
      <circle cx={23 + shift.x} cy={33.5 + shift.y} r="2.7" />
      <circle cx={41 + shift.x} cy={33.5 + shift.y} r="2.7" />
      <circle className={styles.glint} cx={24 + shift.x} cy={32.5 + shift.y} r="0.9" />
      <circle className={styles.glint} cx={42 + shift.x} cy={32.5 + shift.y} r="0.9" />
    </g>
  );
}

Eyes.propTypes = {
  mood: PropTypes.oneOf(MOODS).isRequired,
};

export default function Mascot({ mood = 'idle', size = 44 }) {
  return (
    <svg
      className={cx(styles.mascot, styles[mood])}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <g className={styles.head}>
        <path className={styles.fur} d="M10 27 13.5 6.5 30 18.5Z" />
        <path className={styles.fur} d="M54 27 50.5 6.5 34 18.5Z" />
        <path className={styles.inner} d="M15.2 21.5 16.8 12 24.6 17.8Z" />
        <path className={styles.inner} d="M48.8 21.5 47.2 12 39.4 17.8Z" />
        <path
          className={styles.fur}
          d="M32 14c14 0 24 8 24 20 0 6-6 12-12 16-4 3-8 6-12 6s-8-3-12-6C14 46 8 40 8 34c0-12 10-20 24-20Z"
        />
        <path
          className={styles.cheek}
          d="M8.4 36.5c5.6-2.2 13.6-.4 18.6 5.5 2.6 3.2 4.4 8 5 14-4 0-8-3-12-6-5.6-3.8-11-8.6-11.6-13.5Z"
        />
        <path
          className={styles.cheek}
          d="M55.6 36.5c-5.6-2.2-13.6-.4-18.6 5.5-2.6 3.2-4.4 8-5 14 4 0 8-3 12-6 5.6-3.8 11-8.6 11.6-13.5Z"
        />
        {mood === 'happy' ? (
          <g className={styles.blush}>
            <ellipse cx="16.5" cy="40.5" rx="3.2" ry="1.9" />
            <ellipse cx="47.5" cy="40.5" rx="3.2" ry="1.9" />
          </g>
        ) : null}
        <Eyes mood={mood} />
        <path
          className={styles.nose}
          d="M29.4 47.2h5.2a1 1 0 0 1 .8 1.6l-2.6 3.3a1 1 0 0 1-1.6 0l-2.6-3.3a1 1 0 0 1 .8-1.6Z"
        />
      </g>
    </svg>
  );
}

Mascot.propTypes = {
  mood: PropTypes.oneOf(MOODS),
  size: PropTypes.number,
};
