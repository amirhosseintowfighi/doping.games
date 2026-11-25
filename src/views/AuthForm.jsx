'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { KeyRound, LogIn, Mail, Smartphone, UserPlus } from 'lucide-react';
import { useStore } from '../store.jsx';
import { Btn, Card, cx, Field } from '../ui.jsx';

const safeNext = (n) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/panel');
const REF_KEY = 'doping.ref';

function Shell({ title, sub, children, foot }) {
  return (
    <div className="gutter mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-12">
      <h1 className="text-2xl font-black">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">{sub}</p>
      <Card className="mt-6 p-6">{children}</Card>
      {foot && <p className="mt-4 text-center text-sm text-zinc-500">{foot}</p>}
    </div>
  );
}

const ErrorLine = ({ error, errs }) => (error && !Object.values(errs).some(Boolean) ? <p className="text-sm text-red-400" role="alert">{error}</p> : null);

/** Six-digit SMS login: number → code → session. Only for accounts with a verified phone. */
function SmsLogin({ next }) {
  const { api } = useStore();
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState('');
  const [errs, setErrs] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    setError('');
    setErrs({});
    try { await fn(); } catch (err) { setErrs(err.fields ?? {}); setError(err.message); }
    setBusy(false);
  };
  if (!sent) {
    return (
      <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await api('/api/auth/otp', { method: 'POST', body: { phone } }); setSent(r.phone); }); }}>
        <Field label="شماره موبایل" hint="شماره‌ای که توی پنل تایید کردی." error={errs.phone}>
          <input id="auth-phone" dir="ltr" inputMode="tel" autoComplete="tel" placeholder="09121234567" value={phone} onChange={(e) => setPhone(e.target.value)} className="field mono" />
        </Field>
        <ErrorLine error={error} errs={errs} />
        <Btn type="submit" size="lg" className="w-full" icon={Smartphone} busy={busy} disabled={phone.trim().length < 10}>ارسال کد ورود</Btn>
      </form>
    );
  }
  return (
    <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await api('/api/auth/otp/verify', { method: 'POST', body: { phone: sent, code } }); window.location.href = r.role === 'admin' && !next ? '/admin' : safeNext(next); }); }}>
      <p className="text-sm leading-7 text-silver">اگه <span className="mono text-white" dir="ltr">{sent}</span> به حسابی وصل باشه، کد ۶ رقمی براش پیامک شد.</p>
      <Field label="کد ورود" error={errs.code}>
        <input id="auth-otp" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="field mono text-center text-lg tracking-[0.5em]" />
      </Field>
      <ErrorLine error={error} errs={errs} />
      <Btn type="submit" size="lg" className="w-full" icon={LogIn} busy={busy} disabled={code.length !== 6}>ورود</Btn>
      <button type="button" onClick={() => { setSent(null); setCode(''); }} className="w-full text-center text-xs text-silver hover:text-white">شماره رو اشتباه زدم</button>
    </form>
  );
}

export default function AuthForm({ mode, next, registration = true, sms = false, refCode = '' }) {
  const { api } = useStore();
  const reg = mode === 'register';
  const [method, setMethod] = useState('password');
  const [f, setF] = useState({ login: '', email: '', username: '', password: '' });
  const [ref, setRef] = useState(refCode);
  const [errs, setErrs] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErrs({ ...errs, [k]: '' }); setError(''); };

  // A referral code from a ?ref= link is kept on this device until sign-up.
  useEffect(() => {
    try {
      if (refCode) localStorage.setItem(REF_KEY, refCode);
      else setRef(localStorage.getItem(REF_KEY) ?? '');
    } catch { /* storage is optional */ }
  }, [refCode]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api(reg ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        body: reg ? { email: f.email, username: f.username, password: f.password, ...(ref ? { ref } : {}) } : { login: f.login, password: f.password },
      });
      if (reg) { try { localStorage.removeItem(REF_KEY); } catch { /* optional */ } }
      window.location.href = !reg && r.role === 'admin' && !next ? '/admin' : safeNext(next);
    } catch (err) {
      setErrs(err.fields ?? {});
      setError(err.message);
      setBusy(false);
    }
  };

  const q = next ? `?next=${encodeURIComponent(next)}` : '';
  return (
    <Shell
      title={reg ? 'ساخت حساب دوپینگ' : 'ورود به حساب'}
      sub={reg ? 'با حساب کاربری، اشتراک، کانفیگ اتصال و کیف پولت یک‌جا مدیریت می‌شه.' : 'با ایمیل یا نام کاربری، یا با کد پیامکی وارد شو.'}
      foot={reg ? <>حساب داری؟ <Link href={`/login${q}`} className="font-bold text-white">وارد شو</Link></> : <>حساب نداری؟ <Link href={`/register${q}`} className="font-bold text-white">ثبت‌نام کن</Link></>}
    >
      {reg && !registration ? (
        <p className="text-sm text-silver">ثبت‌نام در حال حاضر بسته است.</p>
      ) : (
        <>
          {!reg && sms && (
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-line p-1 text-sm" role="tablist" aria-label="روش ورود">
              {[['password', 'رمز عبور', KeyRound], ['sms', 'کد پیامکی', Smartphone]].map(([id, label, Icon]) => (
                <button key={id} type="button" role="tab" aria-selected={method === id} onClick={() => setMethod(id)} className={cx('flex items-center justify-center gap-2 rounded-lg py-2 transition-colors', method === id ? 'bg-white/10 font-bold text-white' : 'text-zinc-400 hover:text-white')}>
                  <Icon className="size-4" />{label}
                </button>
              ))}
            </div>
          )}
          {!reg && method === 'sms' ? <SmsLogin next={next} /> : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              {reg ? (
                <>
                  <Field label="ایمیل" hint="برای تایید حساب و بازیابی رمز." error={errs.email}><input id="auth-email" type="email" dir="ltr" autoComplete="email" required value={f.email} onChange={up('email')} className="field mono" /></Field>
                  <Field label="نام کاربری" hint="حروف لاتین، عدد، نقطه یا خط تیره؛ توی سرورهای بازی هم همین دیده می‌شه." error={errs.username}><input id="auth-username" dir="ltr" autoComplete="username" required value={f.username} onChange={up('username')} className="field mono" /></Field>
                </>
              ) : (
                <Field label="ایمیل یا نام کاربری" error={errs.login}><input id="auth-login" dir="ltr" autoComplete="username" required value={f.login} onChange={up('login')} className="field mono" /></Field>
              )}
              <Field label="رمز عبور" hint={reg ? 'حداقل ۸ کاراکتر.' : undefined} error={errs.password}>
                <input id="auth-password" type="password" dir="ltr" autoComplete={reg ? 'new-password' : 'current-password'} required value={f.password} onChange={up('password')} className="field mono" />
              </Field>
              {reg && ref && <p className="text-xs text-ok">با کد معرف <span className="mono">{ref}</span> ثبت‌نام می‌کنی.</p>}
              <ErrorLine error={error} errs={errs} />
              <Btn type="submit" size="lg" className="w-full" icon={reg ? UserPlus : LogIn} busy={busy}>{reg ? 'ساخت حساب' : 'ورود'}</Btn>
              {!reg && <Link href="/forgot" className="block text-center text-xs text-silver hover:text-white">رمزت رو فراموش کردی؟</Link>}
            </form>
          )}
        </>
      )}
    </Shell>
  );
}

export function ForgotForm({ email }) {
  const { api } = useStore();
  const [login, setLogin] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/forgot', { method: 'POST', body: { login } });
      setDone(true);
    } catch (err) { setError(err.message); }
    setBusy(false);
  };
  return (
    <Shell title="بازیابی رمز" sub="لینک ساختن رمز جدید به ایمیل حسابت فرستاده می‌شه." foot={<Link href="/login" className="font-bold text-white">برگشت به ورود</Link>}>
      {!email ? (
        <p className="text-sm leading-7 text-silver">ارسال ایمیل هنوز روی سرور تنظیم نشده. برای بازیابی رمز به پشتیبانی پیام بده{' '}یا اگه شماره موبایلت رو تایید کردی، با کد پیامکی وارد شو.</p>
      ) : done ? (
        <p className="text-sm leading-7 text-silver" role="status">اگه حسابی با این مشخصات وجود داشته باشه، لینک بازیابی تا چند دقیقه دیگه به ایمیلش می‌رسه. پوشه اسپم رو هم نگاه کن. لینک یک ساعت اعتبار داره.</p>
      ) : (
        <form className="space-y-4" onSubmit={submit} noValidate>
          <Field label="ایمیل یا نام کاربری"><input id="forgot-login" dir="ltr" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} className="field mono" /></Field>
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <Btn type="submit" size="lg" className="w-full" icon={Mail} busy={busy} disabled={login.trim().length < 3}>ارسال لینک بازیابی</Btn>
        </form>
      )}
    </Shell>
  );
}

export function ResetForm({ token }) {
  const { api } = useStore();
  const [f, setF] = useState({ password: '', again: '' });
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mismatch = f.again && f.password !== f.again;
  const submit = async (e) => {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/reset', { method: 'POST', body: { token, password: f.password } });
      setDone(true);
    } catch (err) { setError(err.message); }
    setBusy(false);
  };
  return (
    <Shell title="ساختن رمز جدید" sub="بعد از ذخیره، از همه دستگاه‌ها خارج می‌شی و با رمز جدید وارد می‌شی.">
      {!token ? <p className="text-sm text-silver">لینک ناقصه. دوباره از صفحه «فراموشی رمز» درخواست بده.</p> : done ? (
        <div className="space-y-4" role="status">
          <p className="text-sm leading-7 text-silver">رمزت عوض شد.</p>
          <Link href="/login" className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand2">ورود با رمز جدید</Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit} noValidate>
          <Field label="رمز جدید" hint="حداقل ۸ کاراکتر."><input id="reset-pass" type="password" dir="ltr" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="field mono" /></Field>
          <Field label="تکرار رمز جدید" error={mismatch ? 'با رمز جدید یکی نیست.' : ''}><input id="reset-again" type="password" dir="ltr" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} className="field mono" /></Field>
          {error && <p className="text-sm text-red-400" role="alert">{error}{' '}<Link href="/forgot" className="font-bold text-white">درخواست لینک جدید</Link></p>}
          <Btn type="submit" size="lg" className="w-full" icon={KeyRound} busy={busy} disabled={f.password.length < 8 || f.password !== f.again}>ذخیره رمز جدید</Btn>
        </form>
      )}
    </Shell>
  );
}
