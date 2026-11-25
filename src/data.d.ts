// Types for the parts of data.js the server uses.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const GB: number;
export function fa(n: number): string;
export function tierLabel(t: number | 'inf' | null): string;
export function isIPv4(s: string): boolean;
export function isPrivate(s: string): boolean;
export function pingTiers(pricing: any): Array<number | 'inf'>;
export function dnsSlots(pricing: any): number[];
export function durations(pricing: any): Array<{ id: string; months: number; off: number }>;
export function priceOf(pricing: any, o: { kind: string; tier?: number | 'inf' | null; slots?: number; months: number }): { monthly: number; gross: number; off: number; total: number };
export type SiteContent = {
  accent: string; footer: string; motion: boolean;
  kinds: Record<'ping' | 'dns' | 'pro', boolean>;
  planNames: Record<'ping' | 'dns' | 'pro', string>;
  pricing: { extraPerGb: number; proMul: number; [k: string]: any };
  dns: { primary: string; secondary: string };
  wg: { endpoint: string; serverKey: string; allowed: string; mtu: number };
  [k: string]: any;
};
export function seedSite(): SiteContent;
export function validateSite(c: any): Record<string, string>;
export function migrateSite(saved: any, base: SiteContent, guess: (name: string) => string): SiteContent;
export const EXITS: Array<{ id: string; name: string; country: string; code: string }>;
export function faDate(t: number): string;
