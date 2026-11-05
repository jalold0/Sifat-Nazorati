import Link from 'next/link';

import { logoutAction } from '@/app/login/actions';
import { TopNav } from '@/components/qc/top-nav';
import { requireActor } from '@/lib/auth';
import { homePath, navFor, QC_ROLE_LABEL } from '@/qc/policy';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const items = navFor(actor.role).map(({ href, label }) => ({ href, label }));

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <Link href={homePath(actor.role)} className="flex min-h-[44px] items-center text-title">
            iPOST · Sifat nazorati
          </Link>
          <div className="flex items-center gap-3 text-right">
            <div className="leading-tight">
              <p className="text-meta font-semibold">{actor.name}</p>
              <p className="text-micro text-muted">{QC_ROLE_LABEL[actor.role]}</p>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="btn-ghost min-h-[44px]">
                Chiqish
              </button>
            </form>
          </div>
          <div className="w-full">
            <TopNav items={items} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-5 sm:py-8">{children}</main>
    </div>
  );
}
