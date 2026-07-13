import nodemailer from "nodemailer";

/**
 * Thin, generic SMTP layer. Nothing in here knows about leads, contact
 * messages, or any other domain concept — callers build their own
 * subject/text/html and pass them to `sendEmail`. Kept deliberately
 * fail-soft: with no SMTP_HOST configured, `sendEmail` logs a warning and
 * returns instead of throwing, so every caller gets "missing config" and
 * "SMTP is down" for free without special-casing either.
 */

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT) || 587;
  return {
    host,
    port,
    // Port 465 is implicit TLS; everything else (587, 25, ...) uses
    // STARTTLS, which nodemailer negotiates itself when `secure` is false.
    secure: port === 465,
    user: process.env.SMTP_USER?.trim() || undefined,
    pass: process.env.SMTP_PASS,
  };
}

function getSenderAddress(): string | undefined {
  return process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || undefined;
}

// Never logs the value being checked — only whether SMTP looks configured —
// so callers can decide whether to attempt a send without risking a stray
// console.log of host/user/pass somewhere down the line.
export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}

function createSmtpTransport() {
  const config = getSmtpConfig();
  if (!config) return null;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
}

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends one email. Resolves silently (no-op) when SMTP isn't configured;
 * rejects if SMTP *is* configured but the actual send fails — callers that
 * need "a failure here must never break the caller's own success response"
 * (e.g. lead notifications) are responsible for wrapping their own call in
 * try/catch, deliberately, so one email's failure can never suppress an
 * unrelated one. See lead-notification.service.ts.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const transport = createSmtpTransport();
  if (!transport) {
    console.warn(`[email] SMTP not configured — skipping send (subject: "${params.subject}")`);
    return;
  }

  await transport.sendMail({
    from: getSenderAddress(),
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

/** Escapes the five HTML-significant characters. Use for any user-controlled
 * (or externally-sourced, e.g. CarStock feed) string before it's interpolated
 * into an HTML email body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Used by /api/contact — unchanged signature/behavior, reimplemented on top
 * of sendEmail() for one shared transport/config path. */
export async function sendNotificationEmail(params: { subject: string; text: string }): Promise<void> {
  const to = process.env.CONTACT_NOTIFICATION_EMAIL?.trim();
  if (!to) return;
  await sendEmail({ to, subject: params.subject, text: params.text });
}
