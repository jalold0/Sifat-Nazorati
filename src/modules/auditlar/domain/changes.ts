/**
 * Tekshiruv tuzatilganda javoblar farqi — SOF.
 */

import type { Answer } from './types';

/** Tekshiruv tuzatilganda: qaysi javoblar o'zgargani. */
export function diffAnswers(before: Record<string, Answer>, after: Record<string, Answer>): string[] {
  const LABEL: Record<Answer, string> = { yes: 'Ha', no: 'Yo‘q', na: 'Tegishli emas' };
  const out: string[] = [];
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const b = before[id];
    const a = after[id];
    if (b === a) continue;
    out.push(`${id}: ${b ? LABEL[b] : '—'} → ${a ? LABEL[a] : '—'}`);
  }
  return out;
}
