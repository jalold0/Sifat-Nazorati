/**
 * Telegram baseline importi — YANGI VERSIYA yaratadi.
 *
 *   pnpm import:baseline                      # joriy foydalanuvchisiz (tizim)
 *   pnpm import:baseline --user jaloldin      # kim yuklaganini qayd etadi
 *   pnpm import:baseline --note "sentabr eksporti"
 *   pnpm import:baseline --list               # faqat tarixni ko'rsatadi
 *
 * Eski versiyalar O'CHIRILMAYDI — ular tarixda sanasi va muallifi bilan qoladi,
 * `/baseline` sahifasida ko'rinadi. Faqat yangi versiya `isCurrent` bo'ladi.
 *
 * Tartib:
 *   1. Telegram eksportini yangilab, Excel tahlilini qayta shakllantiring
 *   2. python scripts/extract_sources.py "<manba papka>"
 *   3. pnpm import:baseline --user <login> --note "<izoh>"
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient, type BreakdownKind } from '@prisma/client';

const db = new PrismaClient();

interface Payload {
  label: string;
  sourceFile: string;
  periodFrom: string;
  periodTo: string;
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
  };
  months: Array<{
    period: string;
    label: string;
    cases: number;
    noTrace: number;
    withTrack: number;
    medianFirstResponseMin: number;
  }>;
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
  operators: Array<{
    name: string;
    login: string;
    role: string;
    total: number;
    status: number;
    archive: number;
    approved: number;
  }>;
  breakdowns: Array<{ kind: string; label: string; value: number; sortOrder: number }>;
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function list() {
  const imports = await db.baselineImport.findMany({
    orderBy: { importedAt: 'desc' },
    include: { importedBy: { select: { shortName: true } } },
  });

  if (imports.length === 0) {
    console.log('Hali baseline importi yo‘q.');
    return;
  }

  console.log('Baseline importlari tarixi:\n');
  for (const i of imports) {
    const when = i.importedAt.toISOString().slice(0, 16).replace('T', ' ');
    console.log(
      `  ${i.isCurrent ? '→' : ' '} #${i.id}  ${when}  ${String(i.totalCases).padStart(6)} ish  ` +
        `${i.importedBy?.shortName ?? 'tizim'}${i.note ? ` · ${i.note}` : ''}`,
    );
  }
}

async function main() {
  if (process.argv.includes('--list')) {
    await list();
    return;
  }

  const payload = JSON.parse(
    readFileSync(join(process.cwd(), 'data', 'baseline-import.json'), 'utf8'),
  ) as Payload;

  const userLogin = arg('user');
  const user = userLogin
    ? await db.user.findUnique({ where: { login: userLogin }, select: { id: true, shortName: true } })
    : null;

  if (userLogin && !user) {
    throw new Error(`"${userLogin}" logini bilan xodim topilmadi`);
  }

  // Oldingi versiyani tarixga o'tkazamiz — o'chirmaymiz
  const previous = await db.baselineImport.findFirst({
    where: { isCurrent: true },
    select: { id: true, totalCases: true, importedAt: true },
  });

  const s = payload.summary;

  const created = await db.$transaction(async (tx) => {
    await tx.baselineImport.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });

    return tx.baselineImport.create({
      data: {
        label: arg('label') ?? payload.label,
        periodFrom: new Date(`${payload.periodFrom}T00:00:00.000Z`),
        periodTo: new Date(`${payload.periodTo}T00:00:00.000Z`),
        sourceFile: payload.sourceFile,
        note: arg('note') ?? null,
        isCurrent: true,
        importedById: user?.id ?? null,

        totalCases: s.totalCases,
        withTrack: s.withTrack,
        withoutTrack: s.withoutTrack,
        uniqueCustomers: s.uniqueCustomers,
        sharedCases: s.sharedCases,
        accountsSum: s.accountsSum,
        excludedCases: s.excludedCases,
        answeredCases: s.answeredCases,
        lateAnswered: s.lateAnswered,
        noTraceCases: s.noTraceCases,
        otherChannel: s.otherChannel,
        noReplyNeeded: s.noReplyNeeded,
        medianFirstResponseMin: s.medianFirstResponseMin,
        within1hShare: s.within1hShare,
        within24hShare: s.within24hShare,
        outsideHoursShare: s.outsideHoursShare,
        system102Cases: s.system102Cases,
        totalMessages: s.totalMessages,
        totalSessions: s.totalSessions,

        months: {
          create: payload.months.map((m) => ({
            period: m.period,
            label: m.label,
            cases: m.cases,
            noTrace: m.noTrace,
            withTrack: m.withTrack,
            medianFirstResponseMin: m.medianFirstResponseMin,
            // 102 tizimining oylik o'rtachasi — grafikdagi taqqoslash chizig'i uchun.
            // Faqat 102 ma'lumoti mavjud oylarga qo'yiladi (2026 yil).
            system102Cases: m.period >= '2026-01' ? Math.round(s.system102Cases / 7.3) : null,
          })),
        },
        accounts: { create: payload.accounts },
        operators: { create: payload.operators },
        breakdowns: {
          create: payload.breakdowns.map((b) => ({
            kind: b.kind as BreakdownKind,
            label: b.label,
            value: b.value,
            sortOrder: b.sortOrder,
          })),
        },
      },
      select: { id: true, label: true, totalCases: true, importedAt: true },
    });
  });

  const delta = previous ? created.totalCases - previous.totalCases : null;

  await db.activityLog.create({
    data: {
      actorId: user?.id ?? null,
      action: 'baseline.import',
      entity: 'BaselineImport',
      entityId: String(created.id),
      summary:
        `Telegram baseline yangilandi: ${created.totalCases} ish` +
        (delta !== null ? ` (oldingi versiyaga nisbatan ${delta >= 0 ? '+' : ''}${delta})` : ' — birinchi versiya') +
        (user ? ` · ${user.shortName}` : ''),
    },
  });

  console.log(`✔ Yangi versiya #${created.id} — ${created.label}`);
  console.log(`  Jami ish: ${created.totalCases}${delta !== null ? ` (${delta >= 0 ? '+' : ''}${delta})` : ''}`);
  console.log(`  Oylar: ${payload.months.length} · akkauntlar: ${payload.accounts.length} · 102: ${payload.operators.length}`);
  console.log(`  Yuklovchi: ${user?.shortName ?? 'tizim'}`);
  if (previous) {
    console.log(`  Oldingi versiya (#${previous.id}) tarixda saqlandi.`);
  }
}

main()
  .catch((error) => {
    console.error('Import xatoligi:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
