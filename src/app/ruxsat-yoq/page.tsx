import Link from 'next/link';

export const metadata = { title: 'Ruxsat yo‘q' };

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="max-w-md text-center">
        <p className="eyebrow mb-2">403</p>
        <h1 className="text-stat tracking-[-0.02em]">Bu bo'limga ruxsatingiz yo'q</h1>
        <p className="mt-2 text-body leading-relaxed text-ink2">
          Sizning rolingiz bu sahifani ko'rishga yoki o'zgartirishga imkon bermaydi. Agar bu xato bo'lsa,
          bo'lim boshlig'iga murojaat qiling.
        </p>
        <Link href="/" className="btn-ghost mt-5">
          Bosh sahifaga qaytish
        </Link>
      </div>
    </main>
  );
}
