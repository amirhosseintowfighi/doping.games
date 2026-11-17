# Doping — doping.games

Persian (RTL) gaming-network platform: ping-reduction tunnel on MikroTik RouterOS v7, anti-sanction DNS with IP whitelisting, and a CS2 game-server hub.

## Run

```bash
npm install
npm run dev                 # http://localhost:5173
npm run build               # production build in dist/
SINGLE=1 npm run build      # one self-contained dist/index.html
npm run typecheck:backend   # tsc --strict over backend/
npm test                    # builds, then runs the browser end-to-end test (needs Playwright + Chromium)
```

## Layout

| Path | What it is |
| --- | --- |
| `src/Logo.jsx` | `<DopingLogo />` inline SVG (full lockup or `variant="mark"`) |
| `src/art.jsx` | Vector pieces: original `GameCover` artwork, `Ring` quota gauge, `RouteMap` cluster diagram, `ModeEmblem`, `ArcMeter` |
| `src/index.css`, `src/ui.jsx` | Design system: near-black, flat bordered cards, one accent (crimson) for the primary action only |
| `src/views/Storefront.jsx` | Hero + ping simulator, live game-server hub, plan builder + checkout |
| `src/views/UserPanel.jsx` | Quota telemetry, WireGuard config/QR/key reset, DNS whitelist, Steam VIP, wallet, tickets |
| `src/views/Admin.jsx` | Router cluster + sync, users/quota table, game servers + RCON console, pricing/discounts/gateways, audit log |
| `src/covers.js`, `src/assets/covers/` | Official game artwork (400×600 WebP), cover lookup, and the in-browser resize used for uploaded covers |
| `src/motion.jsx` | Motion layer: scroll / pointer parallax (`data-depth` layers), 3D cover tilt, cursor spotlight on cards, count-up numbers, scroll progress, back-to-top. Off for `prefers-reduced-motion` and when «افکت‌های حرکتی» is off in settings |
| `src/views/Settings.jsx` | Admin → «تنظیمات سایت»: edit hero text, stats, sections, covered games, FAQ, plan features, DNS / WireGuard values, brand colour, footer |
| `src/views/Blueprint.jsx` | Architecture tab; renders the real files from `backend/` |
| `src/store.jsx`, `src/data.js` | In-browser simulation layer (seed data, live tick, quota enforcement) |
| `backend/` | Next.js App Router backend sources: MikroTik REST service, quota worker, AES-256-GCM, rate limit, RBAC/CSRF guard, Zod schemas, idempotent Zarinpal callback, PostgreSQL schema, RouterOS baseline script |

## What is simulated

Site settings are saved in the browser's `localStorage` (key `doping.site.v1`), so they persist per device, not per account.

The UI runs entirely on the simulation layer in `src/store.jsx`: no router, payment gateway or game server is contacted.
Public IPs in `src/data.js` are documentation ranges (RFC 5737) and hostnames are placeholders; replace them with real nodes.

The `backend/` code type-checks under `tsc --strict` but has not been run against a live RouterOS device, PostgreSQL, Redis or Zarinpal.
To go live it needs a Next.js app around it (`@/` alias → `backend/`), `DATABASE_URL`, `REDIS_URL`, `APP_ORIGIN`,
`ZARINPAL_MERCHANT_ID`, `DOPING_KMS_KEYS` / `DOPING_KMS_ACTIVE`, and the frontend wired to the API routes in place of the store.

## Game artwork

The covers in `src/assets/covers/` belong to their publishers and are used only to show which games the service supports.

- Steam library capsules (Valve, EA, Activision, Electronic Arts / Respawn, KRAFTON, Facepunch): Counter-Strike 2, Dota 2, EA SPORTS FC 26, Call of Duty: Warzone, Apex Legends, PUBG: BATTLEGROUNDS, Rust.
- VALORANT, Fortnite and Minecraft are not on Steam; their tiles are the official logos (via Wikimedia Commons) on a dark background.

Check each publisher's brand and fan-content guidelines before production use. Covers can be replaced per game from Admin → «تنظیمات سایت».
