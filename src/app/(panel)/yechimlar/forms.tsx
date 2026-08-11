'use client';

import { useActionState } from 'react';

import { createSolutionAction, updateSolutionStatusAction, type SolutionState } from './actions';

const DEPARTMENTS = [
  'Logistika',
  'Toshkent ombori',
  'Xitoy ombori',
  'IT',
  'Sotuv / Call center',
  'Moliya',
  'Marketing',
  'Hamkorlar (EMU/BTS/Uzpost/Starex)',
  'Filiallar',
  'HR',
];

export function SolutionForm({ period, today }: { period: string; today: string }) {
  const [state, action, pending] = useActionState<SolutionState, FormData>(createSolutionAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="period" value={period} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="title">
            Muammo nomi
          </label>
          <input id="title" name="title" className="field" placeholder="masalan: Filialda SMS yuborilmayapti" required />
        </div>
        <div>
          <label className="field-label" htmlFor="repeatCount">
            Takrorlanish soni
          </label>
          <input id="repeatCount" name="repeatCount" type="number" min={0} className="field" defaultValue={0} />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="problem">
            Muammo tavsifi
          </label>
          <textarea id="problem" name="problem" className="field min-h-[64px]" required />
        </div>
        <div>
          <label className="field-label" htmlFor="rootCause">
            Sabab (root cause)
          </label>
          <textarea id="rootCause" name="rootCause" className="field min-h-[64px]" required />
        </div>
        <div>
          <label className="field-label" htmlFor="solution">
            Taklif etilgan tizimli yechim
          </label>
          <textarea id="solution" name="solution" className="field min-h-[64px]" required />
        </div>
        <div>
          <label className="field-label" htmlFor="responsibleDept">
            Mas'ul bo'lim
          </label>
          <input id="responsibleDept" name="responsibleDept" className="field" list="dept-list" required />
          <datalist id="dept-list">
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="field-label" htmlFor="dueDate">
            Muddat
          </label>
          <input id="dueDate" name="dueDate" type="date" className="field" defaultValue={today} />
        </div>
      </div>

      {state.error ? <p className="text-meta font-medium text-bad">{state.error}</p> : null}
      {state.ok ? <p className="text-meta font-medium text-ok">{state.ok}</p> : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Saqlanmoqda…' : 'Yechimni qo‘shish'}
      </button>
    </form>
  );
}

export function StatusForm({ id, status }: { id: number; status: string }) {
  const [state, action, pending] = useActionState<SolutionState, FormData>(updateSolutionStatusAction, {});

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={status} className="field !py-1.5 !text-meta">
        <option value="PLANNED">Rejalashtirilgan</option>
        <option value="IN_PROGRESS">Bajarilmoqda</option>
        <option value="DONE">Bajarildi</option>
        <option value="VERIFIED">Natija tasdiqlandi</option>
        <option value="CANCELLED">Bekor qilindi</option>
      </select>
      <input name="effect" className="field !py-1.5 !text-meta" placeholder="Erishilgan natija" />
      <button type="submit" className="btn-ghost !py-1.5 !text-meta" disabled={pending}>
        {pending ? '…' : 'Yangilash'}
      </button>
      {state.error ? <p className="text-micro font-medium text-bad">{state.error}</p> : null}
      {state.ok ? <p className="text-micro font-medium text-ok">{state.ok}</p> : null}
    </form>
  );
}
