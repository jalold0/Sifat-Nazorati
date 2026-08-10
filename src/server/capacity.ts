/**
 * Quvvat hisobi — shtat ehtiyojini raqam bilan asoslash.
 * Xronometraj reyestrdan olinadi, shuning uchun norma "taxmin" emas, o'lchov bo'ladi.
 */

import 'server-only';

import { computeCapacity, deriveNormFromRegistry, type CapacityResult, type ZoneNorm } from '@/domain/capacity';
import { db } from '@/lib/db';
import { periodRange } from '@/lib/period';

import { num, num0 } from './shared';

export async function listScenarios() {
  return db.capacityScenario.findMany({
    orderBy: [{ period: 'desc' }, { id: 'desc' }],
    include: { zones: { orderBy: { zoneCode: 'asc' } } },
  });
}

export async function getScenario(id: number) {
  return db.capacityScenario.findUnique({
    where: { id },
    include: { zones: { orderBy: { zoneCode: 'asc' } } },
  });
}

export async function computeScenario(id: number): Promise<CapacityResult | null> {
  const s = await getScenario(id);
  if (!s) return null;
  return computeCapacity(
    {
      monthlyVolume: s.monthlyVolume,
      workingDays: s.workingDays,
      hoursPerDay: num0(s.hoursPerDay),
      specialists: num0(s.specialists),
      utilisation: num0(s.utilisation),
      proactiveShare: num0(s.proactiveShare),
    },
    s.zones.map((z) => ({
      zoneCode: z.zoneCode,
      flowShare: num0(z.flowShare),
      minutesPerCase: num0(z.minutesPerCase),
    })),
  );
}

export interface SaveScenarioInput {
  id?: number;
  name: string;
  period: string;
  monthlyVolume: number;
  workingDays: number;
  hoursPerDay: number;
  specialists: number;
  utilisation: number;
  proactiveShare: number;
  note: string | null;
  zones: ZoneNorm[];
}

export async function saveScenario(input: SaveScenarioInput) {
  const data = {
    name: input.name,
    period: input.period,
    monthlyVolume: input.monthlyVolume,
    workingDays: input.workingDays,
    hoursPerDay: input.hoursPerDay,
    specialists: input.specialists,
    utilisation: input.utilisation,
    proactiveShare: input.proactiveShare,
    note: input.note,
  };

  if (input.id) {
    await db.capacityZone.deleteMany({ where: { scenarioId: input.id } });
    return db.capacityScenario.update({
      where: { id: input.id },
      data: {
        ...data,
        zones: {
          create: input.zones.map((z) => ({
            zoneCode: z.zoneCode,
            flowShare: z.flowShare,
            minutesPerCase: z.minutesPerCase,
          })),
        },
      },
      select: { id: true },
    });
  }

  return db.capacityScenario.create({
    data: {
      ...data,
      zones: {
        create: input.zones.map((z) => ({
          zoneCode: z.zoneCode,
          flowShare: z.flowShare,
          minutesPerCase: z.minutesPerCase,
        })),
      },
    },
    select: { id: true },
  });
}

export interface MeasuredNorm {
  norms: ZoneNorm[];
  measuredCases: number;
  casesWithTime: number;
  /** Vaqt qayd etilgan murojaatlar ulushi — 100% ga yaqin bo'lmasa norma ishonchsiz */
  coverage: number;
}

/** Reyestrdagi haqiqiy vaqt bo'yicha zona normalarini o'lchash (xronometraj). */
export async function measureNorms(period: string): Promise<MeasuredNorm> {
  const { from, to } = periodRange(period);
  const rows = await db.ticket.findMany({
    where: { date: { gte: from, lt: to }, status: { not: 'CANCELLED' } },
    select: { zoneCode: true, spentHours: true },
  });

  const withTime = rows.filter((r) => num(r.spentHours) !== null && num0(r.spentHours) > 0);

  return {
    norms: deriveNormFromRegistry(
      withTime.map((r) => ({ zoneCode: r.zoneCode, spentHours: num(r.spentHours) })),
      withTime.length,
    ),
    measuredCases: rows.length,
    casesWithTime: withTime.length,
    coverage: rows.length > 0 ? Math.round((withTime.length / rows.length) * 10000) / 10000 : 0,
  };
}
