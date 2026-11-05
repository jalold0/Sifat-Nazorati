'use client';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { DeptDto } from '@/server/qc';

import { saveDepartmentAction } from '../actions';

interface Row {
  key: string;
  id?: string;
  text: string;
  group: string | null;
  weight: number;
  critical: boolean;
  active: boolean;
}

let counter = 0;
const newKey = () => `n${++counter}`;

export function DeptForm({ dept }: { dept: DeptDto | null }) {
  const router = useRouter();
  const [name, setName] = useState(dept?.name ?? '');
  const [norm, setNorm] = useState(String(dept?.norm ?? 90));
  const [confirmed, setConfirmed] = useState(dept ? !dept.estimate : false);
  const [active, setActive] = useState(dept?.active ?? true);
  const [rows, setRows] = useState<Row[]>(
    dept
      ? dept.checkpoints.map((c) => ({
          key: c.id,
          id: c.id,
          text: c.text,
          group: c.group ?? null,
          weight: c.weight,
          critical: c.critical,
          active: c.active,
        }))
      : [{ key: newKey(), text: '', group: null, weight: 1, critical: false, active: true }],
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const patch = (key: string, p: Partial<Row>) => {
    setSaved(false);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  };
  const move = (i: number, dir: -1 | 1) => {
    setSaved(false);
    setRows((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j] as Row, next[i] as Row];
      return next;
    });
  };

  function submit() {
    setError(null);
    setSaved(false);
    start(async () => {
      try {
        const r = await saveDepartmentAction({
          id: dept?.id,
          name,
          norm: Number(norm),
          estimate: !confirmed,
          active,
          checkpoints: rows.map((x) => ({
            id: x.id,
            text: x.text,
            group: x.group,
            weight: x.weight,
            critical: x.critical,
            active: x.active,
          })),
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        if (!dept) {
          router.push(`/sozlamalar/${r.id}`);
          return;
        }
        setSaved(true);
        router.refresh();
      } catch {
        setError('Aloqa yo‘q, saqlanmadi. Aloqa tiklangach qayta urinib ko‘ring.');
      }
    });
  }

  return (
    <div className="space-y-5 pb-24">
      <section className="card grid gap-4 p-card sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="name">
            Bo‘lim nomi
          </label>
          <input id="name" className="field min-h-[44px]" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="norm">
            Umumiy ball me‘yori, %
          </label>
          <input
            id="norm"
            type="number"
            min={1}
            max={100}
            inputMode="numeric"
            className="field min-h-[44px]"
            value={norm}
            onChange={(e) => setNorm(e.target.value)}
          />
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex min-h-[44px] items-center gap-3 text-body">
            <input type="checkbox" className="h-5 w-5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            Me‘yor tasdiqlandi {confirmed ? '' : '(hozir «taxminiy»)'}
          </label>
          <label className="flex min-h-[44px] items-center gap-3 text-body">
            <input type="checkbox" className="h-5 w-5" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Faol (panelda va tekshiruvda ko‘rinadi)
          </label>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-title">Nuqtalar</h2>
        <p className="mb-3 text-meta text-muted">
          Savol «Ha» yaxshi degan ma‘noda yozilsin. Nuqta o‘chirilmaydi — «Yashirish» eski tekshiruvlarni saqlab qoladi.
        </p>
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.key} className={clsx('card p-3.5', !r.active && 'opacity-60')}>
              <div className="flex items-start gap-2">
                <span className="tnum mt-3 w-6 text-meta text-muted">{i + 1}.</span>
                <textarea
                  aria-label={`Nuqta ${i + 1} matni`}
                  className="field min-h-[56px] flex-1"
                  value={r.text}
                  onChange={(e) => patch(r.key, { text: e.target.value })}
                />
                <span className="flex flex-col gap-1">
                  <button type="button" className="btn-ghost h-11 w-11 px-0" aria-label="Yuqoriga" disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button type="button" className="btn-ghost h-11 w-11 px-0" aria-label="Pastga" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </button>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 pl-8">
                <label className="flex min-h-[44px] items-center gap-2 text-meta">
                  Og‘irlik
                  <select
                    className="field min-h-[44px] w-20"
                    value={r.weight}
                    onChange={(e) => patch(r.key, { weight: Number(e.target.value) })}
                  >
                    {[1, 2, 3].map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-h-[44px] items-center gap-2 text-meta">
                  <input type="checkbox" className="h-5 w-5" checked={r.critical} onChange={(e) => patch(r.key, { critical: e.target.checked })} />
                  Jiddiy
                </label>
                <label className="flex min-h-[44px] items-center gap-2 text-meta">
                  <input type="checkbox" className="h-5 w-5" checked={!r.active} onChange={(e) => patch(r.key, { active: !e.target.checked })} />
                  Yashirish
                </label>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="btn-ghost mt-3 min-h-[44px]"
          onClick={() => {
            setSaved(false);
            setRows((rs) => [...rs, { key: newKey(), text: '', group: null, weight: 1, critical: false, active: true }]);
          }}
        >
          + Nuqta qo‘shish
        </button>
      </section>

      <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-[1100px] px-4 py-2.5">
          {error ? (
            <p role="alert" className="mb-2 rounded-lg bg-bad/10 px-3 py-2 text-meta font-medium text-bad">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p role="status" className="mb-2 rounded-lg bg-ok/10 px-3 py-2 text-meta font-medium text-ok">
              Saqlandi.
            </p>
          ) : null}
          <button type="button" className="btn-primary min-h-[52px] w-full text-body" disabled={pending} onClick={submit}>
            {pending ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}
