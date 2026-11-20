// Site content (texts, sections, games, pricing, FAQ, DNS/WireGuard defaults) lives in one JSONB row.
// The same validator the admin editor uses in the browser runs here before anything is stored.
import { eq, sql as dsql } from 'drizzle-orm';
import { guessCover } from '@/src/covers.js';
import { migrateSite, seedSite, validateSite } from '@/src/data.js';
import { db, schema } from './db';
import { fail } from './http';

export type Site = ReturnType<typeof seedSite>;

let cached: { at: number; site: Site } | null = null;

export async function getSite(): Promise<Site> {
  if (cached && Date.now() - cached.at < 5_000) return cached.site;
  const row = (await db.select().from(schema.siteSettings).where(eq(schema.siteSettings.id, 1)).limit(1))[0];
  const base = seedSite();
  let site: Site = base;
  if (row) {
    const merged = migrateSite(row.data, base, guessCover) as Site;
    site = Object.keys(validateSite(merged)).length ? base : merged;
  }
  cached = { at: Date.now(), site };
  return site;
}

const MAX_BYTES = 6 * 1024 * 1024; // uploaded covers are data URLs; keep the row a sane size

export async function saveSite(input: unknown, actor: string): Promise<Site> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(422, 'ساختار تنظیمات نامعتبره.');
  const site = migrateSite(input, seedSite(), guessCover) as Site;
  const errors = validateSite(site) as Record<string, string>;
  if (Object.keys(errors).length) fail(422, Object.values(errors)[0]!, errors);
  const size = Buffer.byteLength(JSON.stringify(site));
  if (size > MAX_BYTES) fail(413, 'حجم تنظیمات (بیشتر به‌خاطر تصویرهای آپلودی) خیلی زیاده.');
  await db.insert(schema.siteSettings).values({ id: 1, data: site, updatedBy: actor })
    .onConflictDoUpdate({ target: schema.siteSettings.id, set: { data: site, updatedBy: actor, updatedAt: new Date(), version: dsql`${schema.siteSettings.version} + 1` } });
  cached = null;
  return site;
}

export async function ensureSite() {
  await db.insert(schema.siteSettings).values({ id: 1, data: seedSite() }).onConflictDoNothing();
}
