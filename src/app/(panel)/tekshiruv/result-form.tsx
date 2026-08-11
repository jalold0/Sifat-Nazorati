'use client';

import { useActionState } from 'react';

import { setReviewResultAction, type ReviewState } from './actions';

const WHERE = ['Telefon orqali', 'Ichki tizimda (CRM)', '102 tizimida', 'Filialda', 'Boshqa chatda', 'Aniqlanmadi'];

export function ResultForm({
  id,
  result,
  resolvedWhere,
  note,
}: {
  id: number;
  result: string;
  resolvedWhere: string | null;
  note: string | null;
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(setReviewResultAction, {});

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="id" value={id} />
      <select name="result" defaultValue={result} className="field !py-1.5 !text-meta">
        <option value="PENDING">Tekshirilmagan</option>
        <option value="RESOLVED">Hal qilingan</option>
        <option value="UNRESOLVED">Hal qilinmagan</option>
        <option value="NOT_RELEVANT">Ishga aloqasiz</option>
      </select>
      <input
        name="resolvedWhere"
        className="field !py-1.5 !text-meta"
        list={`where-${id}`}
        defaultValue={resolvedWhere ?? ''}
        placeholder="Qayerda hal qilindi"
      />
      <datalist id={`where-${id}`}>
        {WHERE.map((w) => (
          <option key={w} value={w} />
        ))}
      </datalist>
      <input name="note" className="field !py-1.5 !text-meta" defaultValue={note ?? ''} placeholder="Izoh" />
      <button type="submit" className="btn-ghost !py-1.5 !text-meta" disabled={pending}>
        {pending ? '…' : 'Saqlash'}
      </button>
      {state.error ? <p className="text-micro font-medium text-bad">{state.error}</p> : null}
      {state.ok ? <p className="text-micro font-medium text-ok">{state.ok}</p> : null}
    </form>
  );
}
