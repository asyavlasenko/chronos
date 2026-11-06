/** Склеює класи, пропускаючи falsy: cx(styles.a, isActive && styles.active) */
export default function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}
