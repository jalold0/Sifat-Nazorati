'use client';

/**
 * Hodimlar kesimida kiritish: smenadagilar, har hodim Ha/Yo'q yoki son, jonli xulosa.
 * Hisob mantig'i bu yerda YO'Q — src/qc/staff.ts (sof) ishlatiladi.
 */

import clsx from 'clsx';

import type { StaffDto } from '@/server/qc';

import { cpTotals, fmtPct, type StaffCell } from '@/modules/auditlar/domain';
import { type Checkpoint, kindLabels } from '@/modules/bolimlar/domain';

/** Kiritish holatidagi yacheyka: son maydonlari matn (bo'sh bo'lishi mumkin). */
export type CellDraft = { v?: 'yes' | 'no'; ok?: string; bad?: string; reason?: string };

const num = (s: string | undefined) => (s === undefined || s.trim() === '' ? null : Number(s));

/** Qoralama → server yacheykasi. To'ldirilmagan bo'lsa null. */
export function toCell(kind: Checkpoint['kind'], d: CellDraft | undefined): StaffCell | null {
  if (!d) return null;
  const reason = d.reason?.trim() || undefined;
  if (kind === 'staff_check') {
    if (!d.v) return null;
    return reason ? { v: d.v, reason } : { v: d.v };
  }
  const ok = num(d.ok);
  const bad = num(d.bad);
  if (ok === null && bad === null) return null;
  // Bitta maydon bo'sh qoldirilsa — 0 (tez kiritish uchun)
  return { ok: ok ?? 0, bad: bad ?? 0, ...(reason ? { reason } : {}) };
}

export function cellFailed(kind: Checkpoint['kind'], d: CellDraft | undefined): boolean {
  if (kind === 'staff_check') return d?.v === 'no';
  const bad = num(d?.bad);
  return bad !== null && bad > 0;
}

// ── Smenada kim bor ──────────────────────────────────────────────────────────

export function ShiftRoster({
  staff,
  present,
  onChange,
}: {
  staff: StaffDto[];
  present: string[];
  onChange: (ids: string[]) => void;
}) {
  const on = new Set(present);
  if (staff.length === 0) {
    return (
      <section className="card mt-5 p-3.5">
        <h2 className="text-body font-semibold">Smenada kim bor</h2>
        <p className="mt-1 text-meta text-ink2">
          Bu bo‘limda hodimlar ro‘yxati yo‘q. Rahbar uni Sozlamalar → bo‘lim sahifasida qo‘shadi; shungacha hodimli
          nuqtalarni «Tegishli emas» deb belgilang.
        </p>
      </section>
    );
  }
  return (
    <section className="card mt-5 p-3.5" aria-labelledby="shift-h">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="shift-h" className="text-body font-semibold">
          Smenada kim bor <span className="tnum font-normal text-muted">{present.length} / {staff.length}</span>
        </h2>
        <span className="flex gap-1 text-meta">
          <button type="button" className="min-h-[36px] rounded-md px-2 text-brand hover:bg-raised" onClick={() => onChange(staff.map((s) => s.id))}>
            Hammasi
          </button>
          <button type="button" className="min-h-[36px] rounded-md px-2 text-brand hover:bg-raised" onClick={() => onChange([])}>
            Hech kim
          </button>
        </span>
      </div>
      <p className="mt-0.5 text-micro text-muted">Kelmaganlarni olib tashlang — ular natijaga kirmaydi.</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {staff.map((s) => {
          const active = on.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? present.filter((x) => x !== s.id) : [...present, s.id])}
              className={clsx(
                'min-h-[40px] rounded-full border px-3 text-meta font-medium transition',
                active ? 'border-ink bg-ink text-plane' : 'border-line bg-surface text-muted line-through decoration-muted/60 hover:bg-raised',
              )}
              title={s.role || undefined}
            >
              {s.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Hodimli nuqta kartasi ────────────────────────────────────────────────────

export function StaffCard({
  index,
  cp,
  people,
  cells,
  na,
  onCell,
  onAll,
  onNa,
}: {
  index: number;
  cp: Checkpoint;
  people: StaffDto[];
  cells: Record<string, CellDraft>;
  na: boolean;
  onCell: (personId: string, patch: Partial<CellDraft>) => void;
  onAll: () => void;
  onNa: (na: boolean) => void;
}) {
  const labels = kindLabels(cp);
  const kind = cp.kind;
  const filled: Record<string, StaffCell> = {};
  for (const p of people) {
    const c = toCell(kind, cells[p.id]);
    if (c) filled[p.id] = c;
  }
  const t = cpTotals(filled);
  const total = t.ok + t.bad;
  const pct = total > 0 ? (t.ok / total) * 100 : null;
  const missing = people.length - Object.keys(filled).length;

  return (
    <li className={clsx('card p-3.5', !na && t.bad > 0 && 'border-bad/50')}>
      <div className="flex items-start gap-2">
        <span className="tnum mt-0.5 text-meta font-semibold text-muted">{index}.</span>
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium">{cp.text}</p>
          <p className="mt-0.5 text-micro text-muted">
            Har hodim bo‘yicha: {kind === 'staff_check' ? `${labels.ok} yoki ${labels.bad}` : `«${labels.ok}» va «${labels.bad}» soni`}
          </p>
        </div>
        {cp.critical ? <span className="shrink-0 rounded-md bg-bad px-2 py-0.5 text-micro font-semibold text-white">Jiddiy</span> : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-meta">
        {kind === 'staff_check' && !na && people.length > 0 ? (
          <button type="button" className="btn-ghost min-h-[36px] px-3" onClick={onAll}>
            Hammasiga «{labels.ok}»
          </button>
        ) : null}
        <button
          type="button"
          aria-pressed={na}
          className={clsx('min-h-[36px] rounded-lg border px-3 font-semibold', na ? 'border-ink2 bg-ink2 text-plane' : 'border-line bg-surface text-ink2 hover:bg-raised')}
          onClick={() => onNa(!na)}
        >
          Tegishli emas
        </button>
      </div>

      {na ? null : people.length === 0 ? (
        <p className="mt-3 text-meta text-muted">Smenada hech kim belgilanmagan — yuqorida hodimlarni tanlang yoki «Tegishli emas».</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-grid">
            {people.map((p) => {
              const c = cells[p.id] ?? {};
              const failed = cellFailed(kind, c);
              return (
                <li key={p.id} className={clsx('py-2', failed && '-mx-1.5 rounded-lg bg-bad/5 px-1.5')}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <p className="min-w-[9rem] flex-1 text-body">
                      {p.name}
                      {p.role ? <span className="ml-1.5 text-micro text-muted">{p.role}</span> : null}
                    </p>
                    {kind === 'staff_check' ? (
                      <div role="group" aria-label={`${p.name}: ${cp.text}`} className="grid grid-cols-2 gap-1.5">
                        {(['yes', 'no'] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            aria-pressed={c.v === v}
                            onClick={() => onCell(p.id, { v })}
                            className={clsx(
                              'min-h-[40px] min-w-[7.5rem] rounded-lg border px-3 text-meta font-semibold transition',
                              c.v === v
                                ? v === 'yes'
                                  ? 'border-ok bg-ok text-white'
                                  : 'border-bad bg-bad text-white'
                                : 'border-line bg-surface text-ink hover:bg-raised',
                            )}
                          >
                            {v === 'yes' ? labels.ok : labels.bad}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <CountField id={`${cp.id}-${p.id}-ok`} label={labels.ok} value={c.ok} onChange={(ok) => onCell(p.id, { ok })} />
                        <CountField id={`${cp.id}-${p.id}-bad`} label={labels.bad} value={c.bad} tone="bad" onChange={(bad) => onCell(p.id, { bad })} />
                      </div>
                    )}
                  </div>
                  {failed ? (
                    <input
                      aria-label={`${p.name}: sabab — ${cp.text}`}
                      className="field mt-1.5 min-h-[40px]"
                      placeholder={`Sabab (majburiy): nega «${labels.bad}»?`}
                      maxLength={500}
                      value={c.reason ?? ''}
                      onChange={(e) => onCell(p.id, { reason: e.target.value })}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="mt-2 border-t border-grid pt-2.5" aria-live="polite">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-ink/[0.07]" aria-hidden>
              {total > 0 ? (
                <>
                  <span className="bg-ok" style={{ width: `${(t.ok / total) * 100}%` }} />
                  <span className="bg-bad" style={{ width: `${(t.bad / total) * 100}%` }} />
                </>
              ) : null}
            </div>
            <p className="tnum mt-1.5 text-meta text-ink2">
              {total === 0
                ? 'Hali natija yo‘q'
                : kind === 'staff_check'
                  ? `${labels.ok}: ${t.ok} / ${t.rated} hodim · ${fmtPct(pct)}`
                  : `Jami ${total}: ${labels.ok} ${t.ok}, ${labels.bad} ${t.bad} · ${fmtPct(pct)}${t.failing > 0 ? ` · ${t.failing} hodimda` : ''}`}
              {missing > 0 && total > 0 ? <span className="text-muted"> · {missing} ta hodim kiritilmagan</span> : null}
            </p>
          </div>
        </>
      )}
    </li>
  );
}

function CountField({
  id,
  label,
  value,
  tone,
  onChange,
}: {
  id: string;
  label: string;
  value: string | undefined;
  tone?: 'bad';
  onChange: (v: string) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-1.5 text-micro text-ink2">
      <span className="max-w-[6.5rem] leading-tight">{label}</span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        className={clsx('field tnum min-h-[40px] w-[4.5rem] px-2 text-right', tone === 'bad' && Number(value) > 0 && 'border-bad/60 text-bad')}
        placeholder="0"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
