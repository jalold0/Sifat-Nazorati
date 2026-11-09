/**
 * O'zgarishlar jurnali uchun SOF farqlash: «oldin → keyin» ni o'zbekcha qisqa satrlarga aylantiradi.
 * Jurnalda nima o'zgargani o'qilsin (kim, qachon — serverda yoziladi).
 */

import { type CheckpointKind, KIND_LABEL } from './checkpoint';


interface CpFields {
  text: string;
  weight: number;
  critical: boolean;
  active: boolean;
  kind?: CheckpointKind;
  okLabel?: string | null;
  badLabel?: string | null;
}

export interface DeptSnapshot {
  name: string;
  norm: number;
  estimate: boolean;
  active: boolean;
  checkpoints: Array<CpFields & { id: string }>;
  staff?: Array<{ id: string; name: string; active: boolean }>;
}

export interface DeptEdit {
  name: string;
  norm: number;
  estimate: boolean;
  active: boolean;
  checkpoints: Array<CpFields & { id?: string }>;
  /** Bo'lmasa — hodimlar o'zgarmagan. */
  staff?: Array<{ id?: string; name: string; active: boolean }>;
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
    const ok = o.kind ?? 'check';
    const nk = c.kind ?? 'check';
    if (ok !== nk) out.push(`${tag}: turi «${KIND_LABEL[ok]}» → «${KIND_LABEL[nk]}»`);
    if ((o.okLabel ?? null) !== (c.okLabel ?? null) || (o.badLabel ?? null) !== (c.badLabel ?? null)) {
      out.push(`${tag}: yorliqlar «${c.okLabel ?? '—'} / ${c.badLabel ?? '—'}»`);
    }
  }

  if (after.staff) {
    const was = new Map((before.staff ?? []).map((s) => [s.id, s]));
    for (const s of after.staff) {
      const o = s.id ? was.get(s.id) : undefined;
      if (!o) {
        out.push(`Yangi hodim: ${s.name}`);
        continue;
      }
      if (o.name !== s.name) out.push(`Hodim: «${o.name}» → «${s.name}»`);
      if (o.active !== s.active) out.push(`Hodim ${s.name}: ${s.active ? 'qayta faollashtirildi' : 'yashirildi'}`);
    }
  }
  return out;
}
