DROP INDEX "dns_ips_ip_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "dns_ips_user_ip_uq" ON "dns_ips" USING btree ("user_id","ip");