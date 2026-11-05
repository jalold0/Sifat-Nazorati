/**
 * Sifat nazorati hisob moduli — SOF funksiyalar.
 *
 * Kirish va chiqish oddiy obyektlar; DB, DOM, tarmoq va joriy vaqtga bog'liqlik yo'q
 * ("bugun" har doim tashqaridan beriladi). Bir xil kirish — har doim bir xil natija.
 * Ball, foiz va xulosa hech qayerda saqlanmaydi: har safar shu yerda hisoblanadi.
 */

export type Answer = 'yes' | 'no' | 'na';
export type Status = 'green' | 'yellow' | 'red' | 'gray';

export interface Checkpoint {
  id: string;
  text: string;
  weight: number;
  critical: boolean;
  active: boolean;
  group?: string | null;
}

export interface DeptInput {
  id: string;
  name: string;
  norm: number;
  estimate: boolean;
  /** Hamma nuqtalar, nofaollari ham (eski tekshiruvlarda ishlatilgan). */
  checkpoints: Checkpoint[];
}

export interface AuditRec {
  id: string;
  dept: string;
  /** YYYY-MM-DD */
  date: string;
  answers: Record<string, Answer>;
  critical: boolean;
}

export interface TaskRec {
  id: string;
  audit: string;
  dept: string;
  cp: string;
  what: string;
  owner: string;
  /** YYYY-MM-DD */
  due: string;
  status: 'open' | 'closed';
  /** Yopilgan sana, YYYY-MM-DD */
  closedAt?: string | null;
}

/** Topshiriqlar muddatida bajarilishi me'yori, % (taxminiy). */
export const TASK_NORM = 80;
/** Xulosa chiqarish uchun davrdagi eng kam tekshiruv soni. */
export const MIN_SAMPLE = 5;
/** Foizli ko'rsatkichda sariq zona kengligi (foiz punkti). */
export const YELLOW_BAND = 10;

// ── Sana yordamchilari (UTC+5, Toshkent) ─────────────────────────────────────

const DAY_MS = 86_400_000;
const TASHKENT_OFFSET_MS = 5 * 3_600_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Toshkent vaqti bo'yicha bugungi sana. */
export function todayTashkent(now: Date = new Date()): string {
  const d = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function isYmd(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return addDays(value, 0) === value;
}

export type PeriodKey = 'today' | '7' | '30';
export const PERIOD_LABEL: Record<PeriodKey, string> = { today: 'Bugun', '7': '7 kun', '30': '30 kun' };

export interface Range {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
}

/** Davr chegaralari kiritilgan; o'tgan teng davr — undan oldingi shuncha kun. */
export function periodRange(period: PeriodKey, today: string): Range {
  const days = period === 'today' ? 1 : Number(period);
  const from = addDays(today, -(days - 1));
  return { from, to: today, prevFrom: addDays(from, -days), prevTo: addDays(from, -1) };
}

export function inRange(ymd: string, from: string, to: string): boolean {
  return ymd >= from && ymd <= to;
}

// ── Ball ─────────────────────────────────────────────────────────────────────

export interface ScoreResult {
  /** null — ma'lumot yo'q (hamma javob «Tegishli emas» yoki javob yo'q). */
  pct: number | null;
  yes: number;
  no: number;
  na: number;
  yesWeight: number;
  noWeight: number;
}

const EMPTY_SCORE: ScoreResult = { pct: null, yes: 0, no: 0, na: 0, yesWeight: 0, noWeight: 0 };

function weightMap(checkpoints: Checkpoint[]): Map<string, number> {
  return new Map(checkpoints.map((c) => [c.id, c.weight > 0 ? c.weight : 1]));
}

function tally(
  answers: Record<string, Answer>,
  weights: Map<string, number>,
  into: ScoreResult,
): ScoreResult {
  for (const [id, a] of Object.entries(answers)) {
    const w = weights.get(id);
    if (w === undefined) continue; // noma'lum nuqta
    if (a === 'yes') {
      into.yes += 1;
      into.yesWeight += w;
    } else if (a === 'no') {
      into.no += 1;
      into.noWeight += w;
    } else if (a === 'na') {
      into.na += 1;
    }
  }
  return into;
}

function finish(r: ScoreResult): ScoreResult {
  const denom = r.yesWeight + r.noWeight;
  r.pct = denom > 0 ? (r.yesWeight / denom) * 100 : null;
  return r;
}

/** Bitta tekshiruv bali: Ha og'irligi / (Ha + Yo'q og'irligi) × 100. «Tegishli emas» hisobga olinmaydi. */
export function scoreAnswers(answers: Record<string, Answer>, checkpoints: Checkpoint[]): ScoreResult {
  return finish(tally(answers, weightMap(checkpoints), { ...EMPTY_SCORE }));
}

/** Davrdagi barcha tekshiruvlar bo'yicha jamlangan ball. */
export function scoreAudits(audits: AuditRec[], checkpoints: Checkpoint[]): ScoreResult {
  const weights = weightMap(checkpoints);
  const acc: ScoreResult = { ...EMPTY_SCORE };
  for (const a of audits) tally(a.answers, weights, acc);
  return finish(acc);
}

/** Faol jiddiy nuqtada «Yo'q» bo'lsa — tekshiruv jiddiy. Saqlashda server shuni hisoblab yozadi. */
export function auditCritical(answers: Record<string, Answer>, checkpoints: Checkpoint[]): boolean {
  return checkpoints.some((c) => c.active && c.critical && answers[c.id] === 'no');
}

// ── Svetofor ─────────────────────────────────────────────────────────────────

/** Foizli ko'rsatkich (≥ me'yor yaxshi). */
export function trafficPct(value: number | null, norm: number): Status {
  if (value === null) return 'gray';
  const v = Math.round(value * 1e6) / 1e6;
  if (v >= norm) return 'green';
  if (norm - v <= YELLOW_BAND) return 'yellow';
  return 'red';
}

/** Sonli ko'rsatkich (≤ 0 yaxshi): 0 yashil, 1 sariq, 2+ qizil. */
export function trafficCount(value: number | null): Status {
  if (value === null) return 'gray';
  if (value <= 0) return 'green';
  return value === 1 ? 'yellow' : 'red';
}

const SEVERITY: Record<Status, number> = { gray: -1, green: 0, yellow: 1, red: 2 };

export function worst(statuses: Status[]): Status {
  let result: Status = 'gray';
  for (const s of statuses) if (SEVERITY[s] > SEVERITY[result]) result = s;
  return result;
}

/** Panelda tartib: qizillar yuqorida, kulranglar pastda. */
export const STATUS_RANK: Record<Status, number> = { red: 0, yellow: 1, green: 2, gray: 3 };

// ── Bo'lim ko'rsatkichlari ───────────────────────────────────────────────────

export type MetricKey = 'score' | 'critical' | 'ontime' | 'overdue' | 'count';

export interface Metric {
  key: MetricKey;
  label: string;
  value: number | null;
  /** null — me'yor yo'q (faqat ma'lumot). */
  norm: number | null;
  direction: '>=' | '<=' | null;
  unit: 'pct' | 'count';
  status: Status | 'info';
  /** Me'yor taxminiy (rahbar tasdiqlamagan). */
  estimate: boolean;
}

export interface DeptEvaluation {
  deptId: string;
  metrics: [Metric, Metric, Metric, Metric, Metric];
  status: Status;
  estimate: boolean;
  auditCount: number;
  criticalCount: number;
  overdueCount: number;
  scorePct: number | null;
}

/** asOf kuniga muddati o'tgan ochiq topshiriqlar: due < asOf va o'sha kungacha yopilmagan. */
export function overdueAt(tasks: TaskRec[], asOf: string): TaskRec[] {
  return tasks.filter((t) => {
    if (t.due >= asOf) return false;
    const closedBy = t.status === 'closed' && (t.closedAt ?? '') !== '' && (t.closedAt as string) <= asOf;
    return !closedBy;
  });
}

/** Muddati [from, to] ga tushgan topshiriqlar: muddatigacha yopilganlar ulushi. */
export function onTimePct(tasks: TaskRec[], from: string, to: string): number | null {
  const due = tasks.filter((t) => inRange(t.due, from, to));
  if (due.length === 0) return null;
  const ok = due.filter((t) => t.status === 'closed' && !!t.closedAt && t.closedAt <= t.due).length;
  return (ok / due.length) * 100;
}

function periodMetrics(
  dept: DeptInput,
  audits: AuditRec[],
  tasks: TaskRec[],
  from: string,
  to: string,
  asOf: string,
) {
  const inPeriod = audits.filter((a) => a.dept === dept.id && inRange(a.date, from, to));
  const deptTasks = tasks.filter((t) => t.dept === dept.id);
  const score = scoreAudits(inPeriod, dept.checkpoints);
  return {
    inPeriod,
    deptTasks,
    scorePct: score.pct,
    criticalCount: inPeriod.filter((a) => a.critical).length,
    ontime: onTimePct(deptTasks, from, to),
    overdue: overdueAt(deptTasks, asOf).length,
  };
}

export function evaluateDept(
  dept: DeptInput,
  audits: AuditRec[],
  tasks: TaskRec[],
  range: Pick<Range, 'from' | 'to'>,
  today: string,
): DeptEvaluation {
  const p = periodMetrics(dept, audits, tasks, range.from, range.to, today);
  const hasAudits = p.inPeriod.length > 0;
  const hasTasks = p.deptTasks.length > 0;

  const metrics: DeptEvaluation['metrics'] = [
    {
      key: 'score',
      label: 'Umumiy ball, %',
      value: p.scorePct,
      norm: dept.norm,
      direction: '>=',
      unit: 'pct',
      status: trafficPct(p.scorePct, dept.norm),
      estimate: dept.estimate,
    },
    {
      key: 'critical',
      label: 'Jiddiy holatlar',
      value: hasAudits ? p.criticalCount : null,
      norm: 0,
      direction: '<=',
      unit: 'count',
      status: trafficCount(hasAudits ? p.criticalCount : null),
      estimate: false,
    },
    {
      key: 'ontime',
      label: 'Topshiriqlar muddatida bajarilishi, %',
      value: p.ontime,
      norm: TASK_NORM,
      direction: '>=',
      unit: 'pct',
      status: trafficPct(p.ontime, TASK_NORM),
      estimate: true,
    },
    {
      key: 'overdue',
      label: 'Muddati o‘tgan ochiq topshiriqlar',
      value: hasTasks ? p.overdue : null,
      norm: 0,
      direction: '<=',
      unit: 'count',
      status: trafficCount(hasTasks ? p.overdue : null),
      estimate: false,
    },
    {
      key: 'count',
      label: 'Tekshiruvlar soni',
      value: p.inPeriod.length,
      norm: null,
      direction: null,
      unit: 'count',
      status: 'info',
      estimate: false,
    },
  ];

  let status = worst(metrics.slice(0, 4).map((m) => m.status as Status));
  if (p.criticalCount > 0) status = 'red';

  return {
    deptId: dept.id,
    metrics,
    status,
    estimate: dept.estimate,
    auditCount: p.inPeriod.length,
    criticalCount: p.criticalCount,
    overdueCount: p.overdue,
    scorePct: p.scorePct,
  };
}

// ── Eng ko'p «Yo'q» olgan nuqtalar ───────────────────────────────────────────

export interface TopNo {
  id: string;
  text: string;
  count: number;
}

export function topNoCheckpoints(audits: AuditRec[], checkpoints: Checkpoint[], limit = 3): TopNo[] {
  const counts = new Map<string, number>();
  for (const a of audits) {
    for (const [id, ans] of Object.entries(a.answers)) {
      if (ans === 'no') counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const order = new Map(checkpoints.map((c, i) => [c.id, i]));
  return checkpoints
    .filter((c) => (counts.get(c.id) ?? 0) > 0)
    .map((c) => ({ id: c.id, text: c.text, count: counts.get(c.id) as number }))
    .sort((a, b) => b.count - a.count || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .slice(0, limit);
}

// ── 3 qatorli xulosa ─────────────────────────────────────────────────────────

export interface Summary {
  kind: 'none' | 'small' | 'ok';
  lines: string[];
}

const fmtPct = (v: number) => `${Math.round(v)}%`;

interface Compared {
  label: string;
  from: string;
  to: string;
  /** Musbat — yomonlashdi; manfiy — yaxshilandi. Turli birliklar solishtirilishi uchun «punkt»ga keltirilgan. */
  worsening: number;
}

function compare(dept: DeptInput, audits: AuditRec[], tasks: TaskRec[], range: Range, today: string): Compared[] {
  const cur = periodMetrics(dept, audits, tasks, range.from, range.to, today);
  const prev = periodMetrics(dept, audits, tasks, range.prevFrom, range.prevTo, range.prevTo);
  const out: Compared[] = [];

  if (cur.scorePct !== null && prev.scorePct !== null) {
    out.push({
      label: 'Umumiy ball',
      from: fmtPct(prev.scorePct),
      to: fmtPct(cur.scorePct),
      worsening: prev.scorePct - cur.scorePct,
    });
  }
  if (cur.ontime !== null && prev.ontime !== null) {
    out.push({
      label: 'Topshiriqlar muddatida bajarilishi',
      from: fmtPct(prev.ontime),
      to: fmtPct(cur.ontime),
      worsening: prev.ontime - cur.ontime,
    });
  }
  if (cur.inPeriod.length > 0 && prev.inPeriod.length > 0) {
    // Har bir jiddiy holat 10 punkt bilan tenglashtiriladi
    out.push({
      label: 'Jiddiy holatlar',
      from: String(prev.criticalCount),
      to: String(cur.criticalCount),
      worsening: (cur.criticalCount - prev.criticalCount) * 10,
    });
  }
  if (prev.deptTasks.length > 0 || cur.deptTasks.length > 0) {
    out.push({
      label: 'Muddati o‘tgan topshiriqlar',
      from: String(prev.overdue),
      to: String(cur.overdue),
      worsening: (cur.overdue - prev.overdue) * 10,
    });
  }
  return out;
}

export function buildSummary(
  dept: DeptInput,
  audits: AuditRec[],
  tasks: TaskRec[],
  range: Range,
  today: string,
): Summary {
  const inPeriod = audits.filter((a) => a.dept === dept.id && inRange(a.date, range.from, range.to));
  if (inPeriod.length === 0) return { kind: 'none', lines: ['Bu davrda tekshiruv yo‘q'] };
  if (inPeriod.length < MIN_SAMPLE) {
    return {
      kind: 'small',
      lines: [
        `Namuna kichik (${inPeriod.length} ta tekshiruv): xulosa chiqarilmaydi, tekshiruv hajmini oshiring`,
      ],
    };
  }

  const cmp = compare(dept, audits, tasks, range, today);
  const worse = cmp.filter((c) => c.worsening > 0).sort((a, b) => b.worsening - a.worsening)[0];
  const better = cmp.filter((c) => c.worsening < 0).sort((a, b) => a.worsening - b.worsening)[0];

  const top = topNoCheckpoints(inPeriod, dept.checkpoints, 1)[0];
  const overdue = overdueAt(
    tasks.filter((t) => t.dept === dept.id),
    today,
  ).length;
  const first = top
    ? `Birinchi navbatda: «${top.text}» — ${top.count} marta «Yo‘q»; muddati o‘tgan topshiriqlar: ${overdue} ta.`
    : `Birinchi navbatda: «Yo‘q» javoblar yo‘q; muddati o‘tgan topshiriqlar: ${overdue} ta.`;

  return {
    kind: 'ok',
    lines: [
      worse ? `Yomonlashdi: ${worse.label} ${worse.from} dan ${worse.to} ga.` : 'Yomonlashdi: Yomonlashgani yo‘q.',
      better
        ? `Yaxshilandi: ${better.label} ${better.from} dan ${better.to} ga.`
        : 'Yaxshilandi: Yaxshilanish yo‘q.',
      first,
    ],
  };
}
