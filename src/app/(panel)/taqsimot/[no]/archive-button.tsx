'use client';

import { useState, useTransition } from 'react';

import { toggleTaskActiveAction } from '../actions';

/**
 * Vazifani arxivlash / qaytarish.
 *
 * O'chirish emas: arxivlangan vazifa yuklama hisobiga va reyestr tanloviga
 * kirmaydi, lekin uning o'tgan murojaatlari va hisobotlari joyida qoladi.
 * Arxivlash tasdiqlash bilan bajariladi — tasodifan bosilmasligi uchun.
 */
export function ArchiveButton({ taskNo, active }: { taskNo: number; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!active) {
    return (
      <button
        type="button"
        className="btn-ghost"
        disabled={pending}
        onClick={() => startTransition(() => toggleTaskActiveAction(taskNo, true))}
      >
        {pending ? '…' : 'Arxivdan qaytarish'}
      </button>
    );
  }

  if (!confirming) {
    return (
      <button type="button" className="btn-ghost" onClick={() => setConfirming(true)}>
        Arxivlash
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-micro text-muted">Arxivlansinmi?</span>
      <button
        type="button"
        className="btn-danger"
        disabled={pending}
        onClick={() => startTransition(() => toggleTaskActiveAction(taskNo, false))}
      >
        {pending ? '…' : 'Ha'}
      </button>
      <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
        Yo&apos;q
      </button>
    </span>
  );
}
