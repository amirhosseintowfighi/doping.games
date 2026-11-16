-- db/schema.sql — PostgreSQL 16
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE,
  password_hash text   NOT NULL,                       -- scrypt$N$salt$hash
  role          text   NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'SUPER_ADMIN')),
  steam_id64    text   UNIQUE CHECK (steam_id64 ~ '^7656119[0-9]{10}$'),
  wallet_rial   bigint NOT NULL DEFAULT 0 CHECK (wallet_rial >= 0),
  disabled_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,                        -- sha256 of the cookie value
  csrf_hash   text NOT NULL,
  user_id     uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  ip          inet NOT NULL,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE routers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL UNIQUE,
  role               text NOT NULL CHECK (role IN ('entry', 'exit')),
  host               inet NOT NULL,
  api_port           int  NOT NULL DEFAULT 8443,
  api_user           text NOT NULL,
  api_pass_enc       text NOT NULL,                    -- AES-256-GCM envelope
  tls_cert_pem       text NOT NULL,
  tls_fingerprint256 text NOT NULL,
  wg_interface       text NOT NULL DEFAULT 'wg-doping',
  subnet             cidr NOT NULL,                    -- e.g. 10.10.10.0/24
  dns_address_list   text NOT NULL DEFAULT 'doping-dns-allowed',
  enabled            boolean NOT NULL DEFAULT true,
  last_sync_at       timestamptz,
  last_sync_error    text
);

CREATE TABLE plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL CHECK (kind IN ('ping', 'dns', 'pro')),
  quota_gb      int,                                   -- NULL = unlimited
  days          int  NOT NULL,
  dns_slots     int  NOT NULL DEFAULT 0,
  cs2_vip       boolean NOT NULL DEFAULT false,
  price_rial    bigint NOT NULL CHECK (price_rial > 0),
  active        boolean NOT NULL DEFAULT true
);

CREATE TABLE subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users,
  plan_id              uuid NOT NULL REFERENCES plans,
  router_id            uuid NOT NULL REFERENCES routers,
  dns_router_id        uuid REFERENCES routers,
  tunnel_ip            inet,
  wg_public_key        text,
  wg_private_key_enc   text,                           -- AES-256-GCM envelope
  wg_preshared_key_enc text,
  wg_peer_id           text,                           -- RouterOS .id, e.g. *1A
  queue_id             text,
  quota_bytes          bigint,                         -- NULL = unlimited
  used_up              bigint NOT NULL DEFAULT 0,
  used_down            bigint NOT NULL DEFAULT 0,
  last_seen_up         bigint NOT NULL DEFAULT 0,      -- router counter at the previous poll
  last_seen_down       bigint NOT NULL DEFAULT 0,
  usage_synced_at      timestamptz,
  expires_at           timestamptz NOT NULL,
  status               text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'active', 'quota_exceeded', 'expired', 'disabled')),
  UNIQUE (router_id, tunnel_ip)
);
CREATE INDEX subscriptions_poll_idx ON subscriptions (router_id) WHERE status = 'active';

CREATE TABLE dns_whitelist (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  ip              inet NOT NULL,
  label           text,
  router_entry_id text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ip)
);

CREATE TABLE payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users,
  subscription_id uuid NOT NULL REFERENCES subscriptions,
  gateway         text NOT NULL CHECK (gateway IN ('zarinpal', 'nextpay', 'tron_usdt', 'wallet')),
  authority       text NOT NULL,                       -- gateway-side payment id
  ref_id          text,
  gateway_code    int,
  amount_rial     bigint NOT NULL CHECK (amount_rial > 0),
  kind            text NOT NULL CHECK (kind IN ('renewal', 'topup')),
  quota_gb        int,
  days            int NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  settled_at      timestamptz,
  UNIQUE (gateway, authority),                         -- one row per gateway payment
  UNIQUE (gateway, ref_id)                             -- one bank transaction settles one invoice
);

CREATE TABLE audit_logs (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at        timestamptz NOT NULL DEFAULT now(),
  category  text NOT NULL,
  level     text NOT NULL,
  action    text NOT NULL,
  actor_id  uuid,
  ip        inet,
  detail    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX audit_logs_at_idx ON audit_logs (at DESC);
-- The application role may only append: no UPDATE, no DELETE on the audit trail.
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
