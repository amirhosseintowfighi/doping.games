'use client';
import Link from 'next/link';
import { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { useStore } from '../store.jsx';
import { Btn, Card, Field } from '../ui.jsx';

const safeNext = (n) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/panel');

export default function AuthForm({ mode, next, registration = true }) {
  const { api } = useStore();
  const reg = mode === 'register';
  const [f, setF] = useState({ login: '', email: '', username: '', password: '' });
  const [errs, setErrs] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErrs({ ...errs, [k]: '' }); setError(''); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api(reg ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        body: reg ? { email: f.email, username: f.username, password: f.password } : { login: f.login, password: f.password },
      });
      window.location.href = !reg && r.role === 'admin' && !next ? '/admin' : safeNext(next);
    } catch (err) {
      setErrs(err.fields ?? {});
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="gutter mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-12">
      <h1 className="text-2xl font-black">{reg ? 'ساخت حساب دوپینگ' : 'ورود به حساب'}</h1>
      <p className="mt-1 text-sm text-zinc-500">{reg ? 'با حساب کاربری، اشتراک، کانفیگ اتصال و کیف پولت یک‌جا مدیریت می‌شه.' : 'با ایمیل یا نام کاربری وارد شو.'}</p>
      <Card className="mt-6 p-6">
        {reg && !registration ? (
          <p className="text-sm text-silver">ثبت‌نام در حال حاضر بسته است.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            {reg ? (
              <>
                <Field label="ایمیل" error={errs.email}><input id="auth-email" type="email" dir="ltr" autoComplete="email" required value={f.email} onChange={up('email')} className="field mono" /></Field>
                <Field label="نام کاربری" hint="حروف لاتین، عدد، نقطه یا خط تیره؛ توی سرورهای بازی هم همین دیده می‌شه." error={errs.username}><input id="auth-username" dir="ltr" autoComplete="username" required value={f.username} onChange={up('username')} className="field mono" /></Field>
              </>
            ) : (
              <Field label="ایمیل یا نام کاربری" error={errs.login}><input id="auth-login" dir="ltr" autoComplete="username" required value={f.login} onChange={up('login')} className="field mono" /></Field>
            )}
            <Field label="رمز عبور" hint={reg ? 'حداقل ۸ کاراکتر.' : undefined} error={errs.password}>
              <input id="auth-password" type="password" dir="ltr" autoComplete={reg ? 'new-password' : 'current-password'} required value={f.password} onChange={up('password')} className="field mono" />
            </Field>
            {error && !Object.values(errs).some(Boolean) && <p className="text-sm text-red-400" role="alert">{error}</p>}
            <Btn type="submit" size="lg" className="w-full" icon={reg ? UserPlus : LogIn} busy={busy}>{reg ? 'ساخت حساب' : 'ورود'}</Btn>
          </form>
        )}
      </Card>
      <p className="mt-4 text-center text-sm text-zinc-500">
        {reg ? <>حساب داری؟ <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-white">وارد شو</Link></> : <>حساب نداری؟ <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-white">ثبت‌نام کن</Link></>}
      </p>
    </div>
  );
}
