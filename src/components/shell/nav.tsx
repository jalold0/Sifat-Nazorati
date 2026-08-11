'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  group: string;
}

const ICONS = {
  dashboard: 'M3 12h6V3H3v9Zm8 9h6V9h-6v12ZM3 21h6v-6H3v6Zm8-14h6V3h-6v4Z',
  registry: 'M4 4h16v4H4V4Zm0 6h16v4H4v-4Zm0 6h16v4H4v-4Z',
  kpi: 'M4 20V10m5 10V4m5 16v-7m5 7V7',
  audit: 'M4 5h16M4 12h10M4 19h7m4-2 2 2 4-4',
  capacity: 'M12 3a9 9 0 1 0 9 9h-9V3Z',
  report: 'M6 2h9l5 5v15H6V2Zm9 0v5h5M9 13h6M9 17h6',
  solution: 'M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M3 12h3m12 0h3M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1',
  review: 'M4 6h16M4 12h16M4 18h10m4 2 3-3-3-3',
  tasks: 'M4 6h2m4 0h10M4 12h2m4 0h10M4 18h2m4 0h10',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.2-1.8l2-1.5-2-3.4-2.3 1a8 8 0 0 0-3-1.7L14 2h-4l-.5 2.6a8 8 0 0 0-3 1.7l-2.3-1-2 3.4 2 1.5A8 8 0 0 0 4 12c0 .6.1 1.2.2 1.8l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 3 1.7L10 22h4l.5-2.6a8 8 0 0 0 3-1.7l2.3 1 2-3.4-2-1.5c.1-.6.2-1.2.2-1.8Z',
  log: 'M12 8v4l3 2m-3 8a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z',
  baseline: 'M3 17V7m0 10h18M7 17v-5m4 5V9m4 8v-7m4 7V5',
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const groups = [...new Set(items.map((i) => i.group))];

  return (
    <nav className="space-y-5">
      {groups.map((group) => (
        <div key={group}>
          <p className="eyebrow mb-1.5 px-3">{group}</p>
          <ul className="space-y-0.5">
            {items
              .filter((i) => i.group === group)
              .map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={clsx(
                        'flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-meta font-medium transition',
                        active
                          ? 'bg-ink text-plane'
                          : 'text-ink2 hover:bg-raised hover:text-ink',
                      )}
                    >
                      <Icon name={item.icon} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
