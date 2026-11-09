import clsx from 'clsx';

import type { Status } from '@/modules/hisobot/domain';


/** Rang + matn (faqat rangga tayanilmaydi). */
export const STATUS_TEXT: Record<Status | 'info', string> = {
  green: 'Me‘yorda',
  yellow: 'Diqqat',
  red: 'Qizil',
  gray: 'Ma‘lumot yo‘q',
  info: 'Ma‘lumot',
};

export const STATUS_DOT: Record<Status | 'info', string> = {
  green: 'bg-ok',
  yellow: 'bg-warn',
  red: 'bg-bad',
  gray: 'bg-muted/50',
  info: 'bg-brand',
};

export const STATUS_TEXT_COLOR: Record<Status | 'info', string> = {
  green: 'text-ok',
  yellow: 'text-warn',
  red: 'text-bad',
  gray: 'text-muted',
  info: 'text-ink',
};

export function StatusDot({ status, className }: { status: Status | 'info'; className?: string }) {
  return <span aria-hidden className={clsx('inline-block h-2.5 w-2.5 shrink-0 rounded-full', STATUS_DOT[status], className)} />;
}

export function StatusLabel({ status }: { status: Status | 'info' }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-meta font-semibold', STATUS_TEXT_COLOR[status])}>
      <StatusDot status={status} />
      {STATUS_TEXT[status]}
    </span>
  );
}
