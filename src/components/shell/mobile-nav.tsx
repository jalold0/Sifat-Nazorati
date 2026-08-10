'use client';

import { useState } from 'react';

import { Nav, type NavItem } from './nav';

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost"
        aria-expanded={open}
        aria-label="Menyu"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
        Menyu
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal>
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
            aria-label="Yopish"
          />
          <div className="relative z-10 h-full w-[264px] overflow-y-auto border-r border-line bg-surface p-4">
            <div onClick={() => setOpen(false)}>
              <Nav items={items} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
