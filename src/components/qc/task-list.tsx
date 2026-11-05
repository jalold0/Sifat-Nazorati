import clsx from 'clsx';
import Link from 'next/link';

import { Badge, Empty } from '@/components/ui';
import { date as fmtDate } from '@/lib/format';
import type { DeptDto, TaskDto } from '@/server/qc';

import { CloseTaskForm } from './close-task-form';

/** Topshiriqlar ro'yxati: bo'lim, nima, mas'ul, muddat, qaysi nuqtadan. Muddati o'tgani qizil. */
export function TaskList({
  tasks,
  departments,
  today,
  canClose,
  showDept = true,
  emptyText = 'Topshiriq yo‘q',
}: {
  tasks: TaskDto[];
  departments: DeptDto[];
  today: string;
  canClose: boolean;
  showDept?: boolean;
  emptyText?: string;
}) {
  if (tasks.length === 0) return <Empty>{emptyText}</Empty>;
  const byDept = new Map(departments.map((d) => [d.id, d]));

  return (
    <ul className="space-y-2.5">
      {tasks.map((t) => {
        const dept = byDept.get(t.dept);
        const cp = dept?.checkpoints.find((c) => c.id === t.cp);
        const overdue = t.status === 'open' && t.due < today;
        return (
          <li key={t.id} className={clsx('card p-3.5', overdue && 'border-bad/60')}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {showDept ? <p className="eyebrow">{dept?.name ?? 'Bo‘lim'}</p> : null}
                <p className="mt-0.5 text-body font-semibold">{t.what}</p>
              </div>
              <Badge tone={overdue ? 'bad' : t.status === 'closed' ? 'ok' : 'neutral'}>
                {overdue ? 'Muddati o‘tgan' : t.status === 'closed' ? 'Yopilgan' : 'Ochiq'}
              </Badge>
            </div>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-meta sm:grid-cols-3">
              <div>
                <dt className="text-muted">Mas‘ul</dt>
                <dd className="font-medium">{t.owner}</dd>
              </div>
              <div>
                <dt className="text-muted">Muddat</dt>
                <dd className={clsx('tnum font-medium', overdue && 'text-bad')}>{fmtDate(t.due)}</dd>
              </div>
              <div>
                <dt className="text-muted">Qaysi nuqtadan</dt>
                <dd className="font-medium">
                  {cp?.text ?? t.cp}{' '}
                  {canClose || showDept ? (
                    <Link href={`/tarix/${t.audit}`} className="whitespace-nowrap text-brand underline-offset-2 hover:underline">
                      tekshiruv
                    </Link>
                  ) : null}
                </dd>
              </div>
            </dl>
            {t.status === 'closed' ? (
              <p className="mt-2 rounded-tile bg-raised px-3 py-2 text-meta text-ink2">
                Qayta tekshirildi{t.closedAt ? ` (${fmtDate(t.closedAt)})` : ''}
                {t.checkedByName ? `, ${t.checkedByName}` : ''}: {t.checkNote}
              </p>
            ) : canClose ? (
              <div className="mt-3">
                <CloseTaskForm taskId={t.id} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
