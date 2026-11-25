// Runtime configuration. Everything optional has a safe development default.
const bool = (v: string | undefined, d: boolean) => (v == null || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()));
const int = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

const prod = process.env.NODE_ENV === 'production';

export const env = {
  prod,
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://doping@127.0.0.1:5432/doping',
  /** Public origin, used for payment callbacks and the Origin check. Example: https://doping.games */
  appUrl: (process.env.APP_URL ?? '').replace(/\/$/, ''),
  cookieSecure: bool(process.env.COOKIE_SECURE, prod),
  /** Trust X-Forwarded-For / X-Real-IP (set when the app runs behind a reverse proxy / PaaS router). */
  trustProxy: bool(process.env.TRUST_PROXY, true),
  /** 'live' | 'sandbox' | 'test'. Without a merchant id the gateway always runs in test mode. */
  paymentMode: (process.env.ZARINPAL_MERCHANT_ID ? (process.env.PAYMENT_MODE ?? 'live') : 'test') as 'live' | 'sandbox' | 'test',
  zarinpalMerchant: process.env.ZARINPAL_MERCHANT_ID ?? '',
  adminEmail: process.env.ADMIN_EMAIL ?? '',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  workers: bool(process.env.WORKERS, true),
  quotaIntervalSec: int(process.env.QUOTA_INTERVAL_SEC, 300),
  serverPollSec: int(process.env.SERVER_POLL_SEC, 30),
  /** Allow sign-ups. Turn off to run an invite-only panel. */
  registration: bool(process.env.REGISTRATION, true),

  /** Outgoing mail: smtp://user:pass@host:587 or smtps://user:pass@host:465. Empty = email disabled. */
  smtpUrl: process.env.SMTP_URL ?? '',
  mailFrom: process.env.MAIL_FROM ?? 'Doping <no-reply@doping.games>',
  /** SMS through Kavenegar. Empty key = SMS disabled (phone login and SMS alerts are hidden). */
  kavenegarKey: process.env.KAVENEGAR_API_KEY ?? '',
  kavenegarSender: process.env.KAVENEGAR_SENDER ?? '',
  /** Kavenegar "verify/lookup" template with one %token% for one-time codes (faster delivery than plain sends). */
  kavenegarOtpTemplate: process.env.KAVENEGAR_OTP_TEMPLATE ?? '',
  kavenegarBase: (process.env.KAVENEGAR_API_BASE ?? 'https://api.kavenegar.com').replace(/\/$/, ''),
  /** Telegram bot for alerts. TELEGRAM_API_BASE lets a relay be used where api.telegram.org is unreachable. */
  telegramToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  telegramUsername: (process.env.TELEGRAM_BOT_USERNAME ?? '').replace(/^@/, ''),
  telegramApiBase: (process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org').replace(/\/$/, ''),
  /**
   * Development/testing only: messages that could not be delivered (no SMTP/SMS configured) are stored
   * in full in the outbox so codes and links can be read from Admin → logs. Never enable in production.
   */
  devOutbox: bool(process.env.DEV_OUTBOX, false),
  notifyIntervalSec: int(process.env.NOTIFY_INTERVAL_SEC, 600),
};
