'use client';

import { useActionState } from 'react';

import { closeTicketAction, type FormState } from '../actions';

export function CloseForm({ id, now, suggestedHours }: { id: string; now: string; suggestedHours: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(closeTicketAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="closedAt">
            Yopilgan vaqti
          </label>
          <input id="closedAt" name="closedAt" type="datetime-local" className="field" defaultValue={now} required />
        </div>
        <div>
          <label className="field-label" htmlFor="spentHours">
            Sarflangan vaqt (soat)
          </label>
          <input
            id="spentHours"
            name="spentHours"
            type="number"
            step="0.01"
            min={0}
            className="field"
            defaultValue={suggestedHours}
            required
          />
          <p className="mt-1 text-micro text-muted">Taxminiy qiymat qabul vaqtidan hisoblandi — tuzatib qo'ying.</p>
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="rootCause">
          Sabab (root cause) — majburiy
        </label>
        <textarea
          id="rootCause"
          name="rootCause"
          className="field min-h-[70px]"
          placeholder="Nima uchun bu holat yuz berdi? Kim yoki qaysi jarayon uzildi?"
          required
        />
      </div>

      <div>
        <label className="field-label" htmlFor="actionTaken">
          Ko'rilgan chora — majburiy
        </label>
        <textarea
          id="actionTaken"
          name="actionTaken"
          className="field min-h-[70px]"
          placeholder="Qanday hal qilindi? Takrorlanmasligi uchun nima qilindi?"
          required
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-body">
        <input type="checkbox" name="isRepeat" className="h-4 w-4 accent-[var(--brand)]" />
        Takroriy muammo — shu masala avval ham bo'lgan
      </label>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-meta font-medium text-bad">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rounded-lg bg-ok/10 px-3 py-2 text-meta font-medium text-ok">
          {state.ok}
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Yopilmoqda…' : 'Murojaatni yopish'}
      </button>
    </form>
  );
}
