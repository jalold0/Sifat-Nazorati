import Link from 'next/link';

import { logoutAction } from '@/app/login/actions';
import { MobileNav } from '@/components/shell/mobile-nav';
import { Nav, type NavItem } from '@/components/shell/nav';
import { requireSession, ROLE_LABEL } from '@/lib/auth';
import type { Role } from '@/lib/session';

const ALL_ITEMS: Array<NavItem & { roles: Role[] }> = [
  { href: '/dashboard', label: 'Boshqaruv paneli', icon: 'dashboard', group: 'Nazorat', roles: ['CEO', 'HEAD', 'SPECIALIST', 'VIEWER'] },
  { href: '/kpi', label: 'KPI hisobi', icon: 'kpi', group: 'Nazorat', roles: ['CEO', 'HEAD', 'SPECIALIST', 'VIEWER'] },
  { href: '/hisobot', label: 'Oylik hisobot', icon: 'report', group: 'Nazorat', roles: ['CEO', 'HEAD', 'SPECIALIST', 'VIEWER'] },
  { href: '/reyestr', label: 'Kunlik reyestr', icon: 'registry', group: 'Ish', roles: ['CEO', 'HEAD', 'SPECIALIST', 'VIEWER'] },
  { href: '/audit', label: 'Checklist auditlari', icon: 'audit', group: 'Ish', roles: ['CEO', 'HEAD', 'SPECIALIST', 'VIEWER'] },
  { href: '/yechimlar', label: 'Tizimli yechimlar', icon: 'solution', group: 'Ish', roles: ['CEO', 'HEAD', 'SPECIALIST', 'VIEWER'] },
  { href: '/tekshiruv', label: "Tekshirish ro'yxati", icon: 'review', group: 'Ish', roles: ['CEO', 'HEAD', 'SPECIALIST'] },
  { href: '/quvvat', label: 'Quvvat hisobi', icon: 'capacity', group: 'Tahlil', roles: ['CEO', 'HEAD', 'VIEWER'] },
  { href: '/baseline', label: 'Telegram baseline', icon: 'baseline', group: 'Tahlil', roles: ['CEO', 'HEAD', 'SPECIALIST', 'VIEWER'] },
  { href: '/taqsimot', label: 'Ish taqsimoti', icon: 'tasks', group: 'Tahlil', roles: ['CEO', 'HEAD', 'SPECIALIST', 'VIEWER'] },
  { href: '/izlar', label: "O'zgarishlar izi", icon: 'log', group: 'Tahlil', roles: ['CEO', 'HEAD'] },
  { href: '/sozlamalar', label: 'Sozlamalar', icon: 'settings', group: 'Tahlil', roles: ['CEO', 'HEAD'] },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const items: NavItem[] = ALL_ITEMS.filter((i) => i.roles.includes(session.role)).map(
    ({ roles: _roles, ...item }) => item,
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="border-b border-line px-5 py-4">
          <Link href="/dashboard" className="block">
            <p className="text-title">iPOST · OTK</p>
            <p className="mt-0.5 text-micro text-muted">Sifat nazorati KPI tizimi</p>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-4">
          <Nav items={items} />
        </div>

        <div className="border-t border-line px-4 py-3.5">
          <p className="truncate text-meta font-semibold text-ink">{session.name}</p>
          <p className="mb-2 text-micro text-muted">{ROLE_LABEL[session.role]}</p>
          <form action={logoutAction}>
            <button type="submit" className="text-micro font-semibold text-muted transition hover:text-bad">
              Chiqish
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/92 px-4 py-2.5 backdrop-blur lg:hidden">
          <MobileNav items={items} />
          <div className="text-right">
            <p className="text-meta font-semibold leading-tight">{session.name}</p>
            <p className="text-micro text-muted">{ROLE_LABEL[session.role]}</p>
          </div>
        </header>

        <main className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
