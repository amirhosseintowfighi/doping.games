# Doping — doping.games

Persian (RTL) gaming-network platform: a ping-reduction tunnel on MikroTik RouterOS v7 + WireGuard, an anti-sanction DNS with per-account IP whitelisting, and a CS2 game-server hub. One Next.js app serves the site, the gamer panel, the admin console, the API and the background workers; PostgreSQL holds everything.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, server rendering, route handlers), React 19, TypeScript on the server |
| UI | Tailwind CSS 4, lucide icons, self-hosted Vazirmatn via `next/font` |
| Data | PostgreSQL 16, Drizzle ORM + SQL migrations in `drizzle/` (applied automatically on start) |
| Auth | Email/username + password (scrypt), database sessions in an HttpOnly cookie, per-session CSRF token, roles `user` / `support` / `admin` |
| Secrets | AES-256-GCM envelopes with a rotatable key ring (`DOPING_KMS_KEYS`), bound to their row: router API passwords, RCON passwords, WireGuard private + preshared keys |
| Payments | Zarinpal REST v4 (live / sandbox), built-in test gateway when no merchant id is set, wallet, discount codes; idempotent verify |
| Routers | RouterOS v7 REST over HTTPS with certificate fingerprint pinning: WireGuard peers (one per device), one Simple Queue per subscription, firewall address-lists for the DNS whitelist and the chosen exit node |
| Game servers | Valve A2S (UDP) for live players/map/ping, Source RCON (TCP) with a command allow-list, VIP list for SourceMod (`admins_simple.ini`) pulled with a per-server token |
| Accounts | Email verification, password reset by email link, phone verification + SMS one-time-code login, password change, per-device session list and sign-out, referral codes with a wallet reward |
| Messages | In-panel notifications plus email (SMTP), SMS (Kavenegar) and a Telegram bot, each on when configured; every send is logged in an outbox |
| Workers | Quota worker (queue counters → usage, suspends at quota/expiry), A2S poller, alerts (80%/100% quota, 3 days/1 day/expired) + auto-renew from the wallet, Telegram poller, stale-order cleanup; one instance at a time via Postgres advisory locks on a reserved connection |
| Rate limits | Fixed windows in PostgreSQL, shared by every app instance |

## Run locally

```bash
npm install
cp .env.example .env.local      # set DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD (KMS keys optional in dev)
npm run dev                     # http://localhost:3000 — migrations run on start
```

`docker compose up -d --build` runs the production stack (app + PostgreSQL). Deployment guide (Persian): [`docs/deploy.md`](docs/deploy.md).

## Tests

```bash
npm run typecheck
npm test                        # unit tests (node:test): crypto, address pool, quota rules, A2S/RCON parsing, pricing
npm run build && npm start      # then, in another shell:
npm run test:e2e                # browser + API end-to-end against fake RouterOS, CS2, SMTP, SMS and Telegram servers (tests/mocks)
```

For the e2e run, start the app with the mock channels and fast workers (see the header of `tests/e2e.cjs`):
`QUOTA_INTERVAL_SEC=5 SERVER_POLL_SEC=5 NOTIFY_INTERVAL_SEC=5 SMTP_URL=smtp://127.0.0.1:2525 KAVENEGAR_API_KEY=test KAVENEGAR_API_BASE=http://127.0.0.1:2526 TELEGRAM_BOT_TOKEN=1:test TELEGRAM_BOT_USERNAME=doping_test_bot TELEGRAM_API_BASE=http://127.0.0.1:2527`, and pass the same `DATABASE_URL` to the suite to include the auto-renew check.

The end-to-end suite signs up and verifies the email, buys a plan through the test gateway, adds a router in the admin and syncs it, checks that peers/queues/address-list entries appear on the (fake) router, pushes traffic past the quota and waits for the worker to suspend the peer, tops up the wallet, buys extra traffic, resets keys, opens and answers a ticket, adds a game server and reads it over A2S, runs RCON commands, links Telegram, adds devices and switches the exit node (checking peers, the shared queue and exit address-lists on the fake router), attaches files to tickets, pulls the VIP list, exports sales, signs a friend up with a referral link, verifies a phone and signs in by SMS code, resets a password by email, runs auto-renew, and checks CSRF, Origin, role and price-tampering protections.

## Layout

| Path | What it is |
| --- | --- |
| `app/` | Pages (`/`, `/login`, `/register`, `/panel`, `/admin`, `/pay/*`) and API route handlers under `app/api/` |
| `lib/server/schema.ts` | Database schema (Drizzle) |
| `lib/server/auth.ts`, `http.ts`, `rateLimit.ts` | Sessions, CSRF, roles, Origin check, rate limits, JSON errors |
| `lib/server/orders.ts`, `zarinpal.ts` | Quotes, checkout, gateway callback, fulfilment |
| `lib/server/vpn.ts`, `mikrotik.ts` | Plans → subscriptions, tunnel addresses, provisioning, key rotation, configs, DNS whitelist, quota worker |
| `lib/server/gameq.ts`, `vip.ts` | A2S queries, A2S poller, RCON client, SourceMod VIP list |
| `lib/server/messaging.ts`, `notify.ts`, `tokens.ts` | Email / SMS / Telegram senders and outbox, notifications + alert worker + auto-renew + Telegram bot, one-time links and codes |
| `lib/server/attachments.ts` | Ticket attachments (type sniffed from the bytes, 3 × 2 MB) |
| `lib/server/site.ts` | Site content (texts, games, prices, FAQ…) stored as one validated JSON row, edited in Admin → تنظیمات سایت |
| `lib/server/boot.ts`, `instrumentation.ts` | Migrations, first admin, background jobs |
| `src/views/` | Client views: storefront, gamer panel, admin console, site settings editor |
| `drizzle/` | SQL migrations |
| `tests/` | Unit tests, e2e suite, RouterOS and game-server mocks |
