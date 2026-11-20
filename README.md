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
| Routers | RouterOS v7 REST over HTTPS with certificate fingerprint pinning: WireGuard peers, Simple Queues, firewall address-lists |
| Game servers | Valve A2S (UDP) for live players/map/ping, Source RCON (TCP) with a command allow-list |
| Workers | Quota worker (queue counters → usage, suspends at quota/expiry), A2S poller, stale-order cleanup; one instance at a time via a Postgres advisory lock |

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
npm run test:e2e                # browser + API end-to-end against fake RouterOS and CS2 servers (tests/mocks)
```

The end-to-end suite (72 checks) signs up, buys a plan through the test gateway, adds a router in the admin and syncs it, checks that peers/queues/address-list entries appear on the (fake) router, pushes traffic past the quota and waits for the worker to suspend the peer, tops up the wallet, buys extra traffic, resets keys, opens and answers a ticket, adds a game server and reads it over A2S, runs RCON commands, and checks CSRF, Origin, role and price-tampering protections.

## Layout

| Path | What it is |
| --- | --- |
| `app/` | Pages (`/`, `/login`, `/register`, `/panel`, `/admin`, `/pay/*`) and API route handlers under `app/api/` |
| `lib/server/schema.ts` | Database schema (Drizzle) |
| `lib/server/auth.ts`, `http.ts`, `rateLimit.ts` | Sessions, CSRF, roles, Origin check, rate limits, JSON errors |
| `lib/server/orders.ts`, `zarinpal.ts` | Quotes, checkout, gateway callback, fulfilment |
| `lib/server/vpn.ts`, `mikrotik.ts` | Plans → subscriptions, tunnel addresses, provisioning, key rotation, configs, DNS whitelist, quota worker |
| `lib/server/gameq.ts` | A2S queries, A2S poller, RCON client |
| `lib/server/site.ts` | Site content (texts, games, prices, FAQ…) stored as one validated JSON row, edited in Admin → تنظیمات سایت |
| `lib/server/boot.ts`, `instrumentation.ts` | Migrations, first admin, background jobs |
| `src/views/` | Client views: storefront, gamer panel, admin console, site settings editor |
| `drizzle/` | SQL migrations |
| `tests/` | Unit tests, e2e suite, RouterOS and game-server mocks |
