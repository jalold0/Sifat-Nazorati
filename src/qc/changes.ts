/**
 * O'zgarishlar jurnali uchun SOF farqlash: «oldin → keyin» ni o'zbekcha qisqa satrlarga aylantiradi.
 * Jurnalda nima o'zgargani o'qilsin (kim, qachon — serverda yoziladi).
 */

import type { Answer } from './calc';

export interface DeptSnapshot {
  name: string;
  norm: number;
  estimate: boolean;
  active: boolean;
  checkpoints: Array<{ id: string; text: string; weight: number; critical: boolean; active: boolean }>;
}

export interface DeptEdit {
  name: string;
  norm: number;
  estimate: boolean;
  active: boolean;
  checkpoints: Array<{ id?: string; text: string; weight: number; critical: boolean; active: boolean }>;
}

const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Bo'lim sozlamasi o'zgarishi. `before` null — yangi bo'lim. */
export function diffDept(before: DeptSnapshot | null, after: DeptEdit): string[] {
  if (!before) {
    return [
      `Yangi bo‘lim: «${after.name}», me‘yor ${after.norm}%, ${after.checkpoints.filter((c) => c.active).length} ta faol nuqta`,
    ];
  }
  const out: string[] = [];
  if (before.name !== after.name) out.push(`Nom: «${before.name}» → «${after.name}»`);
  if (before.norm !== after.norm) out.push(`Me‘yor: ${before.norm}% → ${after.norm}%`);
  if (before.estimate !== after.estimate) {
    out.push(after.estimate ? 'Me‘yor «taxminiy» holatiga qaytarildi' : 'Me‘yor tasdiqlandi');
  }
  if (before.active !== after.active) out.push(after.active ? 'Bo‘lim faollashtirildi' : 'Bo‘lim yashirildi');

  const old = new Map(before.checkpoints.map((c) => [c.id, c]));
  for (const c of after.checkpoints) {
    const o = c.id ? old.get(c.id) : undefined;
    if (!o) {
      out.push(`Yangi nuqta: «${short(c.text)}»${c.critical ? ' (jiddiy)' : ''}, og‘irlik ${c.weight}`);
      continue;
    }
    const tag = `Nuqta ${o.id}`;
    if (o.text !== c.text) out.push(`${tag}: matn o‘zgardi («${short(o.text, 40)}» → «${short(c.text, 40)}»)`);
    if (o.weight !== c.weight) out.push(`${tag}: og‘irlik ${o.weight} → ${c.weight}`);
    if (o.critical !== c.critical) out.push(`${tag}: ${c.critical ? 'jiddiy belgisi qo‘yildi' : 'jiddiy belgisi olib tashlandi'}`);
    if (o.active !== c.active) out.push(`${tag}: ${c.active ? 'qayta faollashtirildi' : 'yashirildi'}`);
  }
  return out;
}

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

export function joinSummary(lines: string[], fallback = 'o‘zgarish yo‘q'): string {
  return lines.length === 0 ? fallback : lines.join('; ');
}
