// Відправка листів через nodemailer. Поки заглушка: транспорт не створюється.
// Налаштування — env.smtp (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM).
// Для dev зручно Ethereal (https://ethereal.email) або Mailtrap.

/**
 * Надіслати лист.
 * @param {{ to: string, subject: string, html: string, text?: string }} message
 * @returns {Promise<{ messageId: string }>}
 */
export async function sendMail() {
  // TODO(@teammate1): nodemailer.createTransport({ host, port, secure, auth }) + transporter.sendMail
  throw new Error('TODO(@teammate1): mailer.sendMail');
}

/**
 * Лист-запрошення на подію або в календар.
 * @param {{ to: string, inviterName: string, kind: 'event'|'calendar', title: string, acceptUrl: string }} params
 */
export async function sendInviteEmail() {
  // TODO(@teammate1): шаблон на базі design/screens/15-invite.html; посилання = `${env.clientUrl}/invite/${token}`
  throw new Error('TODO(@teammate1): mailer.sendInviteEmail');
}

/**
 * Лист для скидання пароля.
 * @param {{ to: string, resetUrl: string }} params
 */
export async function sendPasswordResetEmail() {
  throw new Error('TODO(@teammate1): mailer.sendPasswordResetEmail');
}
