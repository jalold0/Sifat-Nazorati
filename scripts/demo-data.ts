/**
 * NAMUNAVIY (demo) ma'lumot — tizimni ko'rsatish va tekshirish uchun.
 *
 *   pnpm demo:seed    — joriy va o'tgan oy uchun reyestr, audit va yechimlar yaratadi
 *   pnpm demo:clear   — namunaviy ma'lumotni to'liq o'chiradi
 *
 * Barcha yozuvlar `source = IMPORT` va izohida "[demo]" belgisi bilan yaratiladi,
 * shuning uchun haqiqiy ish ma'lumotidan ajratib olish oson.
 *
 * MUHIM: ishga tushirishdan oldin tizim seed qilingan bo'lishi kerak (pnpm db:seed).
 */

import { PrismaClient, type Priority, type TaskKind } from '@prisma/client';

import { scoreAudit } from '../src/domain/checklist';
import { isSlaMet } from '../src/domain/sla';
import { periodOf, periodRange, shiftPeriod } from '../src/lib/period';

const db = new PrismaClient();

const DEMO_MARK = '[demo]';

/** Takrorlanadigan natija uchun oddiy deterministik generator. */
function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const ROOT_CAUSES = [
  'Filial xodimi SMS yubormagan — jarayon nazorat qilinmagan',
  "Skanerlash smena oxirida bajarilmagan — intizom buzilishi",
  'Hamkor tizimida status kechikib yangilanadi',
  'Yuk noto‘g‘ri yo‘naltirilgan — manzil kodi xato kiritilgan',
  'Operator mijozga aniq muddat aytmagan',
  'IT tomonda trek bazaga tushmagan',
  'Vozvrat reglament muddatida bajarilmagan',
  'Xitoy omboridan invoys ma‘lumoti to‘liq kelmagan',
];

const ACTIONS = [
  'Filial mudiriga ogohlantirish berildi, SMS avtomatlashtirish so‘rovi yuborildi',
  'Smena topshirish tartibi qayta tushuntirildi, nazorat ro‘yxati joriy etildi',
  'Hamkor bilan status almashinuvi bo‘yicha kelishuv yangilandi',
  'Yuk qayta yo‘naltirildi, manzil kodlari qo‘lda tekshirildi',
  'Operatorga skript bo‘yicha qayta o‘qitish belgilandi',
  'IT ga tiket ochildi, trek qo‘lda bazaga kiritildi',
  'Vozvrat jarayoni tezlashtirildi, mas‘ul belgilandi',
  'Invoys tekshiruvi qabul bosqichiga qo‘shildi',
];

const OBJECTS = [
  'Chilonzor filiali',
  'Yunusobod filiali',
  'Sergeli filiali',
  'Toshkent ombori №1',
  'Toshkent ombori №2',
  'Samarqand RS',
  'Buxoro RS',
  'Farg‘ona RS',
  'Andijon RS',
  'Namangan RS',
  'EMU Control',
  'BTS punkti — Chorsu',
];

/** Zona bo'yicha 1 murojaatga o'rtacha daqiqa (hujjatdagi norma) */
const ZONE_MINUTES: Record<string, number> = { A: 6, B: 7, C: 9, D: 15 };

async function clear() {
  const tickets = await db.ticket.deleteMany({ where: { rootCause: { contains: DEMO_MARK } } });
  const openTickets = await db.ticket.deleteMany({ where: { description: { contains: DEMO_MARK } } });
  const audits = await db.audit.deleteMany({ where: { notes: { contains: DEMO_MARK } } });
  const actions = await db.rootCauseAction.deleteMany({ where: { problem: { contains: DEMO_MARK } } });
  console.log(
    `o'chirildi: ${tickets.count + openTickets.count} murojaat, ${audits.count} audit, ${actions.count} yechim`,
  );
}

async function seed() {
  // Takroriy ishga tushirishda eski namunaviy yozuvlar tozalanadi
  await clear();

  const [tasks, head, specialists, templates] = await Promise.all([
    db.taskDef.findMany({ where: { active: true }, select: { id: true, no: true, zoneCode: true, title: true, source: true, ownerId: true, slaHours: true, priority: true, kind: true } }),
    db.user.findFirstOrThrow({ where: { role: 'HEAD' }, select: { id: true } }),
    db.user.findMany({ where: { role: 'SPECIALIST' }, select: { id: true, key: true } }),
    db.checklistTemplate.findMany({ include: { items: { orderBy: { no: 'asc' } } } }),
  ]);

  if (tasks.length === 0) throw new Error('Vazifalar katalogi bo‘sh — avval `pnpm db:seed` ishga tushiring');

  const periods = [shiftPeriod(periodOf(), -1), periodOf()];
  const random = rng(20260811);

  let created = 0;

  for (const period of periods) {
    const { from, to } = periodRange(period);
    const lastDay = new Date(to.getTime() - 86_400_000);
    const today = new Date();
    const endDay = lastDay < today ? lastDay : today;

    // Oy ichidagi ish kunlari (yakshanbadan tashqari)
    const days: Date[] = [];
    for (const d = new Date(from); d <= endDay; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() !== 0) days.push(new Date(d));
    }

    const prefix = `IP-${period.slice(2, 4)}${period.slice(5, 7)}-`;
    let seq = 0;

    for (const day of days) {
      // Kuniga 4–9 murojaat
      const count = 4 + Math.floor(random() * 6);
      for (let i = 0; i < count; i += 1) {
        const task = tasks[Math.floor(random() * tasks.length)]!;
        const slaHours = task.slaHours ?? 24;

        // Qabul vaqti: 09:00–18:00 oralig'i (ba'zan ish vaqtidan tashqari)
        const hour = random() < 0.22 ? Math.floor(random() * 24) : 9 + Math.floor(random() * 9);
        const receivedAt = new Date(day);
        receivedAt.setUTCHours(hour - 5, Math.floor(random() * 60), 0, 0); // Toshkent → UTC

        const firstResponseAt = random() < 0.94
          ? new Date(receivedAt.getTime() + (5 + random() * 90) * 60_000)
          : null;

        // 88% yopilgan; yopilganlarning 82% i muddat ichida
        const isClosed = random() < 0.88;
        const onTime = random() < 0.82;
        const closedAt = isClosed
          ? new Date(
              receivedAt.getTime() +
                (onTime ? slaHours * (0.15 + random() * 0.7) : slaHours * (1.1 + random() * 1.4)) * 3_600_000,
            )
          : null;

        const escalatedAt =
          !isClosed && random() < 0.5
            ? new Date(receivedAt.getTime() + (0.5 + random() * 2.5) * 3_600_000)
            : null;

        const minutes = ZONE_MINUTES[task.zoneCode] ?? 8;
        const spentHours = isClosed
          ? Math.round(((minutes * (0.6 + random() * 1.1)) / 60) * 100) / 100
          : null;

        const causeIndex = Math.floor(random() * ROOT_CAUSES.length);
        seq += 1;

        await db.ticket.create({
          data: {
            ref: `${prefix}${String(seq).padStart(4, '0')}`,
            date: day,
            channel: task.source,
            zoneCode: task.zoneCode,
            taskDefId: task.id,
            category: task.title.slice(0, 70),
            objectName: OBJECTS[Math.floor(random() * OBJECTS.length)]!,
            description: `${DEMO_MARK} ${task.title} — namunaviy yozuv`,
            externalRef: random() < 0.6 ? String(78550000000000 + Math.floor(random() * 9999999)) : null,
            ownerId: task.ownerId,
            priority: task.priority as Priority,
            kind: task.kind as TaskKind,
            status: isClosed ? 'CLOSED' : escalatedAt ? 'ESCALATED' : random() < 0.5 ? 'OPEN' : 'IN_PROGRESS',
            receivedAt,
            firstResponseAt,
            escalatedAt,
            closedAt,
            spentHours,
            slaHours,
            slaMet: isSlaMet(receivedAt, closedAt, slaHours),
            isRepeat: random() < 0.17,
            rootCause: isClosed ? `${DEMO_MARK} ${ROOT_CAUSES[causeIndex]}` : null,
            actionTaken: isClosed ? ACTIONS[causeIndex]! : null,
            source: 'IMPORT',
            createdById: task.ownerId,
          },
        });
        created += 1;
      }
    }

    // ── Auditlar ───────────────────────────────────────────────────────────
    const auditPlan: Array<{ kind: 'WAREHOUSE' | 'BRANCH' | 'CALL'; count: number; auditorKey: string }> = [
      { kind: 'WAREHOUSE', count: 9, auditorKey: 'ulugbek' },
      { kind: 'BRANCH', count: 24, auditorKey: 'saidali' },
      { kind: 'CALL', count: 46, auditorKey: 'saidali' },
    ];

    for (const plan of auditPlan) {
      const template = templates.find((t) => t.kind === plan.kind);
      if (!template) continue;
      const auditor = specialists.find((s) => s.key === plan.auditorKey) ?? { id: head.id };

      for (let i = 0; i < plan.count; i += 1) {
        const day = days[Math.floor(random() * days.length)]!;
        const answers = template.items.map((item) => {
          const roll = random();
          const value = roll < 0.72 ? 2 : roll < 0.92 ? 1 : 0;
          return {
            itemId: item.id,
            score: value,
            note: value < item.max ? `${DEMO_MARK} dalil: tekshiruv qaydi №${i + 1}` : null,
          };
        });

        const scored = scoreAudit(
          template.items.map((i) => ({ id: i.id, no: i.no, max: i.max })),
          answers,
        );

        await db.audit.create({
          data: {
            templateId: template.id,
            kind: plan.kind,
            objectName:
              plan.kind === 'CALL'
                ? `Operator ${['Aziza K.', 'Bekzod T.', 'Dilnoza M.', 'Sardor R.'][Math.floor(random() * 4)]}`
                : OBJECTS[Math.floor(random() * OBJECTS.length)]!,
            objectCode: plan.kind === 'CALL' ? null : `F-${100 + Math.floor(random() * 899)}`,
            externalRef: plan.kind === 'CALL' ? `CH-${1000 + Math.floor(random() * 8999)}` : null,
            auditedAt: day,
            auditorId: auditor.id,
            notes: `${DEMO_MARK} namunaviy audit`,
            totalScore: scored.totalScore,
            maxScore: scored.maxScore,
            percent: scored.percent,
            verdict: scored.verdict.label,
            answers: { create: answers.map((a) => ({ itemId: a.itemId, score: a.score, note: a.note })) },
          },
        });
      }
    }

    // ── Tizimli yechimlar ──────────────────────────────────────────────────
    const solutions = [
      {
        title: 'Filialda mijozga xabar berilmayapti',
        rootCause: 'SMS yuborish qo‘lda bajariladi va nazorat qilinmaydi',
        solution: 'Yuk filialga kelganda avtomatik SMS — IT bilan joriy etish',
        responsibleDept: 'IT',
        status: 'VERIFIED' as const,
        effect: 'Kechikish shikoyatlari 40% kamaydi',
        repeatCount: 34,
      },
      {
        title: 'Adashgan yuklar ombor saralashda',
        rootCause: 'Saralash zonasida yorliq tizimi yo‘q',
        solution: 'Zonalarni rangli belgilash va smena oxirida 0 qoldiq nazorati',
        responsibleDept: 'Toshkent ombori',
        status: 'VERIFIED' as const,
        effect: 'Adashgan yuk ulushi 2.0% dan 1.4% ga tushdi',
        repeatCount: 21,
      },
      {
        title: 'Hamkor tizimida status kechikadi',
        rootCause: 'EMU tomonda status kuniga bir marta yangilanadi',
        solution: 'Kunda ikki marta almashinuv bo‘yicha kelishuv',
        responsibleDept: 'Hamkorlar (EMU/BTS/Uzpost/Starex)',
        status: 'IN_PROGRESS' as const,
        effect: null,
        repeatCount: 15,
      },
    ];

    for (const s of solutions) {
      await db.rootCauseAction.create({
        data: {
          period,
          title: s.title,
          problem: `${DEMO_MARK} ${s.title} — takroriy muammo`,
          repeatCount: s.repeatCount,
          rootCause: s.rootCause,
          solution: s.solution,
          responsibleDept: s.responsibleDept,
          dueDate: new Date(to.getTime() - 5 * 86_400_000),
          status: s.status,
          verifiedAt: s.status === 'VERIFIED' ? new Date(to.getTime() - 3 * 86_400_000) : null,
          effect: s.effect,
          createdById: head.id,
        },
      });
    }

    console.log(`  ✔ ${period}: reyestr, ${auditPlan.reduce((a, b) => a + b.count, 0)} audit, ${solutions.length} yechim`);
  }

  console.log(`\nJami ${created} murojaat yaratildi.`);

  // ── Tekshirish ro'yxatining bir qismini "tekshirilgan" holatiga o'tkazish ──
  const pending = await db.reviewItem.findMany({ where: { result: 'PENDING' }, take: 180, select: { id: true } });
  for (const [index, item] of pending.entries()) {
    const roll = index % 10;
    await db.reviewItem.update({
      where: { id: item.id },
      data:
        roll < 6
          ? { result: 'RESOLVED', resolvedWhere: 'Telefon orqali', note: `${DEMO_MARK} tekshirildi` }
          : roll < 8
            ? { result: 'RESOLVED', resolvedWhere: 'Ichki tizimda (CRM)', note: `${DEMO_MARK} tekshirildi` }
            : roll < 9
              ? { result: 'NOT_RELEVANT', note: `${DEMO_MARK} ishga aloqasiz` }
              : { result: 'UNRESOLVED', note: `${DEMO_MARK} hal qilinmagan — chora kerak` },
    });
  }
  console.log(`${pending.length} tekshirish yozuvi natijasi belgilandi.`);

  // ── KPI faktlarini qayta hisoblash ────────────────────────────────────────
  const { recalculatePeriod } = await import('../src/server/kpi-core');
  for (const period of periods) {
    const count = await recalculatePeriod(period, head.id);
    console.log(`KPI qayta hisoblandi: ${period} — ${count} ko'rsatkich`);
  }
}

const mode = process.argv[2] ?? 'seed';

(mode === 'clear' ? clear() : seed())
  .catch((error) => {
    console.error('Xatolik:', error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
