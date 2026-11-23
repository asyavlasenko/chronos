import nodemailer from 'nodemailer';
import env from '../config/env.js';

export const outbox = [];

let transportPromise = null;

export const isMailConfigured = () => Boolean(env.smtp.host) && !env.isTest;

const consoleTransport = () => nodemailer.createTransport({ jsonTransport: true });

function smtpTransport() {
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
}

async function etherealTransport() {
  const account = await nodemailer.createTestAccount();
  console.log(`[mail] Тестова скринька Ethereal створена: ${account.user}`);
  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass },
  });
}

async function createTransport() {
  if (env.isTest) return consoleTransport();
  if (env.smtp.host) return smtpTransport();

  try {
    return await etherealTransport();
  } catch (err) {
    console.warn(`[mail] Ethereal недоступний (${err.message}), листи друкуються в консоль`);
    return consoleTransport();
  }
}

function getTransporter() {
  if (!transportPromise) transportPromise = createTransport();
  return transportPromise;
}

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function layout({ heading, lines, buttonLabel, buttonUrl, footer }) {
  const body = lines.map((line) => `<p style="margin:0 0 10px;color:#374151">${line}</p>`).join('');
  const button = buttonUrl
    ? `<p style="margin:22px 0 0">
        <a href="${buttonUrl}" style="display:inline-block;background:#111827;color:#FFFFFF;text-decoration:none;border-radius:999px;padding:12px 22px;font-size:14px;font-weight:600">${buttonLabel}</a>
      </p>`
    : '';
  return `
  <div style="background:#F3F4F6;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#111827">
    <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:18px;padding:28px">
      <p style="margin:0 0 18px;font-size:16px;font-weight:700">Chronos</p>
      <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25">${heading}</h1>
      ${body}
      ${button}
      <p style="margin:22px 0 0;font-size:12px;color:#6B7280">${footer}</p>
    </div>
  </div>`;
}

export async function sendMail({ to, subject, html, text }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({ from: env.smtp.from, to, subject, html, text });
  const previewUrl = nodemailer.getTestMessageUrl(info) || null;

  if (env.isTest) {
    outbox.push({ to, subject, html, text });
  } else if (previewUrl) {
    console.log(`[mail] ${to} · ${subject}\n       Переглянути лист: ${previewUrl}`);
  } else if (transporter.options.jsonTransport) {
    console.log(`[mail:console] Кому: ${to} · ${subject}\n${text}\n`);
  } else {
    console.log(`[mail] Надіслано: ${to} · ${subject}`);
  }

  return { messageId: info.messageId, previewUrl };
}

export function sendInviteEmail({ to, inviterName, kind, title, when, acceptUrl }) {
  const target = kind === 'calendar' ? 'в календар' : 'на подію';
  const subject = `${inviterName} запрошує тебе ${target} «${title}»`;
  const lines = [
    `<b>${escapeHtml(inviterName)}</b> запрошує тебе ${target} <b>«${escapeHtml(title)}»</b>.`,
  ];
  if (when) lines.push(escapeHtml(when));

  return sendMail({
    to,
    subject,
    html: layout({
      heading: kind === 'calendar' ? 'Запрошення в календар' : 'Запрошення на подію',
      lines,
      buttonLabel: 'Переглянути запрошення',
      buttonUrl: acceptUrl,
      footer: 'Запрошення дійсне 7 днів. Якщо в тебе ще немає акаунта, зареєструйся з цим email.',
    }),
    text: `${subject}\n${when ? `${when}\n` : ''}Переглянути запрошення: ${acceptUrl}`,
  });
}

export function sendPasswordResetEmail({ to, name, resetUrl, ttlMinutes }) {
  const subject = 'Скидання пароля в Chronos';
  return sendMail({
    to,
    subject,
    html: layout({
      heading: 'Скидання пароля',
      lines: [
        `Привіт, ${escapeHtml(name)}!`,
        'Ми отримали запит на скидання пароля. Якщо це не твій запит, просто проігноруй цей лист.',
      ],
      buttonLabel: 'Задати новий пароль',
      buttonUrl: resetUrl,
      footer: `Посилання дійсне ${ttlMinutes} хвилин.`,
    }),
    text: `${subject}\nЗадати новий пароль: ${resetUrl}\nПосилання дійсне ${ttlMinutes} хвилин.`,
  });
}

const REMINDER_HEADINGS = {
  arrangement: 'Нагадування про зустріч',
  reminder: 'Нагадування',
  task: 'Нагадування про задачу',
};

const NOTIFICATIONS_FOOTER = 'Ці листи можна вимкнути в профілі, у розділі «Сповіщення».';

export function sendReminderEmail({ to, type, title, when, lead, location, eventUrl }) {
  const subject = `Нагадування: «${title}» ${lead}`;
  const lines = [`<b>«${escapeHtml(title)}»</b> ${escapeHtml(lead)}.`, escapeHtml(when)];
  if (location) lines.push(`Місце: ${escapeHtml(location)}`);

  return sendMail({
    to,
    subject,
    html: layout({
      heading: REMINDER_HEADINGS[type] ?? REMINDER_HEADINGS.reminder,
      lines,
      buttonLabel: 'Відкрити подію',
      buttonUrl: eventUrl,
      footer: NOTIFICATIONS_FOOTER,
    }),
    text: `${subject}\n${when}\n${location ? `Місце: ${location}\n` : ''}Відкрити подію: ${eventUrl}`,
  });
}

export function sendEventChangedEmail({ to, editorName, title, when, location, eventUrl }) {
  const subject = `${editorName} змінив(-ла) подію «${title}»`;
  const lines = [
    `<b>${escapeHtml(editorName)}</b> змінив(-ла) подію <b>«${escapeHtml(title)}»</b>.`,
    `Тепер: ${escapeHtml(when)}`,
  ];
  if (location) lines.push(`Місце: ${escapeHtml(location)}`);

  return sendMail({
    to,
    subject,
    html: layout({
      heading: 'Подію змінено',
      lines,
      buttonLabel: 'Відкрити подію',
      buttonUrl: eventUrl,
      footer: NOTIFICATIONS_FOOTER,
    }),
    text: `${subject}\nТепер: ${when}\n${location ? `Місце: ${location}\n` : ''}Відкрити подію: ${eventUrl}`,
  });
}

export function sendEventCancelledEmail({ to, editorName, title, when }) {
  const subject = `${editorName} скасував(-ла) подію «${title}»`;

  return sendMail({
    to,
    subject,
    html: layout({
      heading: 'Подію скасовано',
      lines: [
        `<b>${escapeHtml(editorName)}</b> скасував(-ла) подію <b>«${escapeHtml(title)}»</b>.`,
        `Було заплановано: ${escapeHtml(when)}`,
      ],
      footer: NOTIFICATIONS_FOOTER,
    }),
    text: `${subject}\nБуло заплановано: ${when}`,
  });
}

export function sendVerificationEmail({ to, name, verifyUrl, ttlHours }) {
  const subject = 'Підтверди email у Chronos';
  return sendMail({
    to,
    subject,
    html: layout({
      heading: 'Підтверди свій email',
      lines: [
        `Привіт, ${escapeHtml(name)}!`,
        'Залишився один крок: натисни кнопку нижче, щоб завершити реєстрацію в Chronos.',
      ],
      buttonLabel: 'Підтвердити email',
      buttonUrl: verifyUrl,
      footer: `Посилання дійсне ${ttlHours} год. Якщо це не ти реєструвався, просто проігноруй цей лист.`,
    }),
    text: `${subject}\nПідтвердити email: ${verifyUrl}\nПосилання дійсне ${ttlHours} год.`,
  });
}
