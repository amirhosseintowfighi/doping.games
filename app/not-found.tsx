import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="gutter mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
      <p className="mono text-6xl font-black text-brand2">404</p>
      <h1 className="mt-4 text-xl font-black">این صفحه پیدا نشد</h1>
      <Link href="/" className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black">برگشت به صفحه اصلی</Link>
    </div>
  );
}
