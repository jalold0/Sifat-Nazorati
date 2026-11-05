'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface TopNavItem {
  href: string;
  label: string;
}

/** Yuqori navigatsiya: 1–5 ta qisqa bo'lim. Telefonda qatorga sig'masa pastga o'raladi (gorizontal skroll yo'q). */
export function TopNav({ items }: { items: TopNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Asosiy" className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'inline-flex min-h-[44px] items-center rounded-lg px-3.5 text-meta font-semibold transition',
              active ? 'bg-ink text-plane' : 'text-ink2 hover:bg-raised hover:text-ink',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
