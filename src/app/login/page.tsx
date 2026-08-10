import type { Metadata } from 'next';

import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Kirish' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ keyin?: string }>;
}) {
  const { keyin } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-7">
          <p className="eyebrow mb-2">iPOST · Sifat nazorati bo'limi</p>
          <h1 className="text-[25px] font-semibold leading-tight tracking-[-0.022em]">
            KPI va nazorat tizimi
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink2">
            Kunlik reyestr, KPI hisobi va audit natijalari — rahbariyat nazoratida.
          </p>
        </div>

        <div className="card p-6">
          <LoginForm next={keyin} />
        </div>

        <p className="mt-5 text-center text-[11.5px] leading-relaxed text-muted">
          Login va parolni bo'lim boshlig'i beradi.
          <br />
          Birinchi kirishdan keyin parolni almashtirish tavsiya etiladi.
        </p>
      </div>
    </main>
  );
}
