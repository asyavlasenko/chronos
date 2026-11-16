import nodemailer from 'nodemailer';
import env from '../config/env.js';

export const outbox = [];

let transporter = null;

export const isMailConfigured = () => Boolean(env.smtp.host) && !env.isTest;

function getTransporter() {
  if (transporter) return transporter;

  if (!isMailConfigured()) {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  return transporter;
}

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function layout({ heading, lines, buttonLabel, buttonUrl, footer }) {
  const body = lines.map((line) => `<p style="margin:0 0 10px;color:#374151">${line}</p>`).join('');
  return `
  <div style="background:#F3F4F6;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#111827">
    <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:18px;padding:28px">
      <p style="margin:0 0 18px;font-size:16px;font-weight:700">Chronos</p>
      <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25">${heading}</h1>
      ${body}
      <p style="margin:22px 0 0">
        <a href="${buttonUrl}" style="display:inline-block;background:#111827;color:#FFFFFF;text-decoration:none;border-radius:999px;padding:12px 22px;font-size:14px;font-weight:600">${buttonLabel}</a>
      </p>
      <p style="margin:22px 0 0;font-size:12px;color:#6B7280">${footer}</p>
    </div>
  </div>`;
}

export async function sendMail({ to, subject, html, text }) {
  const info = await getTransporter().sendMail({ from: env.smtp.from, to, subject, html, text });

  if (env.isTest) {
    outbox.push({ to, subject, html, text });
  } else if (!isMailConfigured()) {
    console.log(`[mail:dev] Кому: ${to} · ${subject}\n${text}\n`);
  }

  return { messageId: info.messageId };
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
        'Ми отримали запит на скидання пароля. Якщо це була не ти, просто проігноруй цей лист.',
      ],
      buttonLabel: 'Задати новий пароль',
      buttonUrl: resetUrl,
      footer: `Посилання дійсне ${ttlMinutes} хвилин.`,
    }),
    text: `${subject}\nЗадати новий пароль: ${resetUrl}\nПосилання дійсне ${ttlMinutes} хвилин.`,
  });
}
