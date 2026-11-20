CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"msg" text NOT NULL,
	"actor" text DEFAULT 'system' NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"percent" integer NOT NULL,
	"max_uses" integer DEFAULT 100 NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discounts_code_unique" UNIQUE("code"),
	CONSTRAINT "discounts_percent" CHECK ("discounts"."percent" between 1 and 90)
);
--> statement-breakpoint
CREATE TABLE "dns_ips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ip" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"router_entries" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"game" text DEFAULT 'CS2' NOT NULL,
	"mode" text DEFAULT 'retake' NOT NULL,
	"map" text DEFAULT 'de_mirage' NOT NULL,
	"max" integer DEFAULT 10 NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 27015 NOT NULL,
	"rcon_pass_enc" text,
	"vip" boolean DEFAULT false NOT NULL,
	"ac" text DEFAULT '' NOT NULL,
	"tick" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"players" integer DEFAULT 0 NOT NULL,
	"bots" integer DEFAULT 0 NOT NULL,
	"list" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ping" integer,
	"last_query_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gateways" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"item" jsonb NOT NULL,
	"subtotal" bigint NOT NULL,
	"discount_id" uuid,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"amount" bigint NOT NULL,
	"gateway" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"authority" text,
	"ref_id" text,
	"card_pan" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "orders_amount_nonneg" CHECK ("orders"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "routers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"host" text NOT NULL,
	"api_port" integer DEFAULT 443 NOT NULL,
	"api_user" text NOT NULL,
	"api_pass_enc" text NOT NULL,
	"tls_fingerprint" text,
	"wg_interface" text DEFAULT 'wg-doping' NOT NULL,
	"subnet" text NOT NULL,
	"endpoint" text,
	"server_public_key" text,
	"dns_address_list" text DEFAULT 'doping-dns-allowed' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"version" text,
	"model" text,
	"cpu" integer,
	"ram" integer,
	"uptime" text,
	"peers" integer DEFAULT 0 NOT NULL,
	"queues" integer DEFAULT 0 NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"csrf" text NOT NULL,
	"user_id" uuid NOT NULL,
	"ip" text NOT NULL,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"tier_gb" integer,
	"quota_bytes" bigint,
	"used_up" bigint DEFAULT 0 NOT NULL,
	"used_down" bigint DEFAULT 0 NOT NULL,
	"last_seen_up" bigint DEFAULT 0 NOT NULL,
	"last_seen_down" bigint DEFAULT 0 NOT NULL,
	"dns_slots" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"exit" text DEFAULT 'mct' NOT NULL,
	"router_id" uuid,
	"tunnel_ip" text,
	"wg_public_key" text,
	"wg_private_key_enc" text,
	"wg_preshared_key_enc" text,
	"keys_rotated_at" timestamp with time zone,
	"peer_id" text,
	"queue_id" text,
	"provisioned_at" timestamp with time zone,
	"provision_error" text,
	"last_handshake" timestamp with time zone,
	"usage_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"author_id" uuid,
	"staff" boolean DEFAULT false NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"dept" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_daily" (
	"subscription_id" uuid NOT NULL,
	"day" date NOT NULL,
	"up" bigint DEFAULT 0 NOT NULL,
	"down" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_daily_subscription_id_day_pk" PRIMARY KEY("subscription_id","day")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"wallet" bigint DEFAULT 0 NOT NULL,
	"steam_id" text,
	"perks" jsonb DEFAULT '{"slot":true,"tag":true,"skins":false}'::jsonb NOT NULL,
	"disabled_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_wallet_nonneg" CHECK ("users"."wallet" >= 0)
);
--> statement-breakpoint
CREATE TABLE "wallet_tx" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid,
	"amount" bigint NOT NULL,
	"balance" bigint NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dns_ips" ADD CONSTRAINT "dns_ips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_router_id_routers_id_fk" FOREIGN KEY ("router_id") REFERENCES "public"."routers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_tx" ADD CONSTRAINT "wallet_tx_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_tx" ADD CONSTRAINT "wallet_tx_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_at_idx" ON "audit_logs" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "dns_ips_ip_uq" ON "dns_ips" USING btree ("ip");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_authority_uq" ON "orders" USING btree ("gateway","authority");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_ref_uq" ON "orders" USING btree ("gateway","ref_id");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_uq" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_ip_uq" ON "subscriptions" USING btree ("tunnel_ip");--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_idx" ON "ticket_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_user_idx" ON "tickets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_steam_uq" ON "users" USING btree ("steam_id");