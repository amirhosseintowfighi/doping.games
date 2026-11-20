import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/server/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://doping@127.0.0.1:5432/doping' },
});
