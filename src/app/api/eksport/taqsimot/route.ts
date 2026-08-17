/**
 * Ish taqsimotini Excel'ga chiqarish.
 *
 * Fayl tuzilishi manba OTK hujjatiga mos (Ish taqsimoti, KPI pasporti), ustiga
 * tizim qo'shgan ma'lumot ham kiradi: biriktirish tarixi va har davrdagi
 * murojaat soni. Shunday qilib fayl "hozirgi holat" emas, "kim qachon nima
 * uchun javob bergan" degan savolga ham javob beradi.
 */

import { countByAssignment, SYSTEM_EPOCH, type AssignmentWindow } from '@/domain/assignment';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { dateTime, date as fmtDate } from '@/lib/format';
import {
  addFootnote,
  addRows,
  addSheet,
  addTotalRow,
  createWorkbook,
  exportFileName,
  workbookResponse,
  type ColumnSpec,
} from '@/server/xlsx';
import { KIND_LABEL, PRIORITY_LABEL } from '@/server/shared';

// ExcelJS Node API'siga muhtoj — Edge runtime'da ishlamaydi
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireSession();

  const [zones, tasks, indicators, allTickets] = await Promise.all([
    db.zone.findMany({ orderBy: { code: 'asc' }, include: { owner: { select: { shortName: true } } } }),
    db.taskDef.findMany({
      orderBy: { no: 'asc' },
      include: {
        owner: { select: { shortName: true } },
        backup: { select: { shortName: true } },
        assignments: {
          orderBy: { from: 'asc' },
          include: {
            owner: { select: { shortName: true } },
            backup: { select: { shortName: true } },
            changedBy: { select: { shortName: true } },
          },
        },
      },
    }),
    db.kpiIndicator.findMany({ orderBy: { no: 'asc' }, include: { owner: { select: { shortName: true } } } }),
    db.ticket.findMany({
      where: { status: { not: 'CANCELLED' }, taskDefId: { not: null } },
      select: { taskDefId: true, date: true },
    }),
  ]);

  const ticketsByTask = new Map<number, Date[]>();
  for (const t of allTickets) {
    if (t.taskDefId === null) continue;
    const list = ticketsByTask.get(t.taskDefId) ?? [];
    list.push(t.date);
    ticketsByTask.set(t.taskDefId, list);
  }

  const wb = createWorkbook();
  const stamp = `Yuklab olindi: ${dateTime(new Date())} · ${session.name}`;

  // ── 1. Ish taqsimoti ──────────────────────────────────────────────────────
  const taskCols: ColumnSpec[] = [
    { header: '№', width: 5, numeric: true },
    { header: 'Zona', width: 6 },
    { header: 'Vazifa', width: 52, wrap: true },
    { header: 'Manba / kanal', width: 20, wrap: true },
    { header: "Mas'ul", width: 16 },
    { header: 'Zaxira', width: 16 },
    { header: 'Qachondan buyon', width: 15 },
    { header: 'Davriylik', width: 11 },
    { header: 'SLA (soat)', width: 10, numeric: true, format: '#,##0' },
    { header: 'Ustuvorlik', width: 11 },
    { header: 'Tur', width: 10 },
    { header: 'Holat', width: 10 },
  ];

  const { sheet: s1 } = addSheet(wb, {
    name: 'Ish taqsimoti',
    title: 'ISH TAQSIMOTI — ZONA MODELI',
    note: `Har bir vazifa aniq bitta mas'ulga biriktirilgan. Zaxira xodim mas'ul yo'q bo'lganda o'rnini bosadi. ${stamp}`,
    columns: taskCols,
  });

  addRows(
    s1,
    taskCols,
    tasks.map((t) => {
      const current = t.assignments.find((a) => a.until === null);
      const since =
        !current || current.from.getTime() === SYSTEM_EPOCH.getTime() ? 'boshidan' : fmtDate(current.from);
      return [
        t.no,
        t.zoneCode,
        t.title,
        t.source,
        t.owner.shortName,
        t.backup?.shortName ?? '—',
        since,
        t.frequency,
        t.slaHours ?? '—',
        PRIORITY_LABEL[t.priority],
        KIND_LABEL[t.kind],
        t.active ? 'Faol' : 'Arxiv',
      ];
    }),
  );

  addFootnote(s1, taskCols.length, [
    `Jami ${tasks.length} vazifa · ${tasks.filter((t) => t.active).length} tasi faol.`,
    "QOIDA: bitta xodimda vazifalarning 40% dan ortig'i to'planmasligi kerak — aks holda u ta'tilga chiqsa bo'lim to'xtaydi.",
    "\"Qachondan buyon\" — joriy mas'ul shu vazifani qachondan olib borayotgani. \"boshidan\" = boshlang'ich taqsimotdan beri o'zgarmagan.",
  ]);

  // ── 2. Yuklama muvozanati ─────────────────────────────────────────────────
  const loadCols: ColumnSpec[] = [
    { header: "Mas'ul", width: 20 },
    { header: 'Vazifa soni', width: 12, numeric: true, format: '#,##0' },
    { header: 'Ulushi', width: 10, numeric: true, format: '0.0%' },
    { header: 'Proaktiv', width: 10, numeric: true, format: '#,##0' },
    { header: 'Reaktiv', width: 10, numeric: true, format: '#,##0' },
    { header: 'Zaxira sifatida', width: 14, numeric: true, format: '#,##0' },
    { header: '40% qoidasi', width: 16 },
  ];

  const activeTasks = tasks.filter((t) => t.active);
  const owners = new Map<string, { total: number; proactive: number; reactive: number; asBackup: number }>();
  for (const t of activeTasks) {
    const name = t.owner.shortName;
    const b = owners.get(name) ?? { total: 0, proactive: 0, reactive: 0, asBackup: 0 };
    b.total += 1;
    if (t.kind === 'PROACTIVE') b.proactive += 1;
    else b.reactive += 1;
    owners.set(name, b);
  }
  for (const t of activeTasks) {
    if (!t.backup) continue;
    const b = owners.get(t.backup.shortName) ?? { total: 0, proactive: 0, reactive: 0, asBackup: 0 };
    b.asBackup += 1;
    owners.set(t.backup.shortName, b);
  }

  const { sheet: s2 } = addSheet(wb, {
    name: 'Yuklama muvozanati',
    title: 'YUKLAMA MUVOZANATI',
    note: 'Faqat faol vazifalar sanaladi. Ulush 40% dan oshsa — taqsimotni qayta ko\'rish kerak.',
    columns: loadCols,
  });

  const loadRows = [...owners.entries()].sort((a, b) => b[1].total - a[1].total);
  addRows(
    s2,
    loadCols,
    loadRows.map(([name, b]) => {
      const share = activeTasks.length > 0 ? b.total / activeTasks.length : 0;
      return [
        name,
        b.total,
        share,
        b.proactive,
        b.reactive,
        b.asBackup,
        share > 0.4 ? 'BUZILGAN' : 'chegara ichida',
      ];
    }),
  );
  addTotalRow(s2, loadCols, [
    'JAMI',
    activeTasks.length,
    1,
    activeTasks.filter((t) => t.kind === 'PROACTIVE').length,
    activeTasks.filter((t) => t.kind === 'REACTIVE').length,
    activeTasks.filter((t) => t.backup).length,
    '',
  ]);

  // Ekrandagi xulosa jumlasi — faylni ochgan odam javobni darhol ko'rishi kerak
  const maxShare =
    loadRows.length > 0 && activeTasks.length > 0 ? loadRows[0]![1].total / activeTasks.length : 0;

  addFootnote(s2, loadCols.length, [
    `Eng ko'p yuklangan xodimda vazifalarning ${Math.round(maxShare * 100)}% qismi — ${
      maxShare > 0.4 ? "40% CHEGARASI BUZILGAN, taqsimotni qayta ko'rish kerak." : 'chegara ichida.'
    }`,
    "QOIDA: bitta xodimda vazifalarning 40% dan ortig'i to'planmasligi kerak — aks holda u ta'tilga chiqsa yoki ishdan ketsa bo'lim to'xtaydi.",
    '"Zaxira sifatida" ustuni — xodim nechta vazifada zaxira etib belgilangani. Zaxira ham bitta odamga to\'planib qolmasligi kerak.',
    'Arxivlangan vazifalar bu hisobga kirmaydi.',
  ]);

  // ── 3. Zonalar ────────────────────────────────────────────────────────────
  const zoneCols: ColumnSpec[] = [
    { header: 'Zona', width: 6 },
    { header: "Yo'nalish", width: 34, wrap: true },
    { header: "Mas'ul", width: 18 },
    { header: 'Joylashuv', width: 16 },
    { header: 'Qamrov', width: 46, wrap: true },
    { header: 'Vazifa soni', width: 12, numeric: true, format: '#,##0' },
    { header: 'Asosiy natija', width: 40, wrap: true },
  ];

  const { sheet: s3 } = addSheet(wb, {
    name: 'Zonalar',
    title: "ZONA MODELI — TO'RT YO'NALISH",
    columns: zoneCols,
  });

  addRows(
    s3,
    zoneCols,
    zones.map((z) => [
      z.code,
      z.name,
      z.owner.shortName,
      z.location,
      z.coverage,
      tasks.filter((t) => t.zoneCode === z.code).length,
      z.outcome,
    ]),
  );

  // ── 4. Biriktirish tarixi ─────────────────────────────────────────────────
  const histCols: ColumnSpec[] = [
    { header: 'Vazifa №', width: 9, numeric: true },
    { header: 'Vazifa', width: 46, wrap: true },
    { header: 'Zona', width: 6 },
    { header: "Mas'ul", width: 16 },
    { header: 'Zaxira', width: 16 },
    { header: 'Davr boshi', width: 13 },
    { header: 'Davr oxiri', width: 13 },
    { header: 'Murojaat', width: 10, numeric: true, format: '#,##0' },
    { header: 'Sabab', width: 40, wrap: true },
    { header: "Kim o'zgartirdi", width: 16 },
    { header: 'Qachon yozildi', width: 17 },
  ];

  const { sheet: s4 } = addSheet(wb, {
    name: 'Biriktirish tarixi',
    title: 'BIRIKTIRISH TARIXI — KIM QACHON JAVOB BERGAN',
    note:
      "Mas'ul almashtirilganda o'tgan davr o'zgarmaydi: o'zgartirishgacha qayd etilgan murojaatlar eski xodim " +
      'hisobida qoladi. Oraliq yarim ochiq — kuchga kirish kunidagi murojaat yangi mas\'ulga tegishli.',
    columns: histCols,
  });

  const historyRows: Array<Array<string | number>> = [];
  for (const t of tasks) {
    const windows: AssignmentWindow[] = t.assignments.map((a) => ({
      id: a.id,
      ownerId: a.ownerId,
      backupId: a.backupId,
      from: a.from,
      until: a.until,
    }));
    const { rows } = countByAssignment(windows, ticketsByTask.get(t.id) ?? []);
    const countOf = new Map(rows.map((r) => [r.windowId, r.count]));

    for (const [i, a] of t.assignments.entries()) {
      historyRows.push([
        t.no,
        t.title,
        t.zoneCode,
        a.owner.shortName,
        a.backup?.shortName ?? '—',
        i === 0 && a.from.getTime() === SYSTEM_EPOCH.getTime() ? 'boshidan' : fmtDate(a.from),
        a.until === null ? 'hozirgacha' : fmtDate(a.until),
        countOf.get(a.id) ?? 0,
        a.reason ?? '—',
        a.changedBy?.shortName ?? 'tizim',
        dateTime(a.createdAt),
      ]);
    }
  }
  addRows(s4, histCols, historyRows);

  const reassignments = historyRows.filter((r) => r[9] !== 'tizim').length;
  addFootnote(s4, histCols.length, [
    `Jami ${historyRows.length} biriktirish yozuvi · shundan ${reassignments} tasi qayta biriktirish.`,
    reassignments === 0
      ? 'Hali qayta biriktirish bo\'lmagan — taqsimot boshlang\'ich holatda.'
      : 'Har bir qayta biriktirish sababi bilan qayd etilgan.',
  ]);

  // ── 5. KPI pasporti ───────────────────────────────────────────────────────
  const kpiCols: ColumnSpec[] = [
    { header: '№', width: 5, numeric: true },
    { header: 'Kim uchun', width: 18 },
    { header: 'KPI nomi', width: 44, wrap: true },
    { header: "Og'irlik", width: 9, numeric: true, format: '0' },
    { header: "Yo'nalish", width: 14 },
    { header: 'Maqsad', width: 13 },
    { header: 'Hisoblash formulasi', width: 56, wrap: true },
    { header: "Ma'lumot manbasi", width: 26, wrap: true },
    { header: 'Yig\'ilishi', width: 12 },
  ];

  const { sheet: s5 } = addSheet(wb, {
    name: 'KPI pasporti',
    title: "KPI PASPORTI — HAR BIR KO'RSATKICHNING FORMULASI VA MANBASI",
    note: "Bu varaq KPI ning 'qonuni'. Nizo chiqsa shu jadval hal qiladi.",
    columns: kpiCols,
  });

  addRows(
    s5,
    kpiCols,
    indicators.map((i) => [
      i.no,
      i.owner.shortName,
      i.name,
      Number(i.weight) * 100,
      i.direction === 'HIGHER_BETTER' ? 'Yuqori yaxshi' : 'Past yaxshi',
      i.targetText,
      i.formula,
      i.dataSource,
      i.metricSource === 'AUTO' ? 'Avtomatik' : "Qo'lda",
    ]),
  );

  addFootnote(s5, kpiCols.length, [
    "DIQQAT: 'Aniqlangan kamchiliklar soni' KPI qilib qo'yilmaydi — aks holda xodim kamchilik yasashga urinadi. " +
      "O'lchanadigan narsa — kamchilikning bartaraf etilishi va takrorlanmasligi.",
    "Og'irliklar har bir xodim bo'yicha 100 ball bo'lishi shart.",
  ]);

  return workbookResponse(wb, exportFileName('Ish_taqsimoti'));
}
