import nodemailer from "nodemailer";

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

export async function sendNotificationEmail(params: { subject: string; text: string }): Promise<void> {
  const to = process.env.CONTACT_NOTIFICATION_EMAIL;
  const transport = getTransport();
  if (!transport || !to) return;

  await transport.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject: params.subject,
    text: params.text,
  });
}
