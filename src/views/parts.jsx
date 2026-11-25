'use client';
// Small pieces shared by the gamer panel and the admin console.
import { useRef } from 'react';
import { FileText, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import { cx, Mono } from '../ui.jsx';
import { fa } from '../data.js';

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf,text/plain,.txt,.log';

const readAsBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

export const kb = (n) => (n < 1024 * 1024 ? `${fa(Math.max(1, Math.round(n / 1024)))} KB` : `${fa(Number((n / 1024 / 1024).toFixed(1)))} MB`);

/** Picks up to 3 files (2 MB each) and hands them over as { name, size, data(base64) }. */
export function FilePicker({ files, onChange, onError, id = 'file-pick', compact = false }) {
  const ref = useRef(null);
  const add = async (list) => {
    const next = [...files];
    for (const f of list) {
      if (next.length >= MAX_FILES) { onError?.(`حداکثر ${fa(MAX_FILES)} فایل.`); break; }
      if (f.size > MAX_FILE_BYTES) { onError?.(`${f.name} از ۲ مگابایت بزرگ‌تره.`); continue; }
      next.push({ name: f.name, size: f.size, data: await readAsBase64(f) });
    }
    onChange(next);
    if (ref.current) ref.current.value = '';
  };
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <input ref={ref} id={id} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => add([...e.target.files])} />
      <label htmlFor={id} title="پیوست عکس، PDF یا لاگ متنی (حداکثر ۳ فایل، هر کدوم ۲ مگابایت)" className={cx('flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-line text-xs text-silver hover:bg-white/[0.05] hover:text-white', compact ? 'size-10 justify-center' : 'h-9 px-3')}>
        <Paperclip className="size-4" />{!compact && 'پیوست'}
      </label>
      {files.map((f, i) => (
        <span key={`${f.name}-${i}`} className="flex max-w-44 items-center gap-1 rounded-lg bg-white/[0.06] py-1 ps-2 pe-1 text-[11px]">
          <span className="truncate" dir="auto">{f.name}</span>
          <button type="button" aria-label={`حذف ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))} className="grid size-5 place-items-center rounded hover:bg-white/10"><X className="size-3" /></button>
        </span>
      ))}
    </div>
  );
}

/** Attachment chips under a ticket message; images get a small preview. */
export function Attachments({ files }) {
  if (!files?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map((f) => (
        <a key={f.id} href={`/api/attachments/${f.id}`} className="flex max-w-56 items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-1.5 pe-3 text-[11px] hover:bg-white/[0.06]" title={f.name}>
          {f.mime.startsWith('image/')
            ? <img src={`/api/attachments/${f.id}?inline=1`} alt="" loading="lazy" className="size-9 rounded-lg object-cover" />
            : <span className="grid size-9 place-items-center rounded-lg bg-white/[0.06]">{f.mime === 'application/pdf' ? <FileText className="size-4" /> : <ImageIcon className="size-4" />}</span>}
          <span className="min-w-0">
            <span className="block truncate font-bold" dir="auto">{f.name}</span>
            <Mono className="text-zinc-500">{kb(f.size)}</Mono>
          </span>
        </a>
      ))}
    </div>
  );
}

/** Daily bars (e.g. revenue). `rows`: [{ key, label, value, title }]. */
export function Bars({ rows, height = 'h-32', tone = 'bg-brand', onPick, picked }) {
  const max = Math.max(1, ...rows.map((r) => r.value)) * 1.08;
  return (
    <div className={cx('flex items-end gap-0.5 sm:gap-1', height)} dir="ltr">
      {rows.map((r) => (
        <button
          key={r.key} type="button" title={r.title} aria-label={r.title} onClick={() => onPick?.(r.key)} onMouseEnter={() => onPick?.(r.key)}
          className="group flex h-full min-w-0 flex-1 flex-col justify-end"
        >
          <span className={cx('w-full rounded-t transition-opacity', tone, picked === r.key ? 'opacity-100' : 'opacity-60 group-hover:opacity-90')} style={{ height: `${Math.max(r.value ? 2 : 0, (r.value / max) * 100)}%` }} />
        </button>
      ))}
    </div>
  );
}
