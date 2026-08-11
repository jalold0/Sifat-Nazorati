/**
 * KPI yadrosi — Next.js'ga bog'lanmagan, shuning uchun skriptlardan ham ishlatiladi
 * (`scripts/demo-data.ts`, cron va migratsiya vazifalari).
 * Sahifalar `@/server/kpi` fasadidan foydalanadi.
 *
 * KPI xizmati — davrni ochish, faktlarni reyestrdan hisoblash, natija kartalarini yig'ish,
 * CEO tasdiqlash oqimi.
 *
 * Oqim: DRAFT → (TRIAL) → SUBMITTED → APPROVED | REJECTED
 * Tasdiqlangandan keyin faktlar muzlatiladi (KpiResult snapshot bo'lib qoladi).
 */

import type { Prisma } from '@prisma/client';

import { buildScorecard, type IndicatorInput, type KpiSettings, type Scorecard } from '@/domain/kpi';
import { computeAllMetrics, type MetricsDataset, type MetricTicket } from '@/domain/metrics';
import { db } from '@/lib/db';
import { dayKey, periodLabel, periodRange, workingDaysElapsed, workingDaysIn } from '@/lib/period';

import { logActivity, num } from './shared';

export interface PeriodWithSettings {
  id: number;
  period: string;
  label: string;
  status: 'DRAFT' | 'TRIAL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  workingDays: number;
  settings: KpiSettings;
  note: string | null;
  ceoComment: string | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  approvedByName: string | null;
}

const DEFAULTS = { bonusShare: 0.5, threshold: 70, cap: 1.2 };

const PERIOD_INCLUDE = { approvedBy: { select: { shortName: true } } } as const;

/**
 * Davrni ochadi (bo'lmasa yaratadi) va sozlamalarini qaytaradi.
 *
 * Yaratish poygaga (race) chidamli: bir vaqtda kelgan bir necha so'rov
 * (masalan sahifa yuklanishi + prefetch) yangi oyni birga ochishga urinadi.
 * Unique cheklov ishga tushsa, yozuv boshqa so'rov tomonidan yaratilgan —
 * shuning uchun xato qaytarilmaydi, mavjud yozuv o'qiladi.
 */
export async function ensurePeriod(period: string): Promise<PeriodWithSettings> {
  const existing = await db.kpiPeriod.findUnique({ where: { period }, include: PERIOD_INCLUDE });

  const row = existing ?? (await createPeriod(period));

  return {
    id: row.id,
    period: row.period,
    label: row.label,
    status: row.status,
    workingDays: row.workingDays,
    note: row.note,
    ceoComment: row.ceoComment,
    submittedAt: row.submittedAt,
    approvedAt: row.approvedAt,
    approvedByName: row.approvedBy?.shortName ?? null,
    settings: {
      bonusShare: num(row.bonusShare) ?? DEFAULTS.bonusShare,
      threshold: num(row.threshold) ?? DEFAULTS.threshold,
      cap: num(row.cap) ?? DEFAULTS.cap,
    },
  };
}

/**
 * Davrni yaratadi; parallel so'rov allaqachon yaratgan bo'lsa — o'shani qaytaradi.
 *
 * `skipDuplicates` bilan INSERT ... ON CONFLICT DO NOTHING bajariladi:
 * poyga holatida istisno ham, log'da chalg'ituvchi "xato" ham chiqmaydi.
 */
async function createPeriod(period: string) {
  await db.kpiPeriod.createMany({
    data: [
      {
        period,
        label: periodLabel(period),
        workingDays: workingDaysIn(period),
        bonusShare: DEFAULTS.bonusShare,
        threshold: DEFAULTS.threshold,
        cap: DEFAULTS.cap,
        status: 'DRAFT',
      },
    ],
    skipDuplicates: true,
  });

  return db.kpiPeriod.findUniqueOrThrow({ where: { period }, include: PERIOD_INCLUDE });
}

export async function listPeriods(limit = 24) {
  return db.kpiPeriod.findMany({
    orderBy: { period: 'desc' },
    take: limit,
    select: { period: true, label: true, status: true },
  });
}

/** Reyestr, audit va yechimlardan metrika hisoblash uchun ma'lumot to'plami. */
export async function buildDataset(period: string, workingDays: number): Promise<MetricsDataset> {
  const { from, to } = periodRange(period);

  const [tickets, audits, verifiedSolutions, specialists] = await Promise.all([
    db.ticket.findMany({
      where: { date: { gte: from, lt: to } },
      select: {
        zoneCode: true,
        kind: true,
        status: true,
        priority: true,
        date: true,
        receivedAt: true,
        firstResponseAt: true,
        escalatedAt: true,
        closedAt: true,
        spentHours: true,
        slaMet: true,
        isRepeat: true,
        owner: { select: { key: true } },
        taskDef: { select: { no: true } },
      },
    }),
    db.audit.findMany({
      where: { auditedAt: { gte: from, lt: to } },
      select: { kind: true, auditor: { select: { key: true } } },
    }),
    db.rootCauseAction.count({ where: { period, status: 'VERIFIED' } }),
    db.user.findMany({ where: { role: 'SPECIALIST', active: true }, select: { key: true } }),
  ]);

  const mapped: MetricTicket[] = tickets.map((t) => ({
    ownerKey: t.owner.key,
    zoneCode: t.zoneCode,
    kind: t.kind,
    status: t.status,
    priority: t.priority,
    day: dayKey(t.date),
    receivedAt: t.receivedAt,
    firstResponseAt: t.firstResponseAt,
    escalatedAt: t.escalatedAt,
    closedAt: t.closedAt,
    spentHours: num(t.spentHours),
    slaMet: t.slaMet,
    isRepeat: t.isRepeat,
    taskNo: t.taskDef?.no ?? null,
  }));

  return {
    workingDays,
    workingDaysElapsed: workingDaysElapsed(period),
    tickets: mapped,
    audits: audits.map((a) => ({ kind: a.kind, auditorKey: a.auditor.key })),
    verifiedSolutions,
    specialistKeys: specialists.map((s) => s.key),
  };
}

/**
 * Davr faktlarini qayta hisoblaydi.
 * AUTO ko'rsatkichlar reyestrdan yangilanadi, qo'lda kiritilgan qiymat (manualValue) saqlanadi
 * va u har doim ustun turadi — bo'lim boshlig'ining izohli tuzatishi yo'qolmaydi.
 */
export async function recalculatePeriod(period: string, actorId: string | null = null): Promise<number> {
  const p = await ensurePeriod(period);
  if (p.status === 'APPROVED') return 0; // tasdiqlangan davr o'zgarmaydi

  const indicators = await db.kpiIndicator.findMany({
    where: { active: true },
    select: {
      id: true,
      code: true,
      metric: true,
      metricSource: true,
      weight: true,
      direction: true,
      target: true,
      owner: { select: { key: true } },
    },
  });

  const ds = await buildDataset(period, p.workingDays);
  const computed = computeAllMetrics(
    indicators.map((i) => ({
      code: i.code,
      metric: i.metric,
      ownerKey: i.owner.key,
      metricSource: i.metricSource,
    })),
    ds,
  );

  const existing = await db.kpiFact.findMany({
    where: { periodId: p.id },
    select: { indicatorId: true, manualValue: true },
  });
  const manualMap = new Map(existing.map((f) => [f.indicatorId, num(f.manualValue)]));

  const operations: Prisma.PrismaPromise<unknown>[] = [];
  for (const ind of indicators) {
    const auto = computed.get(ind.code) ?? null;
    const manual = manualMap.get(ind.id) ?? null;
    const used = manual ?? auto;

    const evaluated = buildScorecard({
      indicators: [
        {
          code: ind.code,
          name: ind.code,
          weight: num(ind.weight) ?? 0,
          direction: ind.direction,
          target: num(ind.target) ?? 0,
          fact: used,
        },
      ],
      salary: null,
      settings: p.settings,
    }).indicators[0]!;

    operations.push(
      db.kpiFact.upsert({
        where: { periodId_indicatorId: { periodId: p.id, indicatorId: ind.id } },
        create: {
          periodId: p.id,
          indicatorId: ind.id,
          autoValue: auto,
          usedValue: used,
          achievement: evaluated.achievement,
          score: evaluated.score,
        },
        update: {
          autoValue: auto,
          usedValue: used,
          achievement: evaluated.achievement,
          score: evaluated.score,
        },
      }),
    );
  }

  await db.$transaction(operations);
  await refreshResults(period);
  await logActivity({
    actorId,
    action: 'kpi.recalculate',
    entity: 'KpiPeriod',
    entityId: String(p.id),
    summary: `${p.label} — ${indicators.length} ko'rsatkich reyestrdan qayta hisoblandi`,
  });

  return indicators.length;
}

/**
 * Qo'lda fakt kiritish yoki avtomatik qiymatni izoh bilan tuzatish.
 *
 * `displayValue` — foydalanuvchi kiritgan qiymat KO'RSATISH birligida:
 * foizli ko'rsatkichlar uchun 95 (bazada 0.95 bo'lib saqlanadi), qolganlari o'zgarmaydi.
 * Konvertatsiya serverda bajariladi — mijozdan kelgan birlikka ishonilmaydi.
 */
export async function setManualFact(input: {
  period: string;
  indicatorId: number;
  displayValue: number | null;
  comment: string | null;
  actorId: string;
}): Promise<void> {
  const p = await ensurePeriod(input.period);
  if (p.status === 'APPROVED') throw new Error('Tasdiqlangan davrni o‘zgartirib bo‘lmaydi');

  const ind = await db.kpiIndicator.findUniqueOrThrow({
    where: { id: input.indicatorId },
    select: { weight: true, direction: true, target: true, name: true, metricSource: true, unit: true },
  });

  const value =
    input.displayValue === null ? null : ind.unit === 'PERCENT' ? input.displayValue / 100 : input.displayValue;

  const fact = await db.kpiFact.findUnique({
    where: { periodId_indicatorId: { periodId: p.id, indicatorId: input.indicatorId } },
    select: { autoValue: true },
  });

  const used = value ?? num(fact?.autoValue ?? null);
  const evaluated = buildScorecard({
    indicators: [
      {
        code: 'x',
        name: ind.name,
        weight: num(ind.weight) ?? 0,
        direction: ind.direction,
        target: num(ind.target) ?? 0,
        fact: used,
      },
    ],
    salary: null,
    settings: p.settings,
  }).indicators[0]!;

  await db.kpiFact.upsert({
    where: { periodId_indicatorId: { periodId: p.id, indicatorId: input.indicatorId } },
    create: {
      periodId: p.id,
      indicatorId: input.indicatorId,
      manualValue: value,
      usedValue: used,
      achievement: evaluated.achievement,
      score: evaluated.score,
      comment: input.comment,
      overriddenById: input.actorId,
    },
    update: {
      manualValue: value,
      usedValue: used,
      achievement: evaluated.achievement,
      score: evaluated.score,
      comment: input.comment,
      overriddenById: input.actorId,
    },
  });

  await refreshResults(input.period);
  await logActivity({
    actorId: input.actorId,
    action: 'kpi.override',
    entity: 'KpiFact',
    entityId: `${p.id}:${input.indicatorId}`,
    summary: `${p.label} — "${ind.name}" qo'lda ${input.displayValue ?? '—'} qilib belgilandi${input.comment ? `: ${input.comment}` : ''}`,
  });
}

export interface EmployeeScorecard {
  userId: string;
  key: string;
  shortName: string;
  fullName: string;
  position: string;
  role: string;
  salary: number | null;
  card: Scorecard;
  rows: Array<{
    indicatorId: number;
    no: number;
    name: string;
    shortLabel: string;
    unit: 'PERCENT' | 'HOURS' | 'COUNT' | 'RATIO';
    weight: number;
    direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
    target: number;
    targetText: string;
    formula: string;
    dataSource: string;
    metricSource: 'AUTO' | 'MANUAL';
    autoValue: number | null;
    manualValue: number | null;
    usedValue: number | null;
    achievement: number;
    score: number;
    maxScore: number;
    comment: string | null;
    overriddenBy: string | null;
  }>;
}

/** Davr bo'yicha barcha xodimlarning natija kartalari. */
export async function scorecards(period: string): Promise<{
  period: PeriodWithSettings;
  employees: EmployeeScorecard[];
  departmentAverage: number;
  bonusTotal: number;
}> {
  const p = await ensurePeriod(period);

  const indicators = await db.kpiIndicator.findMany({
    where: { active: true },
    orderBy: { no: 'asc' },
    include: {
      owner: {
        select: { id: true, key: true, shortName: true, fullName: true, position: true, role: true, salary: true },
      },
      facts: { where: { periodId: p.id }, include: { overriddenBy: { select: { shortName: true } } } },
    },
  });

  const byUser = new Map<string, typeof indicators>();
  for (const ind of indicators) {
    const list = byUser.get(ind.owner.id) ?? [];
    list.push(ind);
    byUser.set(ind.owner.id, list);
  }

  const trialMode = p.status === 'TRIAL';
  const employees: EmployeeScorecard[] = [];

  for (const [userId, list] of byUser) {
    const owner = list[0]!.owner;
    const inputs: IndicatorInput[] = list.map((ind) => ({
      code: ind.code,
      name: ind.name,
      weight: num(ind.weight) ?? 0,
      direction: ind.direction,
      target: num(ind.target) ?? 0,
      fact: num(ind.facts[0]?.usedValue ?? null),
    }));

    const card = buildScorecard({
      indicators: inputs,
      salary: num(owner.salary),
      settings: p.settings,
      trialMode,
    });

    employees.push({
      userId,
      key: owner.key,
      shortName: owner.shortName,
      fullName: owner.fullName,
      position: owner.position,
      role: owner.role,
      salary: num(owner.salary),
      card,
      rows: list.map((ind, i) => {
        const fact = ind.facts[0];
        const evaluated = card.indicators[i]!;
        return {
          indicatorId: ind.id,
          no: ind.no,
          name: ind.name,
          shortLabel: ind.shortLabel,
          unit: ind.unit,
          weight: num(ind.weight) ?? 0,
          direction: ind.direction,
          target: num(ind.target) ?? 0,
          targetText: ind.targetText,
          formula: ind.formula,
          dataSource: ind.dataSource,
          metricSource: ind.metricSource,
          autoValue: num(fact?.autoValue ?? null),
          manualValue: num(fact?.manualValue ?? null),
          usedValue: num(fact?.usedValue ?? null),
          achievement: evaluated.achievement,
          score: evaluated.score,
          maxScore: evaluated.maxScore,
          comment: fact?.comment ?? null,
          overriddenBy: fact?.overriddenBy?.shortName ?? null,
        };
      }),
    });
  }

  // Mutaxassislar oldinda, bo'lim boshlig'i oxirida — hisobotdagi tartib bilan bir xil
  employees.sort(
    (a, b) =>
      (a.role === 'HEAD' ? 1 : 0) - (b.role === 'HEAD' ? 1 : 0) ||
      (a.rows[0]?.no ?? 0) - (b.rows[0]?.no ?? 0),
  );

  const departmentAverage =
    employees.length > 0
      ? Math.round((employees.reduce((s, e) => s + e.card.totalScore, 0) / employees.length) * 100) / 100
      : 0;

  return {
    period: p,
    employees,
    departmentAverage,
    bonusTotal: employees.reduce((s, e) => s + e.card.bonus, 0),
  };
}

/** KpiResult snapshot'ini yangilaydi — hisobot va to'lov uchun asos. */
export async function refreshResults(period: string): Promise<void> {
  const { period: p, employees } = await scorecardsRaw(period);
  await db.$transaction(
    employees.map((e) =>
      db.kpiResult.upsert({
        where: { periodId_userId: { periodId: p.id, userId: e.userId } },
        create: {
          periodId: p.id,
          userId: e.userId,
          totalScore: e.card.totalScore,
          grade: e.card.grade,
          salary: e.salary,
          bonus: e.card.bonus,
        },
        update: {
          totalScore: e.card.totalScore,
          grade: e.card.grade,
          salary: e.salary,
          bonus: e.card.bonus,
        },
      }),
    ),
  );
}

/** refreshResults ↔ scorecards orasida cheksiz chaqiruv bo'lmasligi uchun ichki variant. */
async function scorecardsRaw(period: string) {
  const p = await ensurePeriod(period);
  const indicators = await db.kpiIndicator.findMany({
    where: { active: true },
    include: {
      owner: { select: { id: true, salary: true } },
      facts: { where: { periodId: p.id }, select: { usedValue: true } },
    },
  });

  const byUser = new Map<string, { salary: number | null; inputs: IndicatorInput[] }>();
  for (const ind of indicators) {
    const bucket = byUser.get(ind.owner.id) ?? { salary: num(ind.owner.salary), inputs: [] };
    bucket.inputs.push({
      code: ind.code,
      name: ind.name,
      weight: num(ind.weight) ?? 0,
      direction: ind.direction,
      target: num(ind.target) ?? 0,
      fact: num(ind.facts[0]?.usedValue ?? null),
    });
    byUser.set(ind.owner.id, bucket);
  }

  return {
    period: p,
    employees: [...byUser.entries()].map(([userId, b]) => ({
      userId,
      salary: b.salary,
      card: buildScorecard({
        indicators: b.inputs,
        salary: b.salary,
        settings: p.settings,
        trialMode: p.status === 'TRIAL',
      }),
    })),
  };
}

// ── Tasdiqlash oqimi ─────────────────────────────────────────────────────────

export async function setPeriodStatus(input: {
  period: string;
  status: 'DRAFT' | 'TRIAL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  actorId: string;
  comment?: string | null;
}): Promise<void> {
  const p = await ensurePeriod(input.period);

  const data: Prisma.KpiPeriodUpdateInput = { status: input.status };
  if (input.status === 'SUBMITTED') data.submittedAt = new Date();
  if (input.status === 'APPROVED') {
    data.approvedAt = new Date();
    data.approvedBy = { connect: { id: input.actorId } };
    data.ceoComment = input.comment ?? null;
  }
  if (input.status === 'REJECTED') {
    data.ceoComment = input.comment ?? null;
    data.approvedAt = null;
  }

  await db.kpiPeriod.update({ where: { id: p.id }, data });
  await logActivity({
    actorId: input.actorId,
    action: `period.${input.status.toLowerCase()}`,
    entity: 'KpiPeriod',
    entityId: String(p.id),
    summary: `${p.label} — holat: ${input.status}${input.comment ? `. Izoh: ${input.comment}` : ''}`,
  });
}

export async function updatePeriodSettings(input: {
  period: string;
  bonusShare: number;
  threshold: number;
  cap: number;
  workingDays: number;
  note: string | null;
  actorId: string;
}): Promise<void> {
  const p = await ensurePeriod(input.period);
  if (p.status === 'APPROVED') throw new Error('Tasdiqlangan davr sozlamalari o‘zgarmaydi');

  await db.kpiPeriod.update({
    where: { id: p.id },
    data: {
      bonusShare: input.bonusShare,
      threshold: input.threshold,
      cap: input.cap,
      workingDays: input.workingDays,
      note: input.note,
    },
  });
  await recalculatePeriod(input.period, input.actorId);
}
