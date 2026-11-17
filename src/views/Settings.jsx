import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { COVERS, coverSrc, fileToCover, guessCover } from '../covers.js';
import { useStore } from '../store.jsx';
import { Btn, Card, cx, Field, Mono, Toggle } from '../ui.jsx';
import { fa, seedSite, uid, validateSite } from '../data.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
/** Immutable write at a dotted path, e.g. set(cfg, 'games.2.isp', 140). */
function setAt(obj, path, value) {
  const keys = path.split('.');
  const root = Array.isArray(obj) ? [...obj] : { ...obj };
  let node = root;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) node[k] = value;
    else {
      node[k] = Array.isArray(node[k]) ? [...node[k]] : { ...node[k] };
      node = node[k];
    }
  });
  return root;
}
const getAt = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

const SECTIONS = [
  ['games', 'بازی‌های تحت پوشش'], ['calculator', 'محاسبه‌گر حجم'], ['servers', 'سرورهای بازی'], ['pricing', 'پلن‌ها'], ['faq', 'پرسش‌های پرتکرار'], ['cta', 'بخش پایانی'],
];
const PLAN = [['ping', 'کاهش پینگ'], ['dns', 'DNS ضد تحریم'], ['pro', 'پکیج پرو']];

function Block({ title, desc, children, action }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-black">{title}</h3>
          {desc && <p className="mt-1 text-xs text-zinc-500">{desc}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export default function Settings() {
  const { s, set, toast, log } = useStore();
  const [draft, setDraft] = useState(() => clone(s.site));
  const [tried, setTried] = useState(false);
  const errors = useMemo(() => validateSite(draft), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(s.site);
  const bad = Object.keys(errors).length;

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const up = (path, value) => setDraft((d) => setAt(d, path, value));
  const err = (path) => (tried ? errors[path] : undefined);
  const move = (key, i, dir) => setDraft((d) => {
    const list = [...d[key]];
    const j = i + dir;
    if (j < 0 || j >= list.length) return d;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...d, [key]: list };
  });
  const remove = (key, i) => setDraft((d) => ({ ...d, [key]: d[key].filter((_, k) => k !== i) }));
  const add = (key, row) => setDraft((d) => ({ ...d, [key]: [...d[key], row] }));

  /** Text input bound to a path in the draft. */
  const In = ({ path, label, mono, area, num, hint, className, placeholder }) => {
    const id = `set-${path.replace(/\./g, '-')}`;
    const common = {
      id, placeholder, value: getAt(draft, path) ?? '', 'aria-invalid': !!err(path),
      onChange: (e) => up(path, num ? Number(e.target.value.replace(/\D/g, '')) || 0 : e.target.value),
      className: cx('field', mono && 'mono text-left', area && 'resize-y leading-7', err(path) && 'border-red-500'),
      dir: mono ? 'ltr' : undefined,
    };
    const control = area ? <textarea rows={area} {...common} /> : <input inputMode={num ? 'numeric' : undefined} {...common} />;
    return label ? <Field label={label} hint={hint} error={err(path)} className={className}>{control}</Field> : <div className={cx('min-w-0', className)}>{control}{err(path) && <span className="mt-1 block text-xs text-red-400">{err(path)}</span>}</div>;
  };
  const RowTools = ({ list, i }) => (
    <div className="flex shrink-0 gap-1">
      <Btn size="sm" variant="ghost" icon={ArrowUp} aria-label="بالا" disabled={i === 0} onClick={() => move(list, i, -1)} />
      <Btn size="sm" variant="ghost" icon={ArrowDown} aria-label="پایین" disabled={i === draft[list].length - 1} onClick={() => move(list, i, 1)} />
      <Btn size="sm" variant="danger" icon={Trash2} aria-label="حذف" onClick={() => remove(list, i)} />
    </div>
  );

  const save = () => {
    setTried(true);
    if (bad) return toast(`${fa(bad)} فیلد ایراد داره؛ قرمزها رو درست کن.`, 'bad');
    const next = clone(draft);
    next.feats = Object.fromEntries(Object.entries(next.feats).map(([k, v]) => [k, v.map((x) => x.trim()).filter(Boolean)]));
    set({ site: next });
    setDraft(next);
    setTried(false);
    log('admin', 'info', 'site.settings.update · تنظیمات سایت ذخیره شد');
    toast('تنظیمات ذخیره شد و روی سایت اعمال شد.');
  };

  return (
    <div className="flex flex-col gap-4 pb-24">
      <p className="text-sm text-zinc-400">هر چیزی که کاربر روی سایت می‌بینه از اینجا عوض می‌شه. تغییرها بعد از «ذخیره» اعمال می‌شن و روی همین دستگاه می‌مونن.</p>

      <Block title="بالای صفحه اصلی" desc="تیتر سه تکه است؛ تکه وسط با رنگ برند نمایش داده می‌شه.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {In({ path: 'hero.line1', label: 'خط اول تیتر' })}
          {In({ path: 'hero.accent', label: 'کلمه رنگی' })}
          {In({ path: 'hero.line2', label: 'ادامه تیتر' })}
          {In({ path: 'hero.desc', label: 'توضیح زیر تیتر', area: 2, className: 'sm:col-span-3' })}
          {In({ path: 'hero.cta1', label: 'متن دکمه اصلی' })}
          {In({ path: 'hero.cta2', label: 'متن دکمه دوم' })}
        </div>
      </Block>

      <Block
        title="ردیف آمار" desc="برای عدد زنده به‌جای مقدار بنویس {nodes} (تعداد نودها) یا {online} (بازیکن‌های آنلاین)."
        action={<Btn size="sm" variant="ghost" icon={Plus} disabled={draft.stats.length >= 4} onClick={() => add('stats', { value: '', label: '' })}>آمار جدید</Btn>}
      >
        <div className="flex flex-col gap-2">
          {draft.stats.map((_, i) => (
            <div key={i} className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-start gap-2">
              {In({ path: `stats.${i}.value`, mono: true, placeholder: '28ms' })}
              {In({ path: `stats.${i}.label`, placeholder: 'عنوان' })}
              <RowTools list="stats" i={i} />
            </div>
          ))}
          {!draft.stats.length && <p className="text-xs text-zinc-500">ردیف آمار نمایش داده نمی‌شه.</p>}
        </div>
      </Block>

      <Block title="بخش‌های صفحه" desc="هر بخش رو می‌تونی خاموش کنی یا تیتر و توضیحش رو عوض کنی.">
        <div className="flex flex-col divide-y divide-line">
          {SECTIONS.map(([key, name]) => (
            <div key={key} className="grid grid-cols-1 gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[9rem_1fr]">
              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:justify-start">
                <span className="text-sm font-bold">{name}</span>
                <Toggle checked={draft.show[key]} onChange={(v) => up(`show.${key}`, v)} label={`نمایش ${name}`} />
              </div>
              <div className={cx('grid grid-cols-1 gap-2 sm:grid-cols-2', !draft.show[key] && 'opacity-40')}>
                {key !== 'cta' && In({ path: `text.${key}.label`, placeholder: 'برچسب کوچک' })}
                {In({ path: `text.${key}.title`, placeholder: 'تیتر' })}
                {In({ path: `text.${key}.desc`, placeholder: 'توضیح', className: 'sm:col-span-2' })}
              </div>
            </div>
          ))}
        </div>
      </Block>

      <Block
        title="بازی‌های تحت پوشش" desc="کاور، پینگ قبل (اینترنت معمولی) و بعد (با دوپینگ)، و مصرف تقریبی در ساعت برای محاسبه‌گر حجم."
        action={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => add('games', { id: uid(), name: '', isp: 120, dp: 30, mb: 100, cover: '' })}>بازی جدید</Btn>}
      >
        <div className="flex flex-col gap-3">
          {draft.games.map((g, i) => {
            const src = coverSrc(g.cover);
            return (
              <div key={g.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-line bg-raise">
                  {src ? <img src={src} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-[10px] text-zinc-600">بدون کاور</span>}
                </div>
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_4.5rem]">
                  <div className="col-span-2 sm:col-span-1">{In({ path: `games.${i}.name`, mono: true, placeholder: 'Game name' })}</div>
                  <label className="min-w-0"><span className="mb-1 block text-[11px] text-zinc-500">قبل (ms)</span>{In({ path: `games.${i}.isp`, mono: true, num: true })}</label>
                  <label className="min-w-0"><span className="mb-1 block text-[11px] text-zinc-500">بعد (ms)</span>{In({ path: `games.${i}.dp`, mono: true, num: true })}</label>
                  <label className="min-w-0"><span className="mb-1 block text-[11px] text-zinc-500">MB/ساعت</span>{In({ path: `games.${i}.mb`, mono: true, num: true })}</label>
                  <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-4">
                    <select
                      id={`set-games-${i}-cover`} aria-label="کاور" className="field w-auto py-1.5 text-xs"
                      value={g.cover?.startsWith('data:') ? 'upload' : g.cover ?? ''}
                      onChange={(e) => e.target.value !== 'upload' && up(`games.${i}.cover`, e.target.value)}
                    >
                      <option value="">بدون کاور (طرح خطی)</option>
                      {Object.entries(COVERS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                      {g.cover?.startsWith('data:') && <option value="upload">تصویر آپلودشده</option>}
                    </select>
                    <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-xs font-bold hover:bg-white/[0.11]">
                      <ImagePlus className="size-3.5" /> آپلود کاور
                      <input
                        id={`set-games-${i}-file`} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f) return;
                          try { up(`games.${i}.cover`, await fileToCover(f)); } catch (x) { toast(x.message, 'bad'); }
                        }}
                      />
                    </label>
                    {!g.cover && guessCover(g.name) && <Btn size="sm" variant="ghost" onClick={() => up(`games.${i}.cover`, guessCover(g.name))}>کاور {COVERS[guessCover(g.name)].label}</Btn>}
                    {err(`games.${i}.cover`) && <span className="text-xs text-red-400">{err(`games.${i}.cover`)}</span>}
                  </div>
                </div>
                <RowTools list="games" i={i} />
              </div>
            );
          })}
        </div>
      </Block>

      <Block title="پرسش‌های پرتکرار" action={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => add('faq', { id: uid(), q: '', a: '' })}>پرسش جدید</Btn>}>
        <div className="flex flex-col gap-4">
          {draft.faq.map((f, i) => (
            <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <div className="flex min-w-0 flex-col gap-2">
                {In({ path: `faq.${i}.q`, placeholder: 'پرسش' })}
                {In({ path: `faq.${i}.a`, placeholder: 'پاسخ', area: 2 })}
              </div>
              <RowTools list="faq" i={i} />
            </div>
          ))}
        </div>
      </Block>

      <Block title="ویژگی‌های هر پلن" desc="هر خط یک ویژگی است که روی کارت پلن‌ها می‌آد.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PLAN.map(([key, name]) => (
            <Field key={key} label={name}>
              <textarea id={`set-feats-${key}`} rows={4} value={draft.feats[key].join('\n')} onChange={(e) => up(`feats.${key}`, e.target.value.split('\n'))} className="field resize-y leading-7" />
            </Field>
          ))}
        </div>
      </Block>

      <Block title="اتصال و DNS" desc="این مقدارها توی کانفیگ WireGuard و صفحه DNS پنل کاربر استفاده می‌شن.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {In({ path: 'dns.primary', label: 'Primary DNS', mono: true })}
          {In({ path: 'dns.secondary', label: 'Secondary DNS', mono: true })}
          {In({ path: 'wg.endpoint', label: 'WireGuard Endpoint', mono: true, hint: 'host:port' })}
          {In({ path: 'wg.allowed', label: 'AllowedIPs', mono: true })}
          {In({ path: 'wg.serverKey', label: 'Server Public Key', mono: true, className: 'sm:col-span-2' })}
          {In({ path: 'wg.mtu', label: 'MTU', mono: true, num: true })}
        </div>
      </Block>

      <Block title="ظاهر و فوتر">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[14rem_1fr]">
          <Field label="رنگ برند" error={err('accent')} hint="روی دکمه اصلی و کلمه رنگی تیتر">
            <div className="flex gap-2">
              <input id="set-accent-pick" type="color" value={/^#[0-9a-f]{6}$/i.test(draft.accent) ? draft.accent : '#e60012'} onChange={(e) => up('accent', e.target.value.toUpperCase())} aria-label="انتخاب رنگ" className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-edge bg-transparent p-1" />
              <input id="set-accent" dir="ltr" value={draft.accent} onChange={(e) => up('accent', e.target.value.trim())} className={cx('field mono text-left', err('accent') && 'border-red-500')} />
            </div>
          </Field>
          {In({ path: 'footer', label: 'متن فوتر' })}
        </div>
      </Block>

      {/* save bar */}
      <div className="gutter pointer-events-none fixed inset-x-0 bottom-0 z-30 pb-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
        <div className="pointer-events-auto mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-edge bg-raise px-4 py-3 shadow-2xl shadow-black">
          <span className={cx('me-auto text-xs', tried && bad ? 'text-red-400' : dirty ? 'text-warn' : 'text-zinc-500')}>
            {tried && bad ? `${fa(bad)} فیلد ایراد داره` : dirty ? 'تغییرهای ذخیره‌نشده داری' : 'همه چیز ذخیره شده'}
          </span>
          <Btn variant="ghost" size="sm" icon={RotateCcw} onClick={() => { setDraft(seedSite()); setTried(false); }}>پیش‌فرض</Btn>
          <Btn variant="ghost" size="sm" disabled={!dirty} onClick={() => { setDraft(clone(s.site)); setTried(false); }}>لغو تغییرها</Btn>
          <Btn icon={Save} disabled={!dirty} onClick={save}>ذخیره <Mono className="hidden">save</Mono></Btn>
        </div>
      </div>
    </div>
  );
}
