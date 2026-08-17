/**
 * Vazifa katalogining qoidalari.
 *
 * Katalog — tizimning "qonuni": reyestrdagi har bir murojaat shu katalogga
 * bog'lanadi va SLA, ustuvorlik, mas'ul shundan olinadi. Shuning uchun yangi
 * vazifa qo'shish va tahrirlash tekshiruvdan o'tadi.
 *
 * Muhim chegara: MAS'UL va ZAXIRA bu yerda o'zgartirilmaydi.
 * Ular vaqtga bog'langan biriktirish orqali almashtiriladi (`domain/assignment.ts`),
 * aks holda tarix qayta yozilib ketadi.
 */

export const ZONE_CODES = ['A', 'B', 'C', 'D'] as const;
export type ZoneCode = (typeof ZONE_CODES)[number];

export const FREQUENCIES = ['Kunlik', 'Haftalik', 'Oylik', 'Choraklik', 'Yillik', 'Talab bo‘yicha'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const KINDS = ['PROACTIVE', 'REACTIVE'] as const;
export type Kind = (typeof KINDS)[number];

export interface TaskInput {
  title: string;
  source: string;
  zoneCode: string;
  frequency: string;
  /** null — SLA belgilanmagan (proaktiv ishlarda odatiy holat) */
  slaHours: number | null;
  priority: string;
  kind: string;
}

export interface TaskAssigneeInput {
  ownerId: string;
  backupId: string | null;
  activeUserIds: readonly string[];
}

const MAX_SLA_HOURS = 720; // 30 kun — bundan uzoq muddat SLA emas, reja

/**
 * Vazifa maydonlarini tekshiradi. Xato bo'lsa o'zbek tilidagi sabab, aks holda null.
 * Xatolar birma-bir qaytariladi — foydalanuvchi bir vaqtda bitta narsani tuzatadi.
 */
export function validateTaskInput(input: TaskInput): string | null {
  const title = input.title.trim();
  if (title.length < 5) return 'Vazifa nomi juda qisqa — kamida 5 belgi';
  if (title.length > 200) return 'Vazifa nomi 200 belgidan oshmasligi kerak';

  if (input.source.trim().length < 2) return 'Manba / kanalni kiriting';

  if (!ZONE_CODES.includes(input.zoneCode as ZoneCode)) {
    return `Zona kodi noto'g'ri — faqat ${ZONE_CODES.join(', ')}`;
  }

  if (!FREQUENCIES.includes(input.frequency as Frequency)) {
    return 'Davriylik ro‘yxatdan tanlanishi kerak';
  }

  if (!PRIORITIES.includes(input.priority as Priority)) return 'Ustuvorlik noto‘g‘ri';
  if (!KINDS.includes(input.kind as Kind)) return 'Ish turi noto‘g‘ri';

  if (input.slaHours !== null) {
    if (!Number.isInteger(input.slaHours)) return 'SLA butun son bo‘lishi kerak';
    if (input.slaHours < 1) return 'SLA kamida 1 soat bo‘lishi kerak';
    if (input.slaHours > MAX_SLA_HOURS) {
      return `SLA ${MAX_SLA_HOURS} soatdan (30 kun) oshmasligi kerak — bundan uzog'i reja, SLA emas`;
    }
  }

  // Kritik ustuvorlikdagi ish SLA'siz qolsa, kechikishni o'lchab bo'lmaydi
  if (input.priority === 'CRITICAL' && input.slaHours === null) {
    return "Kritik ustuvorlikdagi vazifada SLA majburiy — usiz kechikishni o'lchab bo'lmaydi";
  }

  return null;
}

/** Mas'ul va zaxirani tekshiradi (yangi vazifa yaratishda). */
export function validateAssignee(input: TaskAssigneeInput): string | null {
  if (!input.activeUserIds.includes(input.ownerId)) {
    return "Mas'ul faol xodimlar ro'yxatida yo'q";
  }
  if (input.backupId !== null && !input.activeUserIds.includes(input.backupId)) {
    return 'Zaxira xodim faol xodimlar ro‘yxatida yo‘q';
  }
  if (input.backupId !== null && input.backupId === input.ownerId) {
    return "Zaxira xodim mas'ul bilan bir xil bo'lishi mumkin emas — bunda zaxira aslida yo'q";
  }
  return null;
}

/** Katalogdagi keyingi bo'sh raqam. */
export function nextTaskNo(existing: readonly number[]): number {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}

/**
 * Vazifani o'chirish mumkinmi?
 * Murojaat yoki qayta biriktirish tarixi bo'lsa — yo'q: o'chirish hisobotlarni
 * buzadi. Bunday vazifa arxivlanadi (active = false).
 */
export function canDeleteTask(counts: { tickets: number; assignments: number }): {
  allowed: boolean;
  reason: string | null;
} {
  if (counts.tickets > 0) {
    return {
      allowed: false,
      reason: `Bu vazifada ${counts.tickets} ta murojaat qayd etilgan — o'chirish hisobot tarixini buzadi. Arxivlang.`,
    };
  }
  if (counts.assignments > 1) {
    return {
      allowed: false,
      reason: 'Vazifa qayta biriktirilgan — tarixi bor, o‘chirilmaydi. Arxivlang.',
    };
  }
  return { allowed: true, reason: null };
}

export const PRIORITY_OPTIONS: ReadonlyArray<[Priority, string]> = [
  ['CRITICAL', 'Kritik'],
  ['HIGH', 'Yuqori'],
  ['MEDIUM', "O'rta"],
  ['LOW', 'Past'],
];

export const KIND_OPTIONS: ReadonlyArray<[Kind, string]> = [
  ['REACTIVE', 'Reaktiv — tushgan muammoni hal qilish'],
  ['PROACTIVE', 'Proaktiv — sifat nazoratining asosiy vazifasi'],
];

export const ZONE_OPTIONS: ReadonlyArray<[ZoneCode, string]> = [
  ['A', 'A — Ombor va yuk'],
  ['B', 'B — Yuk oqimi, status va ichki manbalar'],
  ['C', 'C — Tashqi murojaat va mijoz'],
  ['D', 'D — Boshqaruv va tahlil'],
];
