'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { deleteAuditAction } from '@/app/(panel)/tekshiruv/actions';

export function DeleteAuditButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button type="button" className="btn-ghost min-h-[44px] text-bad" onClick={() => setConfirming(true)}>
        O‘chirish
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-meta text-ink2">Tekshiruv topshiriqlari bilan o‘chadi. Ishonchingiz komilmi?</span>
      <button
        type="button"
        className="btn-danger min-h-[44px]"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              const r = await deleteAuditAction(id);
              if (r.ok) router.push('/tarix');
              else setError(r.error);
            } catch {
              setError('Aloqa yo‘q, o‘chirilmadi.');
            }
          })
        }
      >
        Ha, o‘chirish
      </button>
      <button type="button" className="btn-ghost min-h-[44px]" onClick={() => setConfirming(false)}>
        Bekor qilish
      </button>
      {error ? <span className="text-meta text-bad">{error}</span> : null}
    </span>
  );
}
