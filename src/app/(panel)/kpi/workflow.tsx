'use client';

import { useActionState } from 'react';

import { periodSettingsAction, recalcAction, statusAction, type KpiState } from './actions';

/** Faktlarni reyestrdan qayta hisoblash tugmasi. */
export function RecalcButton({ period }: { period: string }) {
  const [state, action, pending] = useActionState<KpiState, FormData>(recalcAction, {});
  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="period" value={period} />
      <button type="submit" className="btn-ghost" disabled={pending}>
        {pending ? 'Hisoblanmoqda…' : 'Reyestrdan qayta hisoblash'}
      </button>
      {state.error ? <span className="text-micro font-medium text-bad">{state.error}</span> : null}
      {state.ok ? <span className="text-micro font-medium text-ok">{state.ok}</span> : null}
    </form>
  );
}

/** Holatni o'zgartirish (sinov rejimi, yuborish, tasdiqlash, qaytarish). */
export function StatusButton({
  period,
  status,
  label,
  variant = 'ghost',
  needsComment = false,
}: {
  period: string;
  status: 'DRAFT' | 'TRIAL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  label: string;
  variant?: 'ghost' | 'primary' | 'brand' | 'danger';
  needsComment?: boolean;
}) {
  const [state, action, pending] = useActionState<KpiState, FormData>(statusAction, {});
  const cls = { ghost: 'btn-ghost', primary: 'btn-primary', brand: 'btn-brand', danger: 'btn-danger' }[variant];

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="status" value={status} />
      {needsComment ? (
        <input name="comment" className="field !py-1.5 !text-meta" placeholder="Izoh (majburiy)" />
      ) : null}
      <button type="submit" className={cls} disabled={pending}>
        {pending ? '…' : label}
      </button>
      {state.error ? <p className="text-micro font-medium text-bad">{state.error}</p> : null}
      {state.ok ? <p className="text-micro font-medium text-ok">{state.ok}</p> : null}
    </form>
  );
}

/** Davr sozlamalari — bonus ulushi, chegaralar, ish kunlari. */
export function PeriodSettingsForm({
  period,
  bonusShare,
  threshold,
  cap,
  workingDays,
  note,
}: {
  period: string;
  bonusShare: number;
  threshold: number;
  cap: number;
  workingDays: number;
  note: string | null;
}) {
  const [state, action, pending] = useActionState<KpiState, FormData>(periodSettingsAction, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="period" value={period} />
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="field-label" htmlFor="bonusShare">
            Bonus ulushi
          </label>
          <input
            id="bonusShare"
            name="bonusShare"
            type="number"
            step="0.05"
            min={0}
            max={2}
            className="field"
            defaultValue={bonusShare}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="threshold">
            Kirish chegarasi (ball)
          </label>
          <input
            id="threshold"
            name="threshold"
            type="number"
            step="1"
            min={0}
            max={120}
            className="field"
            defaultValue={threshold}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="cap">
            Yuqori chegara
          </label>
          <input id="cap" name="cap" type="number" step="0.05" min={1} max={2} className="field" defaultValue={cap} />
        </div>
        <div>
          <label className="field-label" htmlFor="workingDays">
            Ish kunlari
          </label>
          <input
            id="workingDays"
            name="workingDays"
            type="number"
            step="1"
            min={1}
            max={31}
            className="field"
            defaultValue={workingDays}
          />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="note">
          Izoh
        </label>
        <input id="note" name="note" className="field" defaultValue={note ?? ''} placeholder="masalan: bayram kunlari chiqarildi" />
      </div>

      {state.error ? <p className="text-meta font-medium text-bad">{state.error}</p> : null}
      {state.ok ? <p className="text-meta font-medium text-ok">{state.ok}</p> : null}

      <button type="submit" className="btn-brand" disabled={pending}>
        {pending ? 'Saqlanmoqda…' : 'Sozlamalarni saqlash'}
      </button>
    </form>
  );
}
