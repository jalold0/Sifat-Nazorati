'use client';

import { useActionState, useState } from 'react';

import { setFactAction, type KpiState } from './actions';

export interface FactRowData {
  indicatorId: number;
  no: number;
  name: string;
  unit: 'PERCENT' | 'HOURS' | 'COUNT' | 'RATIO';
  weight: number;
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
  target: number;
  targetText: string;
  formula: string;
  dataSource: string;
  metricSource: 'AUTO' | 'MANUAL';
  autoValue: number | null;
  manualValue: number | null;
  usedValue: number | null;
  achievement: number;
  score: number;
  maxScore: number;
  comment: string | null;
  overriddenBy: string | null;
}

/**
 * Faktni tahrirlash qatori.
 * Foizli ko'rsatkichlar foizda kiritiladi (95), bazada esa 0.95 bo'lib saqlanadi —
 * xodim uchun tabiiy, hisob uchun to'g'ri.
 */
export function FactEditor({
  period,
  row,
  locked,
}: {
  period: string;
  row: FactRowData;
  locked: boolean;
}) {
  const [state, action, pending] = useActionState<KpiState, FormData>(setFactAction, {});
  const [open, setOpen] = useState(false);

  const toInput = (v: number | null) => (v === null ? '' : row.unit === 'PERCENT' ? String(round(v * 100, 2)) : String(v));

  if (locked) {
    return (
      <p className="text-[11.5px] text-muted">
        {row.comment ? `Izoh: ${row.comment}` : 'Davr tasdiqlangan — o‘zgartirilmaydi'}
      </p>
    );
  }

  return (
    <div>
      {!open ? (
        <button type="button" className="text-[11.5px] font-semibold text-brand" onClick={() => setOpen(true)}>
          {row.manualValue !== null ? 'Tuzatishni o‘zgartirish' : row.metricSource === 'AUTO' ? 'Qo‘lda tuzatish' : 'Fakt kiritish'}
        </button>
      ) : (
        <form action={action} className="mt-1 space-y-2 rounded-lg border border-line bg-raised p-2.5">
          <input type="hidden" name="period" value={period} />
          <input type="hidden" name="indicatorId" value={row.indicatorId} />
          <input type="hidden" name="isAuto" value={row.metricSource === 'AUTO' ? '1' : '0'} />

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="field-label" htmlFor={`value-${row.indicatorId}`}>
                Fakt {row.unit === 'PERCENT' ? '(%)' : row.unit === 'HOURS' ? '(soat)' : row.unit === 'COUNT' ? '(ta)' : ''}
              </label>
              <input
                id={`value-${row.indicatorId}`}
                name="value"
                type="number"
                step="0.01"
                className="field"
                defaultValue={toInput(row.manualValue)}
                placeholder={row.autoValue !== null ? `avtomatik: ${toInput(row.autoValue)}` : 'kiritilmagan'}
              />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor={`comment-${row.indicatorId}`}>
              Izoh {row.metricSource === 'AUTO' ? '(tuzatish uchun majburiy)' : ''}
            </label>
            <input
              id={`comment-${row.indicatorId}`}
              name="comment"
              className="field"
              defaultValue={row.comment ?? ''}
              placeholder="Nima uchun tuzatildi? Manba nima?"
            />
          </div>

          {state.error ? <p className="text-[11.5px] font-medium text-bad">{state.error}</p> : null}
          {state.ok ? <p className="text-[11.5px] font-medium text-ok">{state.ok}</p> : null}

          <div className="flex gap-2">
            <button type="submit" className="btn-brand !py-1.5 !text-[12px]" disabled={pending}>
              {pending ? 'Saqlanmoqda…' : 'Saqlash'}
            </button>
            <button type="button" className="btn-ghost !py-1.5 !text-[12px]" onClick={() => setOpen(false)}>
              Yopish
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted">
            Bo'sh qoldirilsa — avtomatik qiymat qaytariladi. Formula: {row.formula}
          </p>
        </form>
      )}

      {row.comment && !open ? (
        <p className="mt-0.5 text-[11px] leading-snug text-muted">
          {row.overriddenBy ? `${row.overriddenBy}: ` : ''}
          {row.comment}
        </p>
      ) : null}
    </div>
  );
}

function round(v: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
