'use client';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { saveDepartmentAction } from './actions';
import { type CheckpointKind, type DeptDto, KIND_LABEL, kindLabels } from '../domain';

interface Row {
  key: string;
  id?: string;
  text: string;
  group: string | null;
  weight: number;
  critical: boolean;
  active: boolean;
  kind: CheckpointKind;
  okLabel: string;
  badLabel: string;
}

interface StaffRow {
  key: string;
  id?: string;
  name: string;
  role: string;
  active: boolean;
}

let counter = 0;
const newKey = () => `n${++counter}`;
const blankRow = (): Row => ({ key: newKey(), text: '', group: null, weight: 1, critical: false, active: true, kind: 'check', okLabel: '', badLabel: '' });

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
          kind: c.kind ?? 'check',
          okLabel: c.okLabel ?? '',
          badLabel: c.badLabel ?? '',
        }))
      : [blankRow()],
  );
  const [staff, setStaff] = useState<StaffRow[]>(
    (dept?.staff ?? []).map((s) => ({ key: s.id, id: s.id, name: s.name, role: s.role, active: s.active })),
  );
  const [newName, setNewName] = useState('');
  const patchStaff = (key: string, p: Partial<StaffRow>) => {
    setSaved(false);
    setStaff((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  };
  /** Bir nechta ismni bir yo'la qo'shish: vergul yoki yangi qator bilan ajratilgan. */
  const addStaff = () => {
    const names = newName
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setSaved(false);
    setStaff((rs) => [...rs, ...names.map((name) => ({ key: newKey(), name, role: '', active: true }))]);
    setNewName('');
  };
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
            kind: x.kind,
            okLabel: x.kind === 'check' ? null : x.okLabel,
            badLabel: x.kind === 'check' ? null : x.badLabel,
          })),
          staff: staff.map((s) => ({ id: s.id, name: s.name, role: s.role, active: s.active })),
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
        <h2 className="mb-1 text-title">Hodimlar</h2>
        <p className="mb-3 text-meta text-muted">
          Tekshiriladigan xodimlar (operator, kuryer, omborchi). Ular tizimga kirmaydi — «har hodim bo‘yicha» nuqtalarda
          shu ro‘yxatdan tanlanadi. Ketgan hodimni yashiring: eski tekshiruvlarda u saqlanib qoladi.
        </p>
        <div className="card p-3.5">
          {staff.length === 0 ? <p className="mb-3 text-meta text-muted">Hali hodim qo‘shilmagan.</p> : null}
          <ul className="divide-y divide-grid">
            {staff.map((s) => (
              <li key={s.key} className={clsx('flex flex-wrap items-center gap-2 py-2', !s.active && 'opacity-60')}>
                <input
                  aria-label="Hodim ismi"
                  className="field min-h-[40px] min-w-[10rem] flex-1"
                  value={s.name}
                  onChange={(e) => patchStaff(s.key, { name: e.target.value })}
                />
                <input
                  aria-label="Lavozim yoki smena (ixtiyoriy)"
                  className="field min-h-[40px] w-full sm:w-48"
                  placeholder="Lavozim, smena"
                  value={s.role}
                  onChange={(e) => patchStaff(s.key, { role: e.target.value })}
                />
                <label className="flex min-h-[40px] items-center gap-2 text-meta">
                  <input type="checkbox" className="h-5 w-5" checked={!s.active} onChange={(e) => patchStaff(s.key, { active: !e.target.checked })} />
                  Yashirish
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              aria-label="Yangi hodimlar"
              className="field min-h-[44px] min-w-[12rem] flex-1"
              placeholder="Ism Familiya (bir nechtasini vergul bilan)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addStaff();
                }
              }}
            />
            <button type="button" className="btn-ghost min-h-[44px]" onClick={addStaff} disabled={!newName.trim()}>
              Hodim qo‘shish
            </button>
          </div>
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
                  Turi
                  <select
                    className="field min-h-[44px] w-auto"
                    value={r.kind}
                    onChange={(e) => patch(r.key, { kind: e.target.value as CheckpointKind })}
                  >
                    {(Object.keys(KIND_LABEL) as CheckpointKind[]).map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
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
              {r.kind !== 'check' ? (
                <div className="mt-1 grid gap-2 pl-8 sm:grid-cols-2">
                  <label className="text-meta">
                    <span className="mb-1 block text-ink2">Yaxshi natija yorlig‘i</span>
                    <input
                      className="field min-h-[40px]"
                      maxLength={40}
                      placeholder={r.kind === 'staff_count' ? 'masalan «Sifatli yopdi»' : 'masalan «Topshirdi»'}
                      value={r.okLabel}
                      onChange={(e) => patch(r.key, { okLabel: e.target.value })}
                    />
                  </label>
                  <label className="text-meta">
                    <span className="mb-1 block text-ink2">Yomon natija yorlig‘i</span>
                    <input
                      className="field min-h-[40px]"
                      maxLength={40}
                      placeholder={r.kind === 'staff_count' ? 'masalan «Yopa olmadi»' : 'masalan «Topshirmadi»'}
                      value={r.badLabel}
                      onChange={(e) => patch(r.key, { badLabel: e.target.value })}
                    />
                  </label>
                  <p className="text-micro text-muted sm:col-span-2">
                    Bo‘sh qolsa: «{kindLabels({ kind: r.kind }).ok}» / «{kindLabels({ kind: r.kind }).bad}».
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="btn-ghost mt-3 min-h-[44px]"
          onClick={() => {
            setSaved(false);
            setRows((rs) => [...rs, blankRow()]);
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
          <div className="flex justify-end">
            <button type="button" className="btn-primary min-h-[44px] px-6 text-meta" disabled={pending} onClick={submit}>
              {pending ? 'Saqlanmoqda…' : 'Bo‘limni saqlash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
