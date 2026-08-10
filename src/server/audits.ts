/**
 * Checklist auditlari — ombor/RS, filial va qo'ng'iroq sifati.
 * Audit soni to'g'ridan-to'g'ri KPI'ga kiradi (qamrov ko'rsatkichlari).
 */

import 'server-only';

import type { ChecklistKind, Prisma } from '@prisma/client';

import { scoreAudit, type AuditAnswerInput } from '@/domain/checklist';
import { db } from '@/lib/db';
import { periodRange } from '@/lib/period';

import { num } from './shared';

export async function getTemplate(kind: ChecklistKind) {
  return db.checklistTemplate.findUnique({
    where: { kind },
    include: { items: { orderBy: { no: 'asc' } } },
  });
}

export async function listTemplates() {
  return db.checklistTemplate.findMany({
    orderBy: { id: 'asc' },
    include: { _count: { select: { items: true, audits: true } } },
  });
}

/** Shablonlar + bandlari — audit shakli uchun. */
export async function listTemplatesWithItems() {
  return db.checklistTemplate.findMany({
    where: { active: true },
    orderBy: { id: 'asc' },
    include: { items: { orderBy: { no: 'asc' } } },
  });
}

export interface AuditFilter {
  period?: string;
  kind?: ChecklistKind;
  auditorId?: string;
}

function where(filter: AuditFilter): Prisma.AuditWhereInput {
  const range = filter.period ? periodRange(filter.period) : null;
  return {
    ...(range ? { auditedAt: { gte: range.from, lt: range.to } } : {}),
    ...(filter.kind ? { kind: filter.kind } : {}),
    ...(filter.auditorId ? { auditorId: filter.auditorId } : {}),
  };
}

export async function listAudits(filter: AuditFilter, take = 100) {
  return db.audit.findMany({
    where: where(filter),
    orderBy: [{ auditedAt: 'desc' }, { id: 'desc' }],
    take,
    select: {
      id: true,
      kind: true,
      objectName: true,
      objectCode: true,
      externalRef: true,
      auditedAt: true,
      totalScore: true,
      maxScore: true,
      percent: true,
      verdict: true,
      notes: true,
      auditor: { select: { shortName: true } },
    },
  });
}

export async function getAudit(id: number) {
  return db.audit.findUnique({
    where: { id },
    include: {
      auditor: { select: { shortName: true } },
      template: { include: { items: { orderBy: { no: 'asc' } } } },
      answers: true,
    },
  });
}

export interface CreateAuditInput {
  kind: ChecklistKind;
  objectName: string;
  objectCode: string | null;
  externalRef: string | null;
  auditedAt: Date;
  auditorId: string;
  notes: string | null;
  answers: AuditAnswerInput[];
}

/**
 * Auditni saqlaydi. Ball, foiz va xulosa server tomonda hisoblanadi —
 * mijoz tomondan yuborilgan ballga ishonilmaydi.
 */
export async function createAudit(input: CreateAuditInput) {
  const template = await db.checklistTemplate.findUniqueOrThrow({
    where: { kind: input.kind },
    include: { items: { orderBy: { no: 'asc' } } },
  });

  const scored = scoreAudit(
    template.items.map((i) => ({ id: i.id, no: i.no, max: i.max })),
    input.answers,
  );

  if (scored.missingEvidence.length > 0) {
    throw new Error(
      `Dalil yozilishi shart bo'lgan bandlar: ${scored.missingEvidence.join(', ')} — 0 va 1 baholarga izoh kerak`,
    );
  }

  // Shu ob'ektning oldingi natijasi — dinamikani ko'rsatish uchun
  const previous = await db.audit.findFirst({
    where: { kind: input.kind, objectName: input.objectName },
    orderBy: { auditedAt: 'desc' },
    select: { percent: true },
  });

  return db.audit.create({
    data: {
      templateId: template.id,
      kind: input.kind,
      objectName: input.objectName,
      objectCode: input.objectCode,
      externalRef: input.externalRef,
      auditedAt: input.auditedAt,
      auditorId: input.auditorId,
      notes: input.notes,
      previousPercent: previous ? num(previous.percent) : null,
      totalScore: scored.totalScore,
      maxScore: scored.maxScore,
      percent: scored.percent,
      verdict: scored.verdict.label,
      answers: {
        create: input.answers.map((a) => ({
          itemId: a.itemId,
          score: Math.max(0, Math.min(Math.round(a.score), 2)),
          note: a.note ?? null,
        })),
      },
    },
    select: { id: true, percent: true, verdict: true },
  });
}

export interface AuditCoverage {
  kind: ChecklistKind;
  count: number;
  plan: number;
  avgPercent: number | null;
  failing: number;
}

/** Rejali audit qamrovi — KPI №3 (14 ta ombor/RS) va №35 (40 ta filial), №14 (200 chat). */
const PLAN: Record<ChecklistKind, number> = { WAREHOUSE: 14, BRANCH: 40, CALL: 200 };

export async function coverage(period: string): Promise<AuditCoverage[]> {
  const rows = await db.audit.groupBy({
    by: ['kind'],
    where: where({ period }),
    _count: { _all: true },
    _avg: { percent: true },
  });
  const failing = await db.audit.groupBy({
    by: ['kind'],
    where: { ...where({ period }), percent: { lt: 0.6 } },
    _count: { _all: true },
  });
  const failMap = new Map(failing.map((f) => [f.kind, f._count._all]));

  return (['WAREHOUSE', 'BRANCH', 'CALL'] as ChecklistKind[]).map((kind) => {
    const row = rows.find((r) => r.kind === kind);
    return {
      kind,
      count: row?._count._all ?? 0,
      plan: PLAN[kind],
      avgPercent: row ? num(row._avg.percent) : null,
      failing: failMap.get(kind) ?? 0,
    };
  });
}

/** Eng past ball olgan ob'ektlar — qayta tekshiruv rejasi uchun. */
export async function worstObjects(period: string, limit = 8) {
  return db.audit.findMany({
    where: { ...where({ period }), percent: { lt: 0.75 } },
    orderBy: { percent: 'asc' },
    take: limit,
    select: {
      id: true,
      kind: true,
      objectName: true,
      percent: true,
      verdict: true,
      auditedAt: true,
    },
  });
}
