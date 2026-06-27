const nodemailer = require('nodemailer');

async function sendEmail({ to, subject, text, html }) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log(`\n--- EMAIL (SMTP not configured) ---\nTo: ${to}\nSubject: ${subject}\n${text}\n---\n`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"ARGLOVE" <no-reply@arglove.com>',
    to,
    subject,
    text,
    html: html || `<p>${text.replace(/\n/g, '<br>')}</p>`,
  });
  return true;
}

module.exports = { sendEmail };
