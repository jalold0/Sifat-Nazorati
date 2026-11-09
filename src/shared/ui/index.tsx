/**
 * Umumiy UI primitivlari.
 *
 * Barcha o'lchamlar `tailwind.config.ts` dagi nomlangan shkaladan olinadi
 * (text-display / title / stat / body / meta / label / micro) — sahifalarda
 * tarqoq px qiymatlar ishlatilmaydi, shuning uchun ierarxiya bir xil qoladi.
 */

import clsx from 'clsx';
import type { ReactNode } from 'react';

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <section className={clsx('card', padded && 'p-card', className)}>{children}</section>;
}

export function CardHead({
  title,
  note,
  right,
}: {
  title: string;
  note?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
      <div className="min-w-0 max-w-3xl">
        <h2 className="text-title text-ink">{title}</h2>
        {note ? <p className="mt-1 text-meta text-muted">{note}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  );
}

export function PageHead({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-section flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="max-w-[62ch]">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="text-display text-ink">{title}</h1>
        {lede ? <p className="mt-2.5 text-body text-ink2">{lede}</p> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'bad' | 'accent';

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink',
  brand: 'text-brand',
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
  accent: 'text-accent',
};

const TONE_CHIP: Record<Tone, string> = {
  neutral: 'bg-ink/[0.06] text-ink2',
  brand: 'bg-brand/10 text-brand',
  ok: 'bg-ok/10 text-ok',
  warn: 'bg-warn/12 text-warn',
  bad: 'bg-bad/10 text-bad',
  accent: 'bg-accent/10 text-accent',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center whitespace-nowrap rounded-md px-2 py-[3px] text-micro font-semibold',
        TONE_CHIP[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Katta raqamli ko'rsatkich.
 * Ierarxiya: yorliq (kichik) → qiymat (katta) → maqsad → izoh.
 * Maqsad va izoh bir-biridan ajratilgan, chunki maqsad — o'lchov mezoni,
 * izoh esa qo'shimcha tafsilot.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  target,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  target?: string;
}) {
  return (
    <div className="card flex flex-col p-4">
      <p className="text-meta text-ink2">{label}</p>
      <p className={clsx('tnum mt-2 text-stat', TONE_TEXT[tone])}>{value}</p>
      <div className="mt-auto">
        {target ? (
          <p className="mt-2.5 text-micro text-muted">
            Maqsad <span className="tnum font-semibold text-ink2">{target}</span>
          </p>
        ) : null}
        {hint ? <p className="mt-1 text-micro text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  tone = 'brand',
  height = 6,
}: {
  /** 0..1+ — 1 dan oshsa chegara buzilgani ko'rinadi */
  value: number;
  tone?: Tone;
  height?: number;
}) {
  const filled = Math.max(0, Math.min(value, 1));
  const over = value > 1;
  const bg: Record<Tone, string> = {
    neutral: 'var(--ink2)',
    brand: 'var(--brand)',
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    bad: 'var(--bad)',
    accent: 'var(--accent)',
  };
  return (
    <div className="w-full overflow-hidden rounded-full bg-grid" style={{ height }}>
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${filled * 100}%`, background: over ? 'var(--bad)' : bg[tone] }}
      />
    </div>
  );
}

/**
 * Jadval o'ramasi. Uzun jadvallarda `stickyHead` sarlavhani yopishtirib qo'yadi,
 * `maxHeight` esa sahifani cho'zib ketmasligi uchun ichki aylantirishni yoqadi.
 */
export function Table({
  children,
  className,
  stickyHead = false,
  maxHeight,
}: {
  children: ReactNode;
  className?: string;
  stickyHead?: boolean;
  maxHeight?: number;
}) {
  return (
    <div
      // `table-scroll` — chop etishda balandlik cheklovi bekor qilinishi uchun (globals.css)
      className={clsx('-mx-1 overflow-x-auto px-1', maxHeight && 'table-scroll overflow-y-auto')}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table
        className={clsx(
          'w-full border-collapse',
          stickyHead && '[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10',
          className,
        )}
      >
        {children}
      </table>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Muhim izoh / ogohlantirish bloki. */
export function Callout({
  children,
  tone = 'brand',
  title,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
  className?: string;
}) {
  const border: Record<Tone, string> = {
    neutral: 'border-l-ink2',
    brand: 'border-l-brand',
    ok: 'border-l-ok',
    warn: 'border-l-warn',
    bad: 'border-l-bad',
    accent: 'border-l-accent',
  };
  return (
    <div
      className={clsx(
        'mt-section rounded-r-tile border-l-[3px] bg-raised px-4 py-3.5',
        border[tone],
        className,
      )}
    >
      {title ? <p className="mb-1 text-body font-semibold text-ink">{title}</p> : null}
      <div className="text-meta leading-relaxed text-ink2">{children}</div>
    </div>
  );
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="my-section border-grid" />;
  return (
    <div className="my-section flex items-center gap-3">
      <span className="eyebrow whitespace-nowrap">{label}</span>
      <hr className="w-full border-grid" />
    </div>
  );
}

/**
 * Sahifa bo'limlari orasidagi bir xil masofa.
 * Har joyda `mt-4` yozish o'rniga bitta qoida.
 */
export function Stack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('space-y-section', className)}>{children}</div>;
}
