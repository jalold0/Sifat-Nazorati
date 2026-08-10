/**
 * Kunlik reyestr — butun tizimning poydevori.
 * KPI, quvvat hisobi va oylik hisobot faqat shu jadvaldan oziqlanadi.
 */

import 'server-only';

import type { Prisma, Priority, TaskKind, TicketStatus } from '@prisma/client';

import { isSlaMet } from '@/domain/sla';
import { db } from '@/lib/db';
import { dayKey, periodRange } from '@/lib/period';

import { num } from './shared';

export interface RegistryFilter {
  period?: string;
  from?: Date;
  to?: Date;
  ownerId?: string;
  zoneCode?: string;
  status?: TicketStatus;
  kind?: TaskKind;
  priority?: Priority;
  channel?: string;
  search?: string;
  /** Faqat SLA buzilgan yoki xavf ostidagilar */
  problemsOnly?: boolean;
}

function where(filter: RegistryFilter): Prisma.TicketWhereInput {
  const range = filter.period ? periodRange(filter.period) : null;
  const from = filter.from ?? range?.from;
  const to = filter.to ?? range?.to;

  const and: Prisma.TicketWhereInput[] = [];
  if (from) and.push({ date: { gte: from } });
  if (to) and.push({ date: { lt: to } });
  if (filter.ownerId) and.push({ ownerId: filter.ownerId });
  if (filter.zoneCode) and.push({ zoneCode: filter.zoneCode });
  if (filter.status) and.push({ status: filter.status });
  if (filter.kind) and.push({ kind: filter.kind });
  if (filter.priority) and.push({ priority: filter.priority });
  if (filter.channel) and.push({ channel: filter.channel });
  if (filter.problemsOnly) {
    and.push({
      OR: [{ slaMet: false }, { status: 'ESCALATED' }, { AND: [{ status: { in: ['OPEN', 'IN_PROGRESS'] } }] }],
    });
  }
  if (filter.search) {
    const q = filter.search.trim();
    and.push({
      OR: [
        { ref: { contains: q, mode: 'insensitive' } },
        { externalRef: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { objectName: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

const LIST_SELECT = {
  id: true,
  ref: true,
  date: true,
  channel: true,
  zoneCode: true,
  category: true,
  objectName: true,
  description: true,
  externalRef: true,
  priority: true,
  kind: true,
  status: true,
  receivedAt: true,
  firstResponseAt: true,
  escalatedAt: true,
  closedAt: true,
  spentHours: true,
  slaHours: true,
  slaMet: true,
  isRepeat: true,
  rootCause: true,
  actionTaken: true,
  source: true,
  owner: { select: { id: true, shortName: true, key: true } },
  taskDef: { select: { no: true, title: true } },
} satisfies Prisma.TicketSelect;

export type TicketRow = Prisma.TicketGetPayload<{ select: typeof LIST_SELECT }>;

export async function listTickets(
  filter: RegistryFilter,
  { take = 200, skip = 0 }: { take?: number; skip?: number } = {},
): Promise<{ rows: TicketRow[]; total: number }> {
  const [rows, total] = await Promise.all([
    db.ticket.findMany({
      where: where(filter),
      select: LIST_SELECT,
      orderBy: [{ date: 'desc' }, { receivedAt: 'desc' }],
      take,
      skip,
    }),
    db.ticket.count({ where: where(filter) }),
  ]);
  return { rows, total };
}

export async function getTicket(id: string) {
  return db.ticket.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, shortName: true } },
      createdBy: { select: { shortName: true } },
      taskDef: { select: { no: true, title: true, slaHours: true } },
      zone: { select: { code: true, name: true } },
    },
  });
}

/**
 * Murojaat raqamini generatsiya qilish: IP-2606-0042
 * (IP — iPOST, 26 — yil, 06 — oy, keyin oy ichidagi tartib raqam).
 */
export async function nextTicketRef(date: Date): Promise<string> {
  const period = dayKey(date).slice(0, 7);
  const prefix = `IP-${period.slice(2, 4)}${period.slice(5, 7)}-`;
  const last = await db.ticket.findFirst({
    where: { ref: { startsWith: prefix } },
    orderBy: { ref: 'desc' },
    select: { ref: true },
  });
  const seq = last ? Number(last.ref.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export interface CreateTicketInput {
  date: Date;
  channel: string;
  zoneCode: string;
  taskDefId: number | null;
  category: string;
  objectName: string | null;
  description: string;
  externalRef: string | null;
  ownerId: string;
  priority: Priority;
  kind: TaskKind;
  slaHours: number;
  receivedAt: Date;
  firstResponseAt: Date | null;
  escalatedAt: Date | null;
  closedAt: Date | null;
  spentHours: number | null;
  isRepeat: boolean;
  rootCause: string | null;
  actionTaken: string | null;
  status: TicketStatus;
  createdById: string;
}

export async function createTicket(input: CreateTicketInput) {
  const ref = await nextTicketRef(input.date);
  return db.ticket.create({
    data: {
      ...input,
      ref,
      slaMet: isSlaMet(input.receivedAt, input.closedAt, input.slaHours),
    },
    select: { id: true, ref: true },
  });
}

export interface UpdateTicketInput extends Partial<Omit<CreateTicketInput, 'createdById'>> {
  id: string;
}

export async function updateTicket({ id, ...patch }: UpdateTicketInput) {
  const current = await db.ticket.findUniqueOrThrow({
    where: { id },
    select: { receivedAt: true, closedAt: true, slaHours: true },
  });

  const receivedAt = patch.receivedAt ?? current.receivedAt;
  const closedAt = patch.closedAt !== undefined ? patch.closedAt : current.closedAt;
  const slaHours = patch.slaHours ?? current.slaHours;

  return db.ticket.update({
    where: { id },
    data: { ...patch, slaMet: isSlaMet(receivedAt, closedAt, slaHours) },
    select: { id: true, ref: true },
  });
}

/** Murojaatni yopish — SLA avtomatik hisoblanadi. */
export async function closeTicket(input: {
  id: string;
  closedAt: Date;
  spentHours: number;
  rootCause: string;
  actionTaken: string;
  isRepeat: boolean;
}) {
  return updateTicket({
    id: input.id,
    status: 'CLOSED',
    closedAt: input.closedAt,
    spentHours: input.spentHours,
    rootCause: input.rootCause,
    actionTaken: input.actionTaken,
    isRepeat: input.isRepeat,
  });
}

// ── Yig'ma ko'rsatkichlar ────────────────────────────────────────────────────

export interface RegistrySummary {
  total: number;
  closed: number;
  open: number;
  breached: number;
  proactive: number;
  reactive: number;
  repeat: number;
  critical: number;
  spentHours: number;
  slaDecided: number;
  slaMet: number;
  avgCloseHours: number | null;
  avgFirstResponseHours: number | null;
}

export async function summarise(filter: RegistryFilter): Promise<RegistrySummary> {
  const rows = await db.ticket.findMany({
    where: where(filter),
    select: {
      status: true,
      kind: true,
      priority: true,
      slaMet: true,
      isRepeat: true,
      spentHours: true,
      receivedAt: true,
      firstResponseAt: true,
      closedAt: true,
    },
  });

  const closeDurations: number[] = [];
  const responseDurations: number[] = [];
  const summary: RegistrySummary = {
    total: 0,
    closed: 0,
    open: 0,
    breached: 0,
    proactive: 0,
    reactive: 0,
    repeat: 0,
    critical: 0,
    spentHours: 0,
    slaDecided: 0,
    slaMet: 0,
    avgCloseHours: null,
    avgFirstResponseHours: null,
  };

  for (const t of rows) {
    if (t.status === 'CANCELLED') continue;
    summary.total += 1;
    if (t.status === 'CLOSED') summary.closed += 1;
    else summary.open += 1;
    if (t.slaMet === false) summary.breached += 1;
    if (t.slaMet !== null) {
      summary.slaDecided += 1;
      if (t.slaMet) summary.slaMet += 1;
    }
    if (t.kind === 'PROACTIVE') summary.proactive += 1;
    else summary.reactive += 1;
    if (t.isRepeat) summary.repeat += 1;
    if (t.priority === 'CRITICAL') summary.critical += 1;
    summary.spentHours += num(t.spentHours) ?? 0;

    if (t.closedAt) closeDurations.push((t.closedAt.getTime() - t.receivedAt.getTime()) / 3_600_000);
    if (t.firstResponseAt)
      responseDurations.push((t.firstResponseAt.getTime() - t.receivedAt.getTime()) / 3_600_000);
  }

  summary.spentHours = Math.round(summary.spentHours * 100) / 100;
  summary.avgCloseHours = mean(closeDurations);
  summary.avgFirstResponseHours = mean(responseDurations);
  return summary;
}

/** Zona kesimidagi yig'ma — oylik hisobotning 2-bo'limi. */
export async function byZone(period: string) {
  const rows = await db.ticket.groupBy({
    by: ['zoneCode'],
    where: where({ period }),
    _count: { _all: true },
    _sum: { spentHours: true },
  });
  const slaRows = await db.ticket.groupBy({
    by: ['zoneCode'],
    where: { ...where({ period }), slaMet: true },
    _count: { _all: true },
  });
  const slaMap = new Map(slaRows.map((r) => [r.zoneCode, r._count._all]));

  return rows
    .map((r) => ({
      zoneCode: r.zoneCode,
      count: r._count._all,
      spentHours: num(r._sum.spentHours) ?? 0,
      slaMet: slaMap.get(r.zoneCode) ?? 0,
    }))
    .sort((a, b) => a.zoneCode.localeCompare(b.zoneCode));
}

/** Xodim kesimidagi yuklama — 3-bo'lim va yuklama muvozanati. */
export async function byOwner(period: string) {
  const rows = await db.ticket.groupBy({
    by: ['ownerId'],
    where: where({ period }),
    _count: { _all: true },
    _sum: { spentHours: true },
  });
  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.ownerId) } },
    select: { id: true, shortName: true, key: true, role: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return rows
    .map((r) => ({
      ownerId: r.ownerId,
      shortName: userMap.get(r.ownerId)?.shortName ?? '—',
      key: userMap.get(r.ownerId)?.key ?? '',
      count: r._count._all,
      spentHours: num(r._sum.spentHours) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Kanal kesimi — "Telegram ko'rinmayapti" muammosini kuzatish uchun. */
export async function byChannel(period: string) {
  const rows = await db.ticket.groupBy({
    by: ['channel'],
    where: where({ period }),
    _count: { _all: true },
  });
  return rows.map((r) => ({ channel: r.channel, count: r._count._all })).sort((a, b) => b.count - a.count);
}

/** Takrorlanadigan sabablar TOP ro'yxati — root-cause tahlili uchun. */
export async function topRootCauses(period: string, limit = 10) {
  const rows = await db.ticket.groupBy({
    by: ['rootCause'],
    where: { ...where({ period }), rootCause: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { rootCause: 'desc' } },
    take: limit,
  });
  return rows
    .filter((r) => r.rootCause && r.rootCause.trim().length > 0)
    .map((r) => ({ rootCause: r.rootCause!, count: r._count._all }));
}

/** Ochiq va muddati o'tgan murojaatlar — dashboard'dagi "darhol chora" bloki. */
export async function overdueTickets(limit = 12) {
  const now = new Date();
  const rows = await db.ticket.findMany({
    where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] } },
    select: LIST_SELECT,
    orderBy: { receivedAt: 'asc' },
    take: 120,
  });
  return rows
    .filter((t) => new Date(t.receivedAt.getTime() + t.slaHours * 3_600_000) < now)
    .slice(0, limit);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}
