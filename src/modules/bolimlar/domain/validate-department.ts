/**
 * Bo'lim sozlamasini tekshirish — SOF (bazasiz). Bazaga bog'liq tekshiruvlar (nom takrori, mavjud id'lar)
 * use-case'da qoladi.
 */

import { isListKind, type ListKind } from '@/shared/lists';

import type { CheckpointKind } from './checkpoint';

export interface CheckpointInput {
  id?: string;
  text: string;
  group?: string | null;
  weight: number;
  critical: boolean;
  active: boolean;
  /** Bo'lmasa — 'check' */
  kind?: CheckpointKind;
  okLabel?: string | null;
  badLabel?: string | null;
  /** Bo'lmasa — 'shift' (kunlik smena) */
  list?: ListKind;
}

export interface StaffInputRow {
  id?: string;
  name: string;
  role?: string;
  active: boolean;
}

export interface SaveDepartmentInput {
  id?: string;
  name: string;
  norm: number;
  estimate: boolean;
  active: boolean;
  checkpoints: CheckpointInput[];
  /** Bo'lim hodimlari. Bo'lmasa — o'zgarmaydi. Hodim o'chirilmaydi, faqat `active:false`. */
  staff?: StaffInputRow[];
}

const KINDS = new Set<CheckpointKind>(['check', 'staff_check', 'staff_count']);
const LABEL_MAX = 40;
const cleanLabel = (v: string | null | undefined) => (v ?? '').trim().slice(0, LABEL_MAX) || null;

export type DepartmentValidation = { ok: true; name: string; hasStaffCheckpoint: boolean } | { ok: false; error: string };

/** Kirishning o'zi to'g'rimi (bazasiz). */
export function validateDepartmentInput(input: SaveDepartmentInput): DepartmentValidation {
  const name = (input.name ?? '').trim();
  if (!name) return { ok: false, error: 'Bo‘lim nomini yozing.' };
  if (!Number.isInteger(input.norm) || input.norm < 1 || input.norm > 100) {
    return { ok: false, error: 'Me‘yor 1 dan 100 gacha butun son bo‘lishi kerak.' };
  }
  if (!Array.isArray(input.checkpoints) || input.checkpoints.length === 0) return { ok: false, error: 'Kamida bitta nuqta kerak.' };
  for (const c of input.checkpoints) {
    if (!c.text?.trim()) return { ok: false, error: 'Har bir nuqtaga savol matnini yozing (bo‘sh nuqtani «yashirish» mumkin).' };
    if (![1, 2, 3].includes(c.weight)) return { ok: false, error: 'Nuqta og‘irligi 1, 2 yoki 3 bo‘lishi kerak.' };
    if (c.kind !== undefined && !KINDS.has(c.kind)) return { ok: false, error: 'Nuqta turi noto‘g‘ri.' };
    if (c.list !== undefined && !isListKind(c.list)) return { ok: false, error: 'Nuqtaning cheklisti noto‘g‘ri.' };
    if (c.list === 'interaction' && c.kind && c.kind !== 'check') {
      return {
        ok: false,
        error: `«${c.text.trim()}»: muloqot bahosi bitta operatorni baholaydi — turi «Butun bo‘lim: Ha / Yo‘q» bo‘lsin.`,
      };
    }
  }
  if (!input.checkpoints.some((c) => c.active)) return { ok: false, error: 'Kamida bitta faol nuqta qoldiring.' };

  const staff = input.staff;
  if (staff !== undefined) {
    if (!Array.isArray(staff) || staff.length > 200) return { ok: false, error: 'Hodimlar ro‘yxati noto‘g‘ri (ko‘pi bilan 200 kishi).' };
    const seen = new Set<string>();
    for (const s of staff) {
      const n = (s.name ?? '').trim();
      if (!n) return { ok: false, error: 'Har bir hodimning ismini yozing (keraksizini «yashirish» mumkin).' };
      if (n.length > 80) return { ok: false, error: 'Hodim ismi 80 belgidan oshmasin.' };
      const key = n.toLowerCase();
      if (s.active && seen.has(key)) {
        return { ok: false, error: `«${n}» ro‘yxatda ikki marta. Ismlarni farqlang (masalan familiya qo‘shing).` };
      }
      if (s.active) seen.add(key);
    }
  }
  return { ok: true, name, hasStaffCheckpoint: input.checkpoints.some((c) => c.active && c.kind && c.kind !== 'check') };
}

/** Bo'lim ichida o'zgarmas nuqta identifikatori: cp1, cp2, … (mavjudlarning eng kattasidan keyingisi). */
export function nextCheckpointNumber(existingIds: string[]): number {
  return existingIds.reduce((m, id) => Math.max(m, Number(id.replace(/^cp/, '')) || 0), 0);
}

/** Kirishni saqlashga tayyor ko'rinishga keltiradi: matn kesiladi, yorliqlar tozalanadi, standart qiymatlar qo'yiladi. */
export function normalizeCheckpoint(c: CheckpointInput) {
  return {
    ...c,
    text: c.text.trim(),
    kind: c.kind ?? ('check' as CheckpointKind),
    okLabel: cleanLabel(c.okLabel),
    badLabel: cleanLabel(c.badLabel),
    list: c.list ?? ('shift' as ListKind),
  };
}
