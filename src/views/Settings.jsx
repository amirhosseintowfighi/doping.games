// Admin → «تنظیمات سایت». Everything a visitor sees on the site is edited here, in six sub-tabs:
// home page, games, plans & prices, FAQ, connection & DNS, look & backup. Edits stay in a draft,
// are validated, and apply when saved (kept in this browser's storage).
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Copy, Download, ImagePlus, Plus, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { COVERS, coverSrc, fileToCover, guessCover } from '../covers.js';
import { useStore } from '../store.jsx';
import { Btn, Card, copyText, cx, Field, Mono, Toggle } from '../ui.jsx';
import { fa, migrateSite, seedSite, tierKey, tierLabel, uid, validateSite } from '../data.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
/** Immutable write at a dotted path, e.g. setAt(cfg, 'games.2.isp', 140). */
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

const SUBS = [
  ['home', 'صفحه اصلی'],
  ['games', 'بازی‌ها'],
  ['plans', 'پلن‌ها و قیمت'],
  ['faq', 'پرسش‌ها'],
  ['connect', 'اتصال و DNS'],
  ['look', 'ظاهر و پشتیبان'],
];
const tabOf = (k) => (k.startsWith('games') ? 'games'
  : /^(pricing|planNames|kinds|feats)/.test(k) ? 'plans'
    : k.startsWith('faq') ? 'faq'
      : /^(dns|wg)\./.test(k) ? 'connect'
        : /^(accent|footer)/.test(k) ? 'look' : 'home');

const SECTION_NAMES = {
  ping: 'تست پینگ', games: 'بازی‌های تحت پوشش', calculator: 'محاسبه‌گر حجم', servers: 'سرورهای بازی',
  pricing: 'پلن‌ها', faq: 'پرسش‌های پرتکرار', cta: 'بخش پایانی',
};
const EXIT_NAMES = [['mct', 'مسقط'], ['dxb', 'دبی'], ['fra', 'فرانکفورت']];

function Block({ title, desc, children, action, id }) {
  return (
    <Card id={id} className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-black">{title}</h3>
          {desc && <p className="mt-1 text-xs leading-6 text-zinc-500">{desc}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export default function Settings({ sub }) {
  const { s, set, toast, api } = useStore();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(() => clone(s.site));
  const [tab, setTab] = useState(SUBS.some(([k]) => k === sub) ? sub : 'home');
  const [tried, setTried] = useState(false);
  const [openGame, setOpenGame] = useState(null);
  const [importText, setImportText] = useState('');
  const [importErr, setImportErr] = useState('');
  const errors = useMemo(() => validateSite(draft), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(s.site);
  const bad = Object.keys(errors).length;
  const badBy = useMemo(() => Object.keys(errors).reduce((a, k) => ({ ...a, [tabOf(k)]: (a[tabOf(k)] ?? 0) + 1 }), {}), [errors]);

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const up = (path, value) => setDraft((d) => setAt(d, path, value));
  const err = (path) => (tried ? errors[path] : undefined);
  const listAt = (d, path) => getAt(d, path);
  const move = (path, i, dir) => setDraft((d) => {
    const list = [...listAt(d, path)];
    const j = i + dir;
    if (j < 0 || j >= list.length) return d;
    [list[i], list[j]] = [list[j], list[i]];
    return setAt(d, path, list);
  });
  const remove = (path, i) => setDraft((d) => setAt(d, path, listAt(d, path).filter((_, k) => k !== i)));
  const add = (path, row) => setDraft((d) => setAt(d, path, [...listAt(d, path), row]));

  /** Text or number input bound to a path in the draft. */
  const In = ({ path, label, mono, area, num, hint, className, placeholder, disabled }) => {
    const id = `set-${path.replace(/\./g, '-')}`;
    const common = {
      id, placeholder, disabled, value: getAt(draft, path) ?? '', 'aria-invalid': !!err(path),
      onChange: (e) => up(path, num ? Number(e.target.value.replace(/[^\d]/g, '')) || 0 : e.target.value),
      className: cx('field', mono && 'mono text-left', area && 'resize-y leading-7', err(path) && 'border-red-500', disabled && 'opacity-40'),
      dir: mono ? 'ltr' : undefined,
    };
    const control = area ? <textarea rows={area} {...common} /> : <input inputMode={num ? 'numeric' : undefined} {...common} />;
    return label
      ? <Field label={label} hint={hint} error={err(path)} className={className}>{control}</Field>
      : <div className={cx('min-w-0', className)}>{control}{err(path) && <span className="mt-1 block text-xs text-red-400">{err(path)}</span>}</div>;
  };
  const RowTools = ({ path, i, len }) => (
    <div className="flex shrink-0 gap-1">
      <Btn size="sm" variant="ghost" icon={ArrowUp} aria-label="بالا" disabled={i === 0} onClick={() => move(path, i, -1)} />
      <Btn size="sm" variant="ghost" icon={ArrowDown} aria-label="پایین" disabled={i === len - 1} onClick={() => move(path, i, 1)} />
      <Btn size="sm" variant="danger" icon={Trash2} aria-label="حذف" onClick={() => remove(path, i)} />
    </div>
  );
  const Small = ({ children }) => <span className="mb-1 block text-[11px] text-zinc-500">{children}</span>;

  const save = async () => {
    setTried(true);
    if (bad) {
      const first = SUBS.find(([k]) => badBy[k])?.[0];
      if (first) setTab(first);
      return toast(`${fa(bad)} فیلد ایراد داره؛ قرمزها رو درست کن.`, 'bad');
    }
    const next = clone(draft);
    next.feats = Object.fromEntries(Object.entries(next.feats).map(([k, v]) => [k, v.map((x) => x.trim()).filter(Boolean)]));
    next.games = next.games.map((g) => ({ ...g, short: g.short?.trim() || g.name.trim(), name: g.name.trim() }));
    setSaving(true);
    try {
      const saved = await api('/api/admin/site', { method: 'PUT', body: next });
      set({ site: saved });
      setDraft(clone(saved));
      setTried(false);
      toast('تنظیمات ذخیره شد و روی سایت اعمال شد.');
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setSaving(false);
    }
  };

  const exportJson = JSON.stringify(draft, null, 2);
  const doImport = () => {
    try {
      if (importText.length > 4_000_000) throw new Error('فایل خیلی بزرگه.');
      const parsed = JSON.parse(importText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.hero) throw new Error('این متن تنظیمات دوپینگ نیست.');
      const next = migrateSite(parsed, seedSite(), guessCover);
      const e = validateSite(next);
      if (Object.keys(e).length) throw new Error(`${fa(Object.keys(e).length)} فیلد نامعتبر داره؛ اول اونا رو درست کن.`);
      setDraft(next);
      setImportErr('');
      setImportText('');
      toast('تنظیمات وارد شد. برای اعمال روی سایت «ذخیره» رو بزن.');
    } catch (x) {
      setImportErr(x instanceof SyntaxError ? 'متن JSON معتبر نیست.' : x.message);
    }
  };
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([exportJson], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'doping-settings.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      toast('دانلود ممکن نشد؛ از «کپی» استفاده کن.', 'warn');
    }
  };

  const P = draft.pricing;
  const popularPing = P.popular?.ping;
  const popularDns = P.popular?.dns;

  return (
    <div className="flex flex-col gap-4 pb-28">
      <p className="text-sm leading-7 text-zinc-400">هر چیزی که کاربر روی سایت می‌بینه از اینجا عوض می‌شه. تغییرها بعد از «ذخیره» اعمال می‌شن و روی همین مرورگر می‌مونن.</p>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-card p-1" role="tablist" aria-label="بخش‌های تنظیمات">
        {SUBS.map(([k, label]) => (
          <button
            key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cx('flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-[13px] whitespace-nowrap transition-colors', tab === k ? 'bg-white/10 font-bold text-white' : 'text-zinc-400 hover:text-white')}
          >
            {label}
            {tried && badBy[k] > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">{fa(badBy[k])}</span>}
          </button>
        ))}
      </div>

      {/* ───────── home page ───────── */}
      {tab === 'home' && (
        <>
          <Block title="نوار اطلاعیه" desc="یک خط پیام بالای همه صفحه‌ها، مثلاً برای تخفیف یا قطعی برنامه‌ریزی‌شده. کاربر می‌تونه ببندتش.">
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex items-center gap-3 pt-2.5">
                <Toggle checked={draft.banner.on} onChange={(v) => up('banner.on', v)} label="نمایش نوار اطلاعیه" />
                <span className="text-sm">نمایش</span>
              </div>
              {In({ path: 'banner.text', placeholder: 'متن اطلاعیه', className: 'min-w-0 flex-1', disabled: !draft.banner.on })}
            </div>
          </Block>

          <Block title="بالای صفحه اصلی" desc="تیتر سه تکه است؛ تکه وسط با رنگ برند نمایش داده می‌شه.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {In({ path: 'hero.line1', label: 'خط اول تیتر' })}
              {In({ path: 'hero.accent', label: 'کلمه رنگی' })}
              {In({ path: 'hero.line2', label: 'ادامه تیتر' })}
              {In({ path: 'hero.desc', label: 'توضیح زیر تیتر', area: 2, className: 'sm:col-span-3' })}
              {In({ path: 'hero.cta1', label: 'متن دکمه اصلی' })}
              {In({ path: 'hero.cta2', label: 'متن دکمه دوم' })}
              {In({ path: 'hero.pingLink', label: 'لینک تست پینگ' })}
              {In({ path: 'hero.sceneHint', label: 'راهنمای زیر صحنه مسیر', className: 'sm:col-span-2' })}
              <div className="flex items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3">
                <span className="text-sm">صحنه مسیر (وکتور)</span>
                <Toggle checked={draft.show.heroScene !== false} onChange={(v) => up('show.heroScene', v)} label="نمایش صحنه مسیر" />
              </div>
            </div>
          </Block>

          <Block
            title="ردیف آمار" desc="برای عدد زنده به‌جای مقدار بنویس {nodes} (تعداد نودها) یا {online} (بازیکن‌های آنلاین)."
            action={<Btn size="sm" variant="ghost" icon={Plus} disabled={draft.stats.length >= 4} onClick={() => add('stats', { value: '', label: '' })}>آمار جدید</Btn>}
          >
            <div className="flex flex-col gap-2">
              {draft.stats.map((_, i) => (
                <div key={i} className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[7rem_minmax(0,1fr)_auto]">
                  {In({ path: `stats.${i}.value`, mono: true, placeholder: '28ms' })}
                  {In({ path: `stats.${i}.label`, placeholder: 'عنوان' })}
                  <div className="col-span-2 flex justify-end sm:col-span-1"><RowTools path="stats" i={i} len={draft.stats.length} /></div>
                </div>
              ))}
              {!draft.stats.length && <p className="text-xs text-zinc-500">ردیف آمار نمایش داده نمی‌شه.</p>}
            </div>
          </Block>

          <Block title="بخش‌های صفحه" desc="ترتیب بخش‌ها رو با فلش‌ها عوض کن، هر کدوم رو خاموش کن، یا متنش رو تغییر بده.">
            <ol className="flex flex-col divide-y divide-line">
              {draft.order.map((key, i) => (
                <li key={key} className="grid grid-cols-1 gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[10rem_minmax(0,1fr)]" data-order-row={key}>
                  <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-start sm:justify-start">
                    <span className="text-sm font-bold">{fa(i + 1)}. {SECTION_NAMES[key]}</span>
                    <div className="flex items-center gap-2">
                      <Toggle checked={draft.show[key] !== false} onChange={(v) => up(`show.${key}`, v)} label={`نمایش ${SECTION_NAMES[key]}`} />
                      <Btn size="sm" variant="ghost" icon={ArrowUp} aria-label={`بالا بردن ${SECTION_NAMES[key]}`} disabled={i === 0} onClick={() => move('order', i, -1)} />
                      <Btn size="sm" variant="ghost" icon={ArrowDown} aria-label={`پایین بردن ${SECTION_NAMES[key]}`} disabled={i === draft.order.length - 1} onClick={() => move('order', i, 1)} />
                    </div>
                  </div>
                  <div className={cx('grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2', draft.show[key] === false && 'opacity-40')}>
                    {key !== 'cta' && In({ path: `text.${key}.label`, placeholder: 'برچسب کوچک' })}
                    {In({ path: `text.${key}.title`, placeholder: 'تیتر' })}
                    {In({ path: `text.${key}.desc`, placeholder: 'توضیح', className: 'sm:col-span-2' })}
                    {key === 'ping' && draft.text.ping.items.map((_, j) => (
                      <div key={j} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 sm:col-span-2">
                        {In({ path: `text.ping.items.${j}.k`, placeholder: 'عنوان' })}
                        {In({ path: `text.ping.items.${j}.v`, placeholder: 'توضیح' })}
                      </div>
                    ))}
                    {key === 'calculator' && !draft.show.pricing && <p className="text-xs text-warn sm:col-span-2">محاسبه‌گر فقط وقتی پلن‌ها روشن باشن نمایش داده می‌شه.</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Block>
        </>
      )}

      {/* ───────── games ───────── */}
      {tab === 'games' && (
        <Block
          title="بازی‌ها"
          desc="بازی‌های تیک‌خورده «تست پینگ» توی صحنه بالای سایت و تست پینگ نمایش داده می‌شن (۱ تا ۶). همه بازی‌ها توی «بازی‌های تحت پوشش» و محاسبه‌گر حجم هستن. پینگ‌ها تخمینی‌ان؛ با اندازه‌گیری واقعی خودت جایگزینشون کن."
          action={(
            <Btn size="sm" variant="ghost" icon={Plus} onClick={() => {
              const id = uid();
              add('games', { id, name: '', short: '', dc: '', cover: '', isp: 120, loss: 5, jitter: 20, via: { mct: 35, dxb: 38, fra: 70 }, mb: 100, featured: false });
              setOpenGame(id);
            }}
            >
              بازی جدید
            </Btn>
          )}
        >
          {err('games.featured') && <p className="mb-3 text-xs text-red-400">{err('games.featured')}</p>}
          {err('games') && <p className="mb-3 text-xs text-red-400">{err('games')}</p>}
          <div className="flex flex-col gap-3">
            {draft.games.map((g, i) => {
              const src = coverSrc(g.cover);
              const isOpen = openGame === g.id;
              const broken = tried && Object.keys(errors).some((k) => k.startsWith(`games.${i}.`));
              return (
                <div key={g.id} className={cx('rounded-xl border bg-ink/40 p-3', broken ? 'border-red-500/60' : 'border-line')}>
                  <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3">
                    <div className="aspect-[2/3] overflow-hidden rounded-md border border-line bg-raise">
                      {src ? <img src={src} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-[11px] text-zinc-600">—</span>}
                    </div>
                    {In({ path: `games.${i}.name`, mono: true, placeholder: 'Game name' })}
                    <Btn
                      size="sm" variant="ghost" aria-expanded={isOpen} aria-label={`جزئیات بازی ${g.name || fa(i + 1)}`}
                      onClick={() => setOpenGame(isOpen ? null : g.id)}
                      icon={ChevronDown} className={cx('[&_svg]:transition-transform', isOpen && '[&_svg]:rotate-180')}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-zinc-400">
                      <Toggle checked={!!g.featured} onChange={(v) => up(`games.${i}.featured`, v)} label={`تست پینگ ${g.name}`} />
                      تست پینگ و صحنه بالا
                    </label>
                    {broken && !isOpen && <span className="text-xs text-red-400">ایراد داره؛ بازش کن</span>}
                    <RowTools path="games" i={i} len={draft.games.length} />
                  </div>

                  {isOpen && (
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
                      {In({ path: `games.${i}.short`, label: 'اسم کوتاه', mono: true, placeholder: 'CS2' })}
                      {In({ path: `games.${i}.dc`, label: 'دیتاسنتر', mono: true, placeholder: 'Valve Dubai' })}
                      {In({ path: `games.${i}.mb`, label: 'مصرف (MB/ساعت)', mono: true, num: true })}
                      <div className="col-span-2 flex flex-wrap items-end gap-2 sm:col-span-1">
                        <label className="min-w-0 flex-1">
                          <Small>کاور</Small>
                          <select
                            id={`set-games-${i}-cover`} className="field py-2 text-xs"
                            value={g.cover?.startsWith('data:') ? 'upload' : g.cover ?? ''}
                            onChange={(e) => e.target.value !== 'upload' && up(`games.${i}.cover`, e.target.value)}
                          >
                            <option value="">بدون کاور (طرح خطی)</option>
                            {Object.entries(COVERS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                            {g.cover?.startsWith('data:') && <option value="upload">تصویر آپلودشده</option>}
                          </select>
                        </label>
                      </div>
                      <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-4">
                        <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-xs font-bold hover:bg-white/[0.11]">
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
                      <p className="col-span-2 text-xs font-bold text-zinc-300 sm:col-span-4">اینترنت معمولی</p>
                      {In({ path: `games.${i}.isp`, label: 'پینگ (ms)', mono: true, num: true })}
                      {In({ path: `games.${i}.loss`, label: 'پکت لاس (٪)', mono: true, num: true })}
                      {In({ path: `games.${i}.jitter`, label: 'جیتر (ms)', mono: true, num: true })}
                      <span className="hidden sm:block" />
                      <p className="col-span-2 text-xs font-bold text-zinc-300 sm:col-span-4">با دوپینگ، از هر خروجی</p>
                      {EXIT_NAMES.map(([x, name]) => In({ path: `games.${i}.via.${x}`, label: `${name} (ms)`, mono: true, num: true }))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Block>
      )}

      {/* ───────── plans & prices ───────── */}
      {tab === 'plans' && (
        <>
          <Block title="سرویس‌ها" desc="اسم هر نوع سرویس توی تب‌های فروشگاه، فاکتورها و پنل. خاموش کردن، تبش رو از فروشگاه برمی‌داره.">
            {err('kinds') && <p className="mb-3 text-xs text-red-400">{err('kinds')}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {['ping', 'dns', 'pro'].map((k) => (
                <div key={k} className="flex items-start gap-3 rounded-xl bg-ink p-3">
                  <div className="pt-2"><Toggle checked={!!draft.kinds[k]} onChange={(v) => up(`kinds.${k}`, v)} label={`فروش ${draft.planNames[k]}`} /></div>
                  {In({ path: `planNames.${k}`, className: 'flex-1' })}
                </div>
              ))}
            </div>
          </Block>

          <Block
            id="set-ping-tiers"
            title={`پلن‌های ${draft.planNames.ping}`} desc="قیمت ماهانه به تومان. «پکیج پرو» همین حجم‌ها با ضریب پایین صفحه است."
            action={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => add('pricing.ping', { id: uid(), gb: Math.max(0, ...P.ping.map((t) => t.gb ?? 0)) + 50, price: 199_000 })}>حجم جدید</Btn>}
          >
            {err('pricing.ping') && <p className="mb-3 text-xs text-red-400">{err('pricing.ping')}</p>}
            <div className="flex flex-col gap-2">
              {P.ping.map((t, i) => (
                <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-start gap-2 rounded-xl bg-ink/40 p-2 sm:grid-cols-[7rem_6.5rem_minmax(0,1fr)_7rem_auto] sm:items-center">
                  <label className="flex min-h-10 items-center gap-2 text-xs text-zinc-400">
                    <input type="checkbox" checked={t.gb == null} onChange={(e) => up(`pricing.ping.${i}.gb`, e.target.checked ? null : 100)} className="size-4 accent-white" />
                    نامحدود
                  </label>
                  {t.gb == null ? <span className="flex min-h-10 items-center text-sm text-zinc-300">زمانی</span> : (
                    <label className="min-w-0"><Small>حجم (گیگ)</Small>{In({ path: `pricing.ping.${i}.gb`, mono: true, num: true })}</label>
                  )}
                  <label className="col-span-2 min-w-0 sm:col-span-1"><Small>قیمت ماهانه (تومان)</Small>{In({ path: `pricing.ping.${i}.price`, mono: true, num: true })}</label>
                  <label className="flex min-h-10 items-center gap-2 text-xs text-zinc-400">
                    <input type="radio" name="pop-ping" checked={popularPing === t.gb} onChange={() => up('pricing.popular.ping', t.gb)} className="size-4 accent-white" />
                    پرفروش
                  </label>
                  <div className="flex justify-end"><Btn size="sm" variant="danger" icon={Trash2} aria-label={`حذف ${tierLabel(tierKey(t.gb))}`} onClick={() => remove('pricing.ping', i)} /></div>
                </div>
              ))}
            </div>
            <Btn size="sm" variant="ghost" className="mt-3" onClick={() => up('pricing.popular.ping', undefined)}>بدون برچسب پرفروش</Btn>
          </Block>

          <Block
            title={`پلن‌های ${draft.planNames.dns}`} desc="قیمت ماهانه بر اساس تعداد آی‌پی مجاز."
            action={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => add('pricing.dns', { id: uid(), slots: Math.max(0, ...P.dns.map((d) => d.slots)) + 1, price: 129_000 })}>پلن جدید</Btn>}
          >
            {err('pricing.dns') && <p className="mb-3 text-xs text-red-400">{err('pricing.dns')}</p>}
            <div className="flex flex-col gap-2">
              {P.dns.map((d, i) => (
                <div key={d.id} className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-2 rounded-xl bg-ink/40 p-2 sm:grid-cols-[6.5rem_minmax(0,1fr)_7rem_auto] sm:items-center">
                  <label className="min-w-0"><Small>تعداد آی‌پی</Small>{In({ path: `pricing.dns.${i}.slots`, mono: true, num: true })}</label>
                  <label className="min-w-0"><Small>قیمت ماهانه (تومان)</Small>{In({ path: `pricing.dns.${i}.price`, mono: true, num: true })}</label>
                  <label className="flex min-h-10 items-center gap-2 text-xs text-zinc-400">
                    <input type="radio" name="pop-dns" checked={popularDns === d.slots} onChange={() => up('pricing.popular.dns', d.slots)} className="size-4 accent-white" />
                    پرفروش
                  </label>
                  <div className="flex justify-end"><Btn size="sm" variant="danger" icon={Trash2} aria-label={`حذف ${fa(d.slots)} آی‌پی`} onClick={() => remove('pricing.dns', i)} /></div>
                </div>
              ))}
            </div>
          </Block>

          <Block
            title="مدت اشتراک و تخفیف" desc="هر ردیف یک تب مدت توی فروشگاه می‌سازه."
            action={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => add('pricing.durations', { id: uid(), months: Math.max(0, ...P.durations.map((d) => d.months)) + 3, off: 20 })}>مدت جدید</Btn>}
          >
            {err('pricing.durations') && <p className="mb-3 text-xs text-red-400">{err('pricing.durations')}</p>}
            <div className="flex flex-col gap-2">
              {P.durations.map((d, i) => (
                <div key={d.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                  <label className="min-w-0"><Small>ماه</Small>{In({ path: `pricing.durations.${i}.months`, mono: true, num: true })}</label>
                  <label className="min-w-0"><Small>تخفیف (٪)</Small>{In({ path: `pricing.durations.${i}.off`, mono: true, num: true })}</label>
                  <Btn size="sm" variant="danger" icon={Trash2} aria-label={`حذف ${fa(d.months)} ماهه`} onClick={() => remove('pricing.durations', i)} className="mb-1" />
                </div>
              ))}
            </div>
          </Block>

          <Block title="سایر قیمت‌ها">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={`ضریب ${draft.planNames.pro}`} hint={`${fa(Math.round((+P.proMul - 1) * 100) || 0)}٪ گران‌تر از ${draft.planNames.ping}`} error={err('pricing.proMul')}>
                <input id="set-pricing-proMul" dir="ltr" type="number" step="0.05" min="1" max="5" value={P.proMul} onChange={(e) => up('pricing.proMul', Number(e.target.value))} className={cx('field mono text-left', err('pricing.proMul') && 'border-red-500')} />
              </Field>
              {In({ path: 'pricing.extraPerGb', label: 'هر گیگ ترافیک مازاد (تومان)', mono: true, num: true })}
            </div>
          </Block>

          <Block title="دستگاه‌ها و معرفی" desc="تعداد کانفیگ همزمان هر اشتراک (با کانفیگ اصلی) و پاداش معرفی دوستان. پاداش ۰ یعنی معرفی خاموش.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {In({ path: 'account.devices.ping', label: `دستگاه ${draft.planNames.ping}`, mono: true, num: true })}
              {In({ path: 'account.devices.pro', label: `دستگاه ${draft.planNames.pro}`, mono: true, num: true })}
              {In({ path: 'account.referralPercent', label: 'پاداش معرفی (٪ اولین خرید)', mono: true, num: true })}
            </div>
          </Block>

          <Block title="ویژگی‌های هر پلن" desc="هر خط یک ویژگی است که روی کارت پلن‌ها می‌آد.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {['ping', 'dns', 'pro'].map((key) => (
                <Field key={key} label={draft.planNames[key]}>
                  <textarea id={`set-feats-${key}`} rows={4} value={draft.feats[key].join('\n')} onChange={(e) => up(`feats.${key}`, e.target.value.split('\n'))} className="field resize-y leading-7" />
                </Field>
              ))}
            </div>
          </Block>
        </>
      )}

      {/* ───────── FAQ ───────── */}
      {tab === 'faq' && (
        <Block title="پرسش‌های پرتکرار" action={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => add('faq', { id: uid(), q: '', a: '' })}>پرسش جدید</Btn>}>
          <div className="flex flex-col gap-4">
            {draft.faq.map((f, i) => (
              <div key={f.id} className="flex flex-col gap-2 border-b border-line pb-4 last:border-0 last:pb-0">
                {In({ path: `faq.${i}.q`, placeholder: 'پرسش' })}
                {In({ path: `faq.${i}.a`, placeholder: 'پاسخ', area: 3 })}
                <div className="flex justify-end"><RowTools path="faq" i={i} len={draft.faq.length} /></div>
              </div>
            ))}
          </div>
        </Block>
      )}

      {/* ───────── connection ───────── */}
      {tab === 'connect' && (
        <Block title="اتصال و DNS" desc="این مقدارها توی کانفیگ WireGuard، راهنمای اتصال و صفحه DNS پنل کاربر استفاده می‌شن.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {In({ path: 'dns.primary', label: 'Primary DNS', mono: true })}
            {In({ path: 'dns.secondary', label: 'Secondary DNS', mono: true })}
            {In({ path: 'wg.endpoint', label: 'WireGuard Endpoint', mono: true, hint: 'host:port' })}
            {In({ path: 'wg.allowed', label: 'AllowedIPs', mono: true })}
            {In({ path: 'wg.serverKey', label: 'Server Public Key', mono: true, className: 'sm:col-span-2' })}
            {In({ path: 'wg.mtu', label: 'MTU', mono: true, num: true })}
          </div>
        </Block>
      )}

      {/* ───────── look & backup ───────── */}
      {tab === 'look' && (
        <>
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
            <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-ink px-4 py-3">
              <div>
                <div className="text-sm font-bold">افکت‌های حرکتی</div>
                <div className="text-xs leading-6 text-zinc-500">پارالاکس، کج شدن کاورها زیر موس، بسته‌های متحرک و شمارش عددها. برای کسانی که «کاهش حرکت» رو در سیستم‌عامل روشن کردن همیشه خاموشه.</div>
              </div>
              <Toggle checked={draft.motion !== false} onChange={(v) => up('motion', v)} label="افکت‌های حرکتی" />
            </div>
          </Block>

          <Block title="پشتیبان‌گیری" desc="از کل تنظیمات سایت (متن‌ها، بازی‌ها، قیمت‌ها، پرسش‌ها، اتصال) خروجی بگیر یا یک خروجی قبلی رو وارد کن. کاورهای آپلودشده هم داخلش هستن.">
            <div className="flex flex-wrap gap-2">
              <Btn variant="ghost" icon={Copy} onClick={async () => toast((await copyText(exportJson)) ? 'تنظیمات کپی شد.' : 'کپی نشد؛ مرورگر اجازه نداد.', 'ok')}>کپی تنظیمات</Btn>
              <Btn variant="ghost" icon={Download} onClick={download}>دانلود فایل <Mono>.json</Mono></Btn>
            </div>
            <Field label="وارد کردن" className="mt-5" error={importErr} hint="متن یک خروجی قبلی رو اینجا بچسبون. بعد از بررسی، برای اعمال «ذخیره» رو بزن.">
              <textarea id="set-import" rows={4} dir="ltr" value={importText} onChange={(e) => { setImportText(e.target.value); setImportErr(''); }} className="field mono resize-y text-left text-xs" placeholder='{ "hero": { … } }' />
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn variant="ghost" icon={Upload} disabled={!importText.trim()} onClick={doImport}>بررسی و وارد کردن</Btn>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white/[0.06] px-4 text-[13px] font-bold hover:bg-white/[0.11]">
                انتخاب فایل
                <input id="set-import-file" type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setImportText(await f.text()); }} />
              </label>
            </div>
          </Block>
        </>
      )}

      {/* save bar */}
      <div className="gutter pointer-events-none fixed inset-x-0 bottom-0 z-30 pb-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
        <div className="pointer-events-auto mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-edge bg-raise px-4 py-3 shadow-2xl shadow-black sm:gap-3">
          <span className={cx('me-auto text-xs', tried && bad ? 'text-red-400' : dirty ? 'text-warn' : 'text-zinc-500')}>
            {tried && bad ? `${fa(bad)} فیلد ایراد داره` : dirty ? 'تغییرهای ذخیره‌نشده داری' : 'همه چیز ذخیره شده'}
          </span>
          <Btn variant="ghost" size="sm" icon={RotateCcw} onClick={() => { setDraft(seedSite()); setTried(false); }}>پیش‌فرض</Btn>
          <Btn variant="ghost" size="sm" disabled={!dirty} onClick={() => { setDraft(clone(s.site)); setTried(false); }}>لغو</Btn>
          <Btn icon={Save} disabled={!dirty} busy={saving} onClick={save}>ذخیره</Btn>
        </div>
      </div>
    </div>
  );
}
