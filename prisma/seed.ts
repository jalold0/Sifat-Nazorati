/**
 * Seed — manba Excel fayllaridan chiqarilgan JSON'lar asosida tizimni to'ldiradi.
 *
 * Ishlatish:  pnpm db:seed
 * Idempotent: qayta ishga tushirsa, mavjud yozuvlar yangilanadi (upsert), takrorlanmaydi.
 * Reyestrdagi murojaatlar seed qilinmaydi — ular haqiqiy ishdan to'planadi.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient, type ChecklistKind, type Priority, type Role, type TaskKind } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();
const DATA = join(process.cwd(), 'data');

function load<T>(name: string): T {
  return JSON.parse(readFileSync(join(DATA, name), 'utf8')) as T;
}

// ── Manba tiplari ────────────────────────────────────────────────────────────

interface ZoneJson {
  code: string;
  name: string;
  ownerKey: string;
  location: string;
  coverage: string;
  outcome: string;
}

interface TaskJson {
  no: number;
  zone: string;
  title: string;
  source: string;
  ownerKey: string;
  backupKey: string | null;
  frequency: string;
  slaHours: number | null;
  priority: string;
  kind: string;
}

interface IndicatorJson {
  no: number;
  ownerKey: string;
  name: string;
  shortLabel: string;
  weight: number;
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
  target: number;
  targetText: string;
  formula: string;
  dataSource: string;
  code: string;
  metric: string;
  metricSource: 'AUTO' | 'MANUAL';
  unit: string;
}

interface ChecklistJson {
  kind: string;
  title: string;
  note: string;
  items: Array<{ no: number; title: string; requirement: string; max: number }>;
}

interface CapacityJson {
  inputs: {
    monthlyVolume: number;
    workingDays: number;
    hoursPerDay: number;
    specialists: number;
    utilisation: number;
    proactiveShare: number;
  };
  zoneLoad: Array<{ zone: string; flowShare: number; minutesPerCase: number }>;
}

interface GoalJson {
  metric: string;
  now: string;
  in3Months: string;
  in6Months: string;
  source: string;
}

interface BaselineMonthJson {
  period: string;
  label: string;
  cases: number;
  noTrace: number;
  withTrack: number;
  medianFirstResponseMin: number;
}

interface ReviewJson {
  date: string;
  track: string | null;
  customer: string;
  originType: string;
  category: string;
  account: string;
  text: string;
  hasTrack: boolean;
}

// ── Xodimlar ─────────────────────────────────────────────────────────────────

const PRIORITY: Record<string, Priority> = {
  Kritik: 'CRITICAL',
  Yuqori: 'HIGH',
  "O'rta": 'MEDIUM',
  Past: 'LOW',
};

const KIND: Record<string, TaskKind> = { Proaktiv: 'PROACTIVE', Reaktiv: 'REACTIVE' };

const UNIT: Record<string, 'PERCENT' | 'HOURS' | 'COUNT' | 'RATIO'> = {
  percent: 'PERCENT',
  hours: 'HOURS',
  count: 'COUNT',
  ratio: 'RATIO',
};

interface SeedUser {
  key: string;
  fullName: string;
  shortName: string;
  login: string;
  role: Role;
  position: string;
  salary: number | null;
}

const USERS: SeedUser[] = [
  {
    key: 'ceo',
    fullName: 'Rahbariyat (CEO)',
    shortName: 'CEO',
    login: 'ceo',
    role: 'CEO',
    position: 'Bosh direktor',
    salary: null,
  },
  {
    key: 'head',
    fullName: 'Mirzakbarov Jaloldin',
    shortName: "Bo'lim boshlig'i",
    login: 'jaloldin',
    role: 'HEAD',
    position: "Sifat nazorati bo'limi boshlig'i",
    salary: null,
  },
  {
    key: 'ulugbek',
    fullName: "Muqimjonov Ulug'bek",
    shortName: "Ulug'bek M.",
    login: 'ulugbek',
    role: 'SPECIALIST',
    position: 'Sifat nazorati mutaxassisi — Zona A (Ombor va yuk)',
    salary: 6_000_000,
  },
  {
    key: 'jasur',
    fullName: 'Bafoev Jasur',
    shortName: 'Jasur B.',
    login: 'jasur',
    role: 'SPECIALIST',
    position: 'Sifat nazorati mutaxassisi — Zona B (Yuk oqimi va status)',
    salary: 6_000_000,
  },
  {
    key: 'saidali',
    fullName: 'Shadiyev Saidali',
    shortName: 'Saidali Sh.',
    login: 'saidali',
    role: 'SPECIALIST',
    position: 'Sifat nazorati mutaxassisi — Zona C (Tashqi murojaat)',
    salary: 6_000_000,
  },
];

async function main() {
  console.log('iPOST OTK — seed boshlandi');

  const password = process.env.SEED_DEFAULT_PASSWORD ?? 'Otk2026!';
  const passwordHash = await bcrypt.hash(password, 12);

  // 1. Xodimlar --------------------------------------------------------------
  const userIds = new Map<string, string>();
  for (const u of USERS) {
    const row = await db.user.upsert({
      where: { key: u.key },
      create: { ...u, passwordHash },
      // Parol va maosh qayta seed'da o'zgartirilmaydi — real ma'lumot yo'qolmasligi uchun
      update: { fullName: u.fullName, shortName: u.shortName, login: u.login, role: u.role },
      select: { id: true },
    });
    userIds.set(u.key, row.id);
  }
  console.log(`  ✔ ${USERS.length} xodim`);

  const uid = (key: string): string => {
    const id = userIds.get(key);
    if (!id) throw new Error(`Xodim topilmadi: ${key}`);
    return id;
  };

  // 2. Zonalar ---------------------------------------------------------------
  const zones = load<ZoneJson[]>('zones.json');
  for (const z of zones) {
    await db.zone.upsert({
      where: { code: z.code },
      create: {
        code: z.code,
        name: z.name,
        location: z.location,
        coverage: z.coverage,
        outcome: z.outcome,
        ownerId: uid(z.ownerKey),
      },
      update: { name: z.name, location: z.location, coverage: z.coverage, outcome: z.outcome },
    });
  }
  console.log(`  ✔ ${zones.length} zona`);

  // 3. Vazifalar katalogi (43 ta) --------------------------------------------
  const tasks = load<TaskJson[]>('tasks.json');
  for (const t of tasks) {
    const data = {
      zoneCode: t.zone,
      title: t.title,
      source: t.source,
      ownerId: uid(t.ownerKey),
      backupId: t.backupKey ? uid(t.backupKey) : null,
      frequency: t.frequency,
      slaHours: t.slaHours,
      priority: PRIORITY[t.priority] ?? 'MEDIUM',
      kind: KIND[t.kind] ?? 'REACTIVE',
    };
    await db.taskDef.upsert({ where: { no: t.no }, create: { no: t.no, ...data }, update: data });
  }
  console.log(`  ✔ ${tasks.length} vazifa`);

  // 4. KPI pasporti (20 ta) --------------------------------------------------
  const indicators = load<IndicatorJson[]>('kpi-indicators.json');
  for (const i of indicators) {
    const data = {
      no: i.no,
      ownerId: uid(i.ownerKey),
      name: i.name,
      shortLabel: i.shortLabel,
      weight: i.weight,
      direction: i.direction,
      target: i.target,
      targetText: i.targetText,
      unit: UNIT[i.unit] ?? 'COUNT',
      formula: i.formula,
      dataSource: i.dataSource,
      metric: i.metric,
      metricSource: i.metricSource,
    };
    await db.kpiIndicator.upsert({ where: { code: i.code }, create: { code: i.code, ...data }, update: data });
  }
  console.log(`  ✔ ${indicators.length} KPI ko'rsatkichi`);

  // Og'irliklar tekshiruvi — xodim bo'yicha 100 ball bo'lishi shart
  const byOwner = new Map<string, number>();
  for (const i of indicators) byOwner.set(i.ownerKey, (byOwner.get(i.ownerKey) ?? 0) + i.weight * 100);
  for (const [key, total] of byOwner) {
    if (Math.abs(total - 100) > 0.01) {
      console.warn(`  ⚠ ${key}: og'irliklar yig'indisi ${total} (100 bo'lishi kerak)`);
    }
  }

  // 5. Checklist shablonlari -------------------------------------------------
  const checklists = load<ChecklistJson[]>('checklists.json');
  for (const c of checklists) {
    const template = await db.checklistTemplate.upsert({
      where: { kind: c.kind as ChecklistKind },
      create: { kind: c.kind as ChecklistKind, title: c.title, note: c.note },
      update: { title: c.title, note: c.note },
      select: { id: true },
    });
    for (const item of c.items) {
      await db.checklistItem.upsert({
        where: { templateId_no: { templateId: template.id, no: item.no } },
        create: { templateId: template.id, no: item.no, title: item.title, requirement: item.requirement, max: item.max },
        update: { title: item.title, requirement: item.requirement, max: item.max },
      });
    }
  }
  console.log(`  ✔ ${checklists.length} checklist (${checklists.reduce((s, c) => s + c.items.length, 0)} band)`);

  // 6. Quvvat hisobi baseline ------------------------------------------------
  const capacity = load<CapacityJson>('capacity.json');
  const scenarioName = 'May 2026 fakti (hujjat asosida)';
  const existing = await db.capacityScenario.findUnique({
    where: { name_period: { name: scenarioName, period: '2026-05' } },
    select: { id: true },
  });
  if (!existing) {
    await db.capacityScenario.create({
      data: {
        name: scenarioName,
        period: '2026-05',
        monthlyVolume: capacity.inputs.monthlyVolume,
        workingDays: capacity.inputs.workingDays,
        hoursPerDay: capacity.inputs.hoursPerDay,
        specialists: capacity.inputs.specialists,
        utilisation: capacity.inputs.utilisation,
        proactiveShare: capacity.inputs.proactiveShare,
        isBaseline: true,
        note: "Yuklangan OTK hujjatidagi boshlang'ich hisob — xronometrajdan keyin yangilanadi",
        zones: {
          create: capacity.zoneLoad.map((z) => ({
            zoneCode: z.zone,
            flowShare: z.flowShare,
            minutesPerCase: z.minutesPerCase,
          })),
        },
      },
    });
    console.log('  ✔ quvvat hisobi baseline');
  } else {
    console.log('  · quvvat hisobi baseline mavjud');
  }

  // 7. 6 oylik maqsadlar ----------------------------------------------------
  const goals = load<GoalJson[]>('goals.json');
  for (const g of goals) {
    await db.goal.upsert({
      where: { metric: g.metric },
      create: { metric: g.metric, current: g.now, inThree: g.in3Months, inSix: g.in6Months, dataSource: g.source },
      update: { current: g.now, inThree: g.in3Months, inSix: g.in6Months, dataSource: g.source },
    });
  }
  console.log(`  ✔ ${goals.length} maqsad`);

  // 8. Telegram baseline (grafiklar uchun) ----------------------------------
  const monthly = load<BaselineMonthJson[]>('baseline-monthly.json');
  // 102 tizimining oylik o'rtachasi — taqqoslash chizig'i uchun
  const avg102 = Math.round(6061 / 7.3);
  for (const m of monthly) {
    await db.baselineMonth.upsert({
      where: { period: m.period },
      create: {
        period: m.period,
        label: m.label,
        cases: m.cases,
        noTrace: m.noTrace,
        withTrack: m.withTrack,
        medianFirstResponseMin: m.medianFirstResponseMin,
        system102Cases: m.period >= '2026-01' ? avg102 : null,
      },
      update: { cases: m.cases, noTrace: m.noTrace, withTrack: m.withTrack },
    });
  }
  console.log(`  ✔ ${monthly.length} oylik baseline`);

  // 9. Tekshirish ro'yxati (javob izi yo'q ishlar) --------------------------
  const alreadyImported = await db.reviewItem.count();
  if (alreadyImported === 0) {
    const queue = load<ReviewJson[]>('review-queue.json');
    const CHUNK = 500;
    for (let i = 0; i < queue.length; i += CHUNK) {
      await db.reviewItem.createMany({
        data: queue.slice(i, i + CHUNK).map((r) => ({
          occurredOn: new Date(`${r.date}T00:00:00.000Z`),
          track: r.track,
          customer: r.customer || '(nomsiz)',
          originType: r.originType || 'Tashqi',
          category: r.category || "Boshqa / aniqlanmagan",
          account: r.account || '—',
          text: r.text ?? '',
          hasTrack: r.hasTrack,
        })),
      });
    }
    console.log(`  ✔ ${queue.length} tekshirish yozuvi`);
  } else {
    console.log(`  · tekshirish ro'yxati mavjud (${alreadyImported} yozuv)`);
  }

  console.log(`\nTayyor. Loginlar: ${USERS.map((u) => u.login).join(', ')} — parol: ${password}`);
  console.log('MUHIM: birinchi kirishdan keyin parollarni almashtiring.');
}

main()
  .catch((error) => {
    console.error('Seed xatoligi:', error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
