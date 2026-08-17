/**
 * Vazifani biriktirish — vaqtga bog'langan (effective-dated) model.
 *
 * Nima uchun oddiy "mas'ulni almashtirish" yetarli emas:
 * agar vazifada faqat bitta `ownerId` maydoni bo'lsa, uni o'zgartirish TARIXNI ham
 * o'zgartirib qo'yadi — o'tgan oyning hisobotida ham yangi xodim ko'rinib qoladi.
 * Shuning uchun har bir biriktirish o'z vaqt oralig'i bilan saqlanadi:
 *
 *   #1  Ulug'bek M.   2025-11-01 → 2026-08-12     (yopilgan oraliq)
 *   #2  Jasur B.      2026-08-12 → ∞              (joriy)
 *
 * O'zgartirishgacha bajarilgan ish eski xodim hisobida qoladi, yangi xodimning
 * sanog'i esa o'zgartirish sanasidan noldan boshlanadi.
 *
 * Oraliq YARIM OCHIQ: [from, until) — chegaradagi murojaat yangi mas'ulga tegishli.
 * Bu ikki tomonlama sanashni (bir ishning ikki kishida ko'rinishini) oldini oladi.
 */

/** Tizim kuzatuvi boshlangan sana — birinchi biriktirishlar shu sanadan hisoblanadi. */
export const SYSTEM_EPOCH = new Date('2025-11-01T00:00:00.000Z');

export interface AssignmentWindow {
  id: number;
  ownerId: string;
  backupId: string | null;
  from: Date;
  /** null — joriy biriktirish, hali yopilmagan */
  until: Date | null;
}

/**
 * Berilgan paytda vazifa kimda bo'lganini aniqlaydi.
 * Hech bir oraliqqa tushmasa null (masalan tizim boshlanishidan oldingi sana).
 */
export function resolveOwnerAt(windows: readonly AssignmentWindow[], at: Date): AssignmentWindow | null {
  const time = at.getTime();
  return (
    windows.find((w) => time >= w.from.getTime() && (w.until === null || time < w.until.getTime())) ?? null
  );
}

/** Joriy (yopilmagan) biriktirish. */
export function currentWindow(windows: readonly AssignmentWindow[]): AssignmentWindow | null {
  return windows.find((w) => w.until === null) ?? null;
}

export interface WindowCount {
  windowId: number;
  ownerId: string;
  from: Date;
  until: Date | null;
  count: number;
}

/**
 * Murojaatlarni biriktirish oraliqlari bo'yicha taqsimlaydi.
 * Hech bir oraliqqa tushmagan murojaatlar `unassigned` da qaytariladi —
 * ular jim yo'qolib ketmasligi kerak (yig'indi har doim tekshirilishi mumkin).
 */
export function countByAssignment(
  windows: readonly AssignmentWindow[],
  ticketDates: readonly Date[],
): { rows: WindowCount[]; unassigned: number } {
  const rows: WindowCount[] = windows.map((w) => ({
    windowId: w.id,
    ownerId: w.ownerId,
    from: w.from,
    until: w.until,
    count: 0,
  }));

  let unassigned = 0;
  for (const date of ticketDates) {
    const w = resolveOwnerAt(windows, date);
    if (!w) {
      unassigned += 1;
      continue;
    }
    const row = rows.find((r) => r.windowId === w.id);
    if (row) row.count += 1;
    else unassigned += 1;
  }

  return { rows, unassigned };
}

export interface ReassignInput {
  currentOwnerId: string;
  currentBackupId: string | null;
  newOwnerId: string;
  newBackupId: string | null;
  /** Yangi biriktirish qaysi paytdan kuchga kiradi */
  effectiveFrom: Date;
  /** Joriy oraliqning boshlanish payti — yangi sana undan oldin bo'lishi mumkin emas */
  currentFrom: Date;
  activeUserIds: readonly string[];
  now: Date;
}

/**
 * Qayta biriktirishni tekshiradi. Xato bo'lsa o'zbek tilidagi sabab qaytariladi,
 * to'g'ri bo'lsa null.
 */
export function validateReassign(input: ReassignInput): string | null {
  if (!input.activeUserIds.includes(input.newOwnerId)) {
    return "Yangi mas'ul faol xodimlar ro'yxatida yo'q";
  }

  if (input.newBackupId !== null && !input.activeUserIds.includes(input.newBackupId)) {
    return 'Zaxira xodim faol xodimlar ro‘yxatida yo‘q';
  }

  if (input.newBackupId !== null && input.newBackupId === input.newOwnerId) {
    // Zaxira ham o'zi bo'lsa — aslida zaxira yo'q. Bu hujjatdagi asosiy muammolardan biri.
    return "Zaxira xodim mas'ul bilan bir xil bo'lishi mumkin emas — bunda zaxira aslida yo'q";
  }

  if (input.newOwnerId === input.currentOwnerId && input.newBackupId === input.currentBackupId) {
    return "Taqsimot o'zgarmadi — mas'ul va zaxira avvalgidek";
  }

  if (input.effectiveFrom.getTime() <= input.currentFrom.getTime()) {
    return 'Kuchga kirish sanasi joriy biriktirish boshlangan sanadan keyin bo‘lishi kerak';
  }

  if (input.effectiveFrom.getTime() > input.now.getTime()) {
    // Kelasi sanaga biriktirish reyestrni chalkashtiradi: murojaat kiritilganda
    // mas'ul allaqachon o'zgargan bo'lib chiqadi.
    return 'Kelasi sanaga biriktirish mumkin emas';
  }

  return null;
}

/** Oraliqni o'qiladigan matnga aylantiradi: "01.11.2025 — 12.08.2026" yoki "12.08.2026 dan buyon". */
export function windowLabel(
  w: Pick<AssignmentWindow, 'from' | 'until'>,
  format: (d: Date) => string,
  isFirst = false,
): string {
  const from = isFirst && w.from.getTime() === SYSTEM_EPOCH.getTime() ? 'boshidan' : format(w.from);
  return w.until === null ? `${from} — hozirgacha` : `${from} — ${format(w.until)}`;
}
