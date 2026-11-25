// Outgoing messages: email (SMTP), SMS (Kavenegar) and Telegram. Every attempt lands in the outbox
// table. Bodies are redacted there (codes and links removed) unless DEV_OUTBOX is on for testing.
import nodemailer, { type Transporter } from 'nodemailer';
import { db, schema } from './db';
import { env } from './env';

type Channel = 'email' | 'sms' | 'telegram';

export const channels = {
  email: () => !!env.smtpUrl,
  sms: () => !!env.kavenegarKey,
  telegram: () => !!env.telegramToken && !!env.telegramUsername,
};

const redact = (s: string) => s.replace(/(token|code|start)=[^\s&"]+/gi, '$1=…').replace(/\b\d{5,6}\b/g, '••••••');

async function record(channel: Channel, to: string, subject: string, body: string, status: 'sent' | 'failed' | 'skipped', error?: string) {
  try {
    await db.insert(schema.outbox).values({
      channel, to: channel === 'telegram' ? to : to.slice(0, 120), subject: subject.slice(0, 200),
      body: (env.devOutbox ? body : redact(body)).slice(0, 4000), status, error: error?.slice(0, 300) ?? null,
    });
  } catch (err) {
    console.error('[outbox] write failed', err);
  }
  if (status === 'skipped' && !env.prod) console.log(`[outbox:${channel}] → ${to} · ${subject}\n${body}`);
}

async function attempt(channel: Channel, to: string, subject: string, body: string, send: () => Promise<void>): Promise<boolean> {
  if (!channels[channel]()) {
    await record(channel, to, subject, body, 'skipped', 'channel not configured');
    return false;
  }
  try {
    await send();
    await record(channel, to, subject, body, 'sent');
    return true;
  } catch (err) {
    await record(channel, to, subject, body, 'failed', (err as Error).message);
    return false;
  }
}

/* ───────── email ───────── */

let transport: Transporter | null = null;
const mailer = () => (transport ??= nodemailer.createTransport({ url: env.smtpUrl, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 }));

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Plain RTL email. `link` adds a button. */
export function sendEmail(to: string, subject: string, text: string, link?: { url: string; label: string }) {
  const full = link ? `${text}\n\n${link.label}: ${link.url}` : text;
  const html = `<!doctype html><html dir="rtl" lang="fa"><body style="font-family:Tahoma,sans-serif;background:#0b0b0f;color:#eee;padding:24px">
<div style="max-width:520px;margin:auto;background:#15151b;border-radius:16px;padding:24px;line-height:2">
<h2 style="margin:0 0 12px;color:#fff">${esc(subject)}</h2>
<p style="white-space:pre-line;margin:0">${esc(text)}</p>
${link ? `<p style="margin:20px 0 0"><a href="${esc(link.url)}" style="background:#E60012;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;display:inline-block">${esc(link.label)}</a></p><p style="font-size:12px;color:#888;direction:ltr;text-align:left;word-break:break-all">${esc(link.url)}</p>` : ''}
<p style="font-size:12px;color:#777;margin-top:24px">دوپینگ · doping.games</p></div></body></html>`;
  return attempt('email', to, subject, full, async () => {
    await mailer().sendMail({ from: env.mailFrom, to, subject, text: full, html });
  });
}

/* ───────── SMS (Kavenegar) ───────── */

async function kavenegar(path: string, params: Record<string, string>) {
  const url = `${env.kavenegarBase}/v1/${encodeURIComponent(env.kavenegarKey)}/${path}`;
  const res = await fetch(url, { method: 'POST', body: new URLSearchParams(params), signal: AbortSignal.timeout(10_000) });
  const j = (await res.json().catch(() => null)) as { return?: { status: number; message: string } } | null;
  if (!res.ok || j?.return?.status !== 200) throw new Error(`kavenegar ${j?.return?.status ?? res.status}: ${j?.return?.message ?? res.statusText}`);
}

export function sendSms(phone: string, text: string) {
  return attempt('sms', phone, 'sms', text, () => kavenegar('sms/send.json', { receptor: phone, message: text, ...(env.kavenegarSender ? { sender: env.kavenegarSender } : {}) }));
}

/** One-time code. Uses the lookup template when configured (OTP route, not blocked by ad filters). */
export function sendOtpSms(phone: string, code: string) {
  const text = `کد تایید دوپینگ: ${code}\nاین کد رو به کسی نده.`;
  if (!env.kavenegarOtpTemplate) return sendSms(phone, text);
  return attempt('sms', phone, 'otp', text, () => kavenegar('verify/lookup.json', { receptor: phone, token: code, template: env.kavenegarOtpTemplate }));
}

/* ───────── Telegram ───────── */

export async function telegramApi<T = unknown>(method: string, payload: Record<string, unknown>, timeoutMs = 10_000): Promise<T> {
  const res = await fetch(`${env.telegramApiBase}/bot${env.telegramToken}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs),
  });
  const j = (await res.json().catch(() => null)) as { ok: boolean; result: T; description?: string } | null;
  if (!j?.ok) throw new Error(`telegram ${method}: ${j?.description ?? res.status}`);
  return j.result;
}

export function sendTelegram(chatId: string, text: string) {
  return attempt('telegram', chatId, 'telegram', text, async () => { await telegramApi('sendMessage', { chat_id: chatId, text }); });
}
