/**
 * Umumiy UI primitivlari. Barchasi server komponent sifatida ishlaydi
 * (interaktivlik kerak bo'lgan joyda alohida 'use client' fayllar bor).
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
  return <section className={clsx('card', padded && 'p-5', className)}>{children}</section>;
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
    <header className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.006em] text-ink">{title}</h2>
        {note ? <p className="mt-0.5 text-[12.5px] text-muted">{note}</p> : null}
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
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
        {lede ? <p className="mt-2 text-[13.5px] leading-relaxed text-ink2">{lede}</p> : null}
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
  neutral: 'bg-ink/8 text-ink2',
  brand: 'bg-brand/12 text-brand',
  ok: 'bg-ok/12 text-ok',
  warn: 'bg-warn/14 text-warn',
  bad: 'bg-bad/12 text-bad',
  accent: 'bg-accent/12 text-accent',
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
        'inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-semibold',
        TONE_CHIP[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Katta raqamli ko'rsatkich kartochkasi. */
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
    <div className="card p-4">
      <p className="text-[12px] font-medium text-ink2">{label}</p>
      <p className={clsx('tnum mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.025em]', TONE_TEXT[tone])}>
        {value}
      </p>
      {target ? <p className="mt-1.5 text-[11.5px] text-muted">Maqsad: {target}</p> : null}
      {hint ? <p className="mt-1 text-[11.5px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = 'brand',
  height = 8,
}: {
  /** 0..1+ — 1 dan oshsa chegara chizig'i ko'rinadi */
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

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className={clsx('w-full border-collapse', className)}>{children}</table>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-grid px-4 py-10 text-center text-[13px] text-muted">
      {children}
    </div>
  );
}

/** Muhim izoh / ogohlantirish bloki. */
export function Callout({
  children,
  tone = 'brand',
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
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
    <div className={clsx('rounded-r-lg border-l-[3px] bg-raised px-4 py-3', border[tone])}>
      {title ? <p className="mb-1 text-[13px] font-semibold text-ink">{title}</p> : null}
      <div className="text-[12.5px] leading-relaxed text-ink2">{children}</div>
    </div>
  );
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="my-6 border-grid" />;
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="eyebrow whitespace-nowrap">{label}</span>
      <hr className="w-full border-grid" />
    </div>
  );
}
