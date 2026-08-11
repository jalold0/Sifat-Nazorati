/**
 * Telegram baseline — versiyalangan tarixiy o'lchov.
 *
 * Har bir eksport yangi versiya bo'lib yuklanadi (`pnpm import:baseline`),
 * eskisi tarixda qoladi. Sahifalar faqat `isCurrent` versiyani ko'rsatadi.
 */

import 'server-only';

import { db } from '@/lib/db';

import { num, num0 } from './shared';

export interface BaselineView {
  id: number;
  label: string;
  periodFrom: Date;
  periodTo: Date;
  sourceFile: string | null;
  note: string | null;
  importedAt: Date;
  importedByName: string | null;

  summary: {
    totalCases: number;
    withTrack: number;
    withoutTrack: number;
    uniqueCustomers: number;
    sharedCases: number;
    accountsSum: number;
    excludedCases: number;
    answeredCases: number;
    lateAnswered: number;
    noTraceCases: number;
    otherChannel: number;
    noReplyNeeded: number;
    medianFirstResponseMin: number;
    within1hShare: number;
    within24hShare: number;
    outsideHoursShare: number;
    system102Cases: number;
    totalMessages: number;
    totalSessions: number;
    /** Telegram / 102 nisbati — "ko'rinmayotgan ish" dalili */
    channelRatio: number | null;
    /** Javob izi yo'q ulushi */
    noTraceShare: number | null;
  };

  accounts: Array<{
    account: string;
    cases: number;
    ownOnly: number;
    shared: number;
    sessions: number;
    tracks: number;
    customers: number;
    unanswered: number;
    medianMin: number | null;
    within1h: number | null;
  }>;

  months: Array<{
    period: string;
    label: string;
    cases: number;
    noTrace: number;
    withTrack: number;
    medianFirstResponseMin: number;
    system102Cases: number | null;
  }>;

  byHour: Array<{ label: string; value: number }>;
  byWeekday: Array<{ label: string; value: number }>;
  byTopic: Array<{ label: string; value: number }>;

  operators: Array<{
    name: string;
    login: string;
    role: string;
    total: number;
    status: number;
    archive: number;
    approved: number;
  }>;
}

const CURRENT_INCLUDE = {
  importedBy: { select: { shortName: true } },
  accounts: { orderBy: { cases: 'desc' } },
  months: { orderBy: { period: 'asc' } },
  breakdowns: { orderBy: { sortOrder: 'asc' } },
  operators: { orderBy: { total: 'desc' } },
} as const;

/** Joriy (oxirgi yuklangan) baseline versiyasi. Hech qanday import bo'lmasa null. */
export async function currentBaseline(): Promise<BaselineView | null> {
  const row =
    (await db.baselineImport.findFirst({ where: { isCurrent: true }, include: CURRENT_INCLUDE })) ??
    (await db.baselineImport.findFirst({ orderBy: { importedAt: 'desc' }, include: CURRENT_INCLUDE }));

  if (!row) return null;

  const pick = (kind: 'HOUR' | 'WEEKDAY' | 'TOPIC') =>
    row.breakdowns.filter((b) => b.kind === kind).map((b) => ({ label: b.label, value: b.value }));

  return {
    id: row.id,
    label: row.label,
    periodFrom: row.periodFrom,
    periodTo: row.periodTo,
    sourceFile: row.sourceFile,
    note: row.note,
    importedAt: row.importedAt,
    importedByName: row.importedBy?.shortName ?? null,

    summary: {
      totalCases: row.totalCases,
      withTrack: row.withTrack,
      withoutTrack: row.withoutTrack,
      uniqueCustomers: row.uniqueCustomers,
      sharedCases: row.sharedCases,
      accountsSum: row.accountsSum,
      excludedCases: row.excludedCases,
      answeredCases: row.answeredCases,
      lateAnswered: row.lateAnswered,
      noTraceCases: row.noTraceCases,
      otherChannel: row.otherChannel,
      noReplyNeeded: row.noReplyNeeded,
      medianFirstResponseMin: num0(row.medianFirstResponseMin),
      within1hShare: num0(row.within1hShare),
      within24hShare: num0(row.within24hShare),
      outsideHoursShare: num0(row.outsideHoursShare),
      system102Cases: row.system102Cases,
      totalMessages: row.totalMessages,
      totalSessions: row.totalSessions,
      channelRatio: row.system102Cases > 0 ? round4(telegramInPeriod(row.months) / row.system102Cases) : null,
      noTraceShare: row.totalCases > 0 ? round4(row.noTraceCases / row.totalCases) : null,
    },

    accounts: row.accounts.map((a) => ({
      account: a.account,
      cases: a.cases,
      ownOnly: a.ownOnly,
      shared: a.shared,
      sessions: a.sessions,
      tracks: a.tracks,
      customers: a.customers,
      unanswered: a.unanswered,
      medianMin: num(a.medianMin),
      within1h: num(a.within1h),
    })),

    months: row.months.map((m) => ({
      period: m.period,
      label: m.label,
      cases: m.cases,
      noTrace: m.noTrace,
      withTrack: m.withTrack,
      medianFirstResponseMin: num0(m.medianFirstResponseMin),
      system102Cases: m.system102Cases,
    })),

    byHour: pick('HOUR'),
    byWeekday: pick('WEEKDAY'),
    byTopic: pick('TOPIC'),
    operators: row.operators,
  };
}

/**
 * 102 bilan taqqoslash faqat bir xil davrda ma'noli:
 * 102 statistikasi 2026 yil bo'yicha berilgan, shuning uchun Telegram ham
 * 2026 yil oylari bo'yicha yig'iladi.
 */
function telegramInPeriod(months: Array<{ period: string; cases: number }>): number {
  return months.filter((m) => m.period >= '2026-01').reduce((sum, m) => sum + m.cases, 0);
}

export interface BaselineHistoryRow {
  id: number;
  label: string;
  note: string | null;
  sourceFile: string | null;
  importedAt: Date;
  importedByName: string | null;
  isCurrent: boolean;
  totalCases: number;
  noTraceCases: number;
  /** Oldingi versiyaga nisbatan o'zgarish */
  delta: number | null;
}

/** Import tarixi — eng yangisi yuqorida. Har bir yozuvda sana va kim yuklagani qoladi. */
export async function baselineHistory(): Promise<BaselineHistoryRow[]> {
  const rows = await db.baselineImport.findMany({
    orderBy: { importedAt: 'desc' },
    include: { importedBy: { select: { shortName: true } } },
  });

  return rows.map((row, index) => {
    const older = rows[index + 1];
    return {
      id: row.id,
      label: row.label,
      note: row.note,
      sourceFile: row.sourceFile,
      importedAt: row.importedAt,
      importedByName: row.importedBy?.shortName ?? null,
      isCurrent: row.isCurrent,
      totalCases: row.totalCases,
      noTraceCases: row.noTraceCases,
      delta: older ? row.totalCases - older.totalCases : null,
    };
  });
}

/** Dashboard grafigi uchun oylik dinamika (joriy versiyadan). */
export async function baselineMonths() {
  const current = await db.baselineImport.findFirst({
    where: { isCurrent: true },
    select: { months: { orderBy: { period: 'asc' } } },
  });
  return current?.months ?? [];
}

const round4 = (v: number) => Math.round(v * 10000) / 10000;
