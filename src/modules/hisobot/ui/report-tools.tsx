'use client';

import { useState, useTransition } from 'react';

import { saveNoteAction } from './actions';

export function PrintButton() {
  return (
    <button type="button" className="btn-primary min-h-[44px]" onClick={() => window.print()}>
      Chop etish
    </button>
  );
}

/** Rahbar izohi. Chop etishda matn o'zi chiqadi, tugma va maydon chrome'i yashiriladi. */
export function NoteForm({ week, initial }: { week: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div>
      <label className="sr-only" htmlFor="note">
        Rahbar izohi
      </label>
      <textarea
        id="note"
        className="field no-print min-h-[96px]"
        placeholder="Ildiz sabab, taklif…"
        value={text}
        maxLength={4000}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      <p className="print-only whitespace-pre-wrap text-meta">{text || 'Izoh yozilmagan'}</p>
      <div className="no-print mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-ghost min-h-[44px]"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              setSaved(false);
              try {
                const r = await saveNoteAction(week, text);
                if (r.ok) setSaved(true);
                else setError(r.error);
              } catch {
                setError('Aloqa yo‘q, saqlanmadi. Matn shu yerda turibdi — qayta urinib ko‘ring.');
              }
            })
          }
        >
          {pending ? 'Saqlanmoqda…' : 'Izohni saqlash'}
        </button>
        {saved ? <span className="text-meta font-medium text-ok">Saqlandi</span> : null}
        {error ? (
          <span role="alert" className="text-meta font-medium text-bad">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
