import clsx from 'clsx';

import type { Checkpoint } from '@/modules/bolimlar/domain';

import { cpStaffSummary, type StaffBlock } from '../domain';

/** Ok/yomon ulushi chizig'i (yashil / qizil). */
function RatioBar({ ok, bad }: { ok: number; bad: number }) {
  const total = ok + bad;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-ink/[0.07]" aria-hidden>
      {total > 0 ? (
        <>
          <span className="bg-ok" style={{ width: `${(ok / total) * 100}%` }} />
          <span className="bg-bad" style={{ width: `${(bad / total) * 100}%` }} />
        </>
      ) : null}
    </div>
  );
}

/** Tekshiruv tafsilotida bitta hodimli nuqta: xulosa jumlasi va hodimlar jadvali. */
export function StaffCpResult({ cp, block }: { cp: Checkpoint; block: StaffBlock | null }) {
  const s = cpStaffSummary(cp, block, cp.id);
  if (!s) return null;
  return (
    <div className="ml-8 mt-2">
      <RatioBar ok={s.totals.ok} bad={s.totals.bad} />
      <p className="tnum mt-1.5 text-meta text-ink2">{s.sentence}</p>
      <table className="mt-2 w-full text-meta">
        <thead className="sr-only">
          <tr>
            <th>Hodim</th>
            <th>Natija</th>
            <th>Sabab</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-grid">
          {s.rows.map((r) => (
            <tr key={r.id} className={clsx(r.bad > 0 && 'text-bad')}>
              <td className="py-1.5 pr-3 font-medium text-ink">{r.name}</td>
              <td className="tnum whitespace-nowrap py-1.5 pr-3">
                {s.kind === 'staff_check'
                  ? r.verdict === 'yes'
                    ? s.labels.ok
                    : r.verdict === 'no'
                      ? s.labels.bad
                      : '—'
                  : `${r.ok} / ${r.bad}`}
              </td>
              <td className="py-1.5 text-ink2">{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {s.kind === 'staff_count' ? (
        <p className="mt-1 text-micro text-muted">
          Son: «{s.labels.ok}» / «{s.labels.bad}»
        </p>
      ) : null}
    </div>
  );
}
