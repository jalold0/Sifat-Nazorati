'use client';

import { useState, useTransition } from 'react';

import { closeTaskAction } from './actions';

/** «Qayta tekshirdim»: izoh so'raydi va topshiriqni yopadi. */
export function CloseTaskForm({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" className="btn-ghost min-h-[44px]" onClick={() => setOpen(true)}>
        Qayta tekshirdim
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <label className="field-label" htmlFor={`note-${taskId}`}>
        Qayta tekshirish izohi (majburiy)
      </label>
      <textarea
        id={`note-${taskId}`}
        className="field min-h-[72px]"
        placeholder="Nima tekshirildi, natija qanday?"
        value={note}
        autoFocus
        onChange={(e) => setNote(e.target.value)}
      />
      {error ? (
        <p role="alert" className="text-meta font-medium text-bad">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary min-h-[44px]"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              try {
                const r = await closeTaskAction(taskId, note);
                if (!r.ok) setError(r.error);
              } catch {
                setError('Aloqa yo‘q, saqlanmadi. Aloqa tiklangach qayta urinib ko‘ring.');
              }
            })
          }
        >
          {pending ? 'Saqlanmoqda…' : 'Yopish'}
        </button>
        <button type="button" className="btn-ghost min-h-[44px]" onClick={() => setOpen(false)}>
          Bekor qilish
        </button>
      </div>
    </div>
  );
}
