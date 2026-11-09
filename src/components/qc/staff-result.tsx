import clsx from 'clsx';

import { Card, CardHead } from '@/components/ui';
import type { Checkpoint, InteractionRow } from '@/qc/calc';
import { CHANNELS, isChannel } from '@/qc/lists';
import { cpStaffSummary, fmtPct, isStaffKind, kindLabels, type StaffBlock, type StaffBreakdownRow } from '@/qc/staff';

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

/** Davr hisobotida muloqot bahosi: har operator — soni, o'rtacha ball, jiddiy, eng zaif mezonlar. */
export function InteractionCard({ rows }: { rows: InteractionRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHead
        title="Operatorlar: muloqot bahosi"
        note="Baholangan qo‘ng‘iroq va yozishmalar bo‘yicha. Jiddiy holatli muloqot bali 0 hisoblanadi; eng past natija tepada."
      />
      <ul className="divide-y divide-grid">
        {rows.map((r) => (
          <li key={r.staffId} className="py-2.5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="min-w-[10rem] flex-1 text-body font-semibold">{r.name}</p>
              <span className={clsx('tnum text-body font-semibold', r.critical > 0 || (r.avgPct ?? 100) < 85 ? 'text-bad' : 'text-ok')}>
                {fmtPct(r.avgPct)}
              </span>
              <span className="tnum text-meta text-ink2">{r.count} ta muloqot</span>
              {r.critical > 0 ? <span className="rounded-md bg-bad px-2 py-0.5 text-micro font-semibold text-white">Jiddiy: {r.critical}</span> : null}
            </div>
            <p className="mt-0.5 text-micro text-muted">
              {Object.entries(r.channels)
                .map(([ch, n]) => `${isChannel(ch) ? CHANNELS[ch] : ch} ${n}`)
                .join(', ')}
            </p>
            {r.weakest.length > 0 ? (
              <p className="mt-1 text-meta text-ink2">
                Ko‘p yiqilgan:{' '}
                {r.weakest.map((w, i) => (
                  <span key={w.id}>
                    {i > 0 ? '; ' : ''}
                    {w.text} <span className="tnum text-bad">({w.no})</span>
                  </span>
                ))}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-micro text-muted">Operator haqida xulosa kamida 10 ta muloqotdan keyin chiqariladi.</p>
    </Card>
  );
}

/** Davr hisobotida: har hodim bo'yicha natija, eng zaifi tepada. */
export function StaffBreakdownCard({ rows, checkpoints }: { rows: StaffBreakdownRow[]; checkpoints: Checkpoint[] }) {
  const cps = checkpoints.filter((c) => isStaffKind(c.kind) && rows.some((r) => r.byCp[c.id]));
  if (cps.length === 0) return null;
  return (
    <Card>
      <CardHead title="Hodimlar kesimida" note="Davrdagi tekshiruvlar bo‘yicha. Eng zaif natija tepada." />
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[520px] text-meta">
          <thead>
            <tr className="text-left text-micro text-muted">
              <th className="px-1 pb-2 font-medium">Hodim</th>
              <th className="px-1 pb-2 text-right font-medium">Ulush</th>
              {cps.map((c) => (
                <th key={c.id} className="px-1 pb-2 text-right font-medium" title={c.text}>
                  {c.text.length > 28 ? `${c.text.slice(0, 27)}…` : c.text}
                </th>
              ))}
              <th className="px-1 pb-2 text-right font-medium">Tekshiruv</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-grid">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-1 py-2 font-medium">{r.name}</td>
                <td className={clsx('tnum px-1 py-2 text-right font-semibold', r.bad > 0 ? 'text-bad' : 'text-ok')}>{fmtPct(r.pct)}</td>
                {cps.map((c) => {
                  const v = r.byCp[c.id];
                  const l = kindLabels(c);
                  return (
                    <td key={c.id} className="tnum px-1 py-2 text-right text-ink2" title={`${l.ok} / ${l.bad}`}>
                      {v ? (
                        <>
                          {v.ok}
                          <span className="text-muted"> / </span>
                          <span className={clsx(v.bad > 0 && 'font-semibold text-bad')}>{v.bad}</span>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="tnum px-1 py-2 text-right text-muted">{r.audits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-micro text-muted">Har ustunda: yaxshi / yomon (nuqta yorlig‘i ustiga olib boring).</p>
    </Card>
  );
}
