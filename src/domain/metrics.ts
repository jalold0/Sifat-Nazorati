/**
 * Metrika dvigateli — KPI faktlarini kunlik reyestr, auditlar va tizimli yechimlardan
 * AVTOMATIK hisoblaydi. Excel'da bu qo'lda kiritilardi; endi manba bitta — reyestr.
 *
 * Har bir formula 'KPI pasporti' varag'idagi ta'rifga mos.
 * Ba'zi ko'rsatkichlar tashqi tizimdan olinadi (CRM, 102) — ular MANUAL bo'lib qoladi.
 *
 * Muhim: maxraj nolga teng bo'lsa null qaytariladi ("ma'lumot yo'q"), 0 emas.
 * Bu adolat masalasi — ma'lumot yo'qligi uchun xodim jazolanmasligi kerak,
 * balki bo'lim boshlig'i qo'lda qiymat kiritishi yoki izoh yozishi shart.
 */

import { escalatedWithin, hoursBetween } from './sla';

export type MetricCode =
  | 'zoneA_resolution_rate'
  | 'zoneA_avg_close_hours'
  | 'warehouse_audit_count'
  | 'lost_return_share'
  | 'registry_discipline'
  | 'stuck_tracks_share'
  | 'daily_control_completion'
  | 'escalation_within_2h'
  | 'zoneB_internal_close_rate'
  | 'repeat_share'
  | 'official_ontime_rate'
  | 'fcr_rate'
  | 'avg_first_response_hours'
  | 'graded_calls_count'
  | 'dept_sla_rate'
  | 'proactive_share'
  | 'systemic_solutions_count'
  | 'load_balance_ratio'
  | 'mgmt_ontime_rate';

export interface MetricTicket {
  ownerKey: string;
  zoneCode: string;
  kind: 'PROACTIVE' | 'REACTIVE';
  status: 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'CLOSED' | 'CANCELLED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  /** Hisobot kuni (YYYY-MM-DD) — reyestr intizomi shu bo'yicha sanaladi */
  day: string;
  receivedAt: Date;
  firstResponseAt: Date | null;
  escalatedAt: Date | null;
  closedAt: Date | null;
  spentHours: number | null;
  slaMet: boolean | null;
  isRepeat: boolean;
  /** Vazifa katalogidagi raqam — kunlik nazorat kabi rejali ishlarni aniqlash uchun */
  taskNo: number | null;
}

export interface MetricAudit {
  kind: 'WAREHOUSE' | 'BRANCH' | 'CALL';
  auditorKey: string;
}

export interface MetricsDataset {
  /** Davrdagi jami ish kunlari — hisobot va ko'rsatish uchun */
  workingDays: number;
  /**
   * Hozirgacha o'tgan ish kunlari. Tugamagan oyda intizom ko'rsatkichlari
   * shu songa bo'linadi — aks holda xodim hali kelmagan kunlar uchun jazolanadi.
   */
  workingDaysElapsed: number;
  tickets: MetricTicket[];
  audits: MetricAudit[];
  /** Tizimli yechimlar — faqat natijasi tasdiqlangani sanaladi */
  verifiedSolutions: number;
  /** Mutaxassislar kalitlari — yuklama muvozanati uchun */
  specialistKeys: string[];
}

/** Kunlik yuk nazorati vazifasining katalogdagi raqami ('Ish taqsimoti' 12-band) */
const DAILY_CONTROL_TASK_NO = 12;

/**
 * Bitta ko'rsatkichning qiymatini hisoblaydi.
 * ownerKey — ko'rsatkich kimga tegishli (registry_discipline kabi shaxsiy metrikalar uchun).
 */
export function computeMetric(
  metric: MetricCode,
  ownerKey: string,
  ds: MetricsDataset,
): number | null {
  const own = ds.tickets.filter((t) => t.ownerKey === ownerKey);
  const zone = (code: string) => ds.tickets.filter((t) => t.zoneCode === code);

  switch (metric) {
    // Zona A — oy ichida yopilgan / oy ichida tushgan muammoli yuk
    case 'zoneA_resolution_rate':
      return share(zone('A').filter(isClosed).length, countable(zone('A')).length);

    case 'zoneA_avg_close_hours':
      return average(
        zone('A')
          .filter(isClosed)
          .map((t) => hoursBetween(t.receivedAt, t.closedAt!)),
      );

    case 'warehouse_audit_count':
      return ds.audits.filter((a) => a.kind === 'WAREHOUSE').length;

    // Reyestr to'liq to'ldirilgan kunlar / ish kunlari
    case 'registry_discipline': {
      const base = ds.workingDaysElapsed > 0 ? ds.workingDaysElapsed : ds.workingDays;
      if (base <= 0) return null;
      const days = new Set(own.map((t) => t.day));
      return round4(Math.min(days.size / base, 1));
    }

    // Kunlik yuk nazorati o'tkazilgan va reyestrga kiritilgan kunlar / ish kunlari
    case 'daily_control_completion': {
      const base = ds.workingDaysElapsed > 0 ? ds.workingDaysElapsed : ds.workingDays;
      if (base <= 0) return null;
      const controlDays = new Set(
        ds.tickets
          .filter((t) => t.taskNo === DAILY_CONTROL_TASK_NO || (t.zoneCode === 'B' && t.kind === 'PROACTIVE'))
          .map((t) => t.day),
      );
      return round4(Math.min(controlDays.size / base, 1));
    }

    // 2 soat ichida eskalatsiya qilingan kechikish / aniqlangan jami kechikish
    case 'escalation_within_2h': {
      const delays = ds.tickets.filter((t) => t.escalatedAt !== null || t.slaMet === false);
      return share(delays.filter((t) => escalatedWithin(t.receivedAt, t.escalatedAt)).length, delays.length);
    }

    case 'zoneB_internal_close_rate':
      return share(zone('B').filter(isClosed).length, countable(zone('B')).length);

    case 'repeat_share':
      return share(own.filter((t) => t.isRepeat).length, countable(own).length);

    // Rasmiy murojaatlar (102, Qo'mita) — kritik ustuvorlikdagi Zona C
    case 'official_ontime_rate': {
      const official = zone('C').filter((t) => t.priority === 'CRITICAL' && t.slaMet !== null);
      return share(official.filter((t) => t.slaMet === true).length, official.length);
    }

    // Qayta murojaatsiz yopilgan / jami yopilgan
    case 'fcr_rate': {
      const closed = zone('C').filter(isClosed);
      return share(closed.filter((t) => !t.isRepeat).length, closed.length);
    }

    case 'avg_first_response_hours':
      return average(
        zone('C')
          .filter((t) => t.firstResponseAt !== null)
          .map((t) => hoursBetween(t.receivedAt, t.firstResponseAt!)),
      );

    case 'graded_calls_count':
      return ds.audits.filter((a) => a.kind === 'CALL').length;

    // Bo'lim bo'yicha SLA — natijasi aniqlangan murojaatlar ichida
    case 'dept_sla_rate': {
      const decided = ds.tickets.filter((t) => t.slaMet !== null);
      return share(decided.filter((t) => t.slaMet === true).length, decided.length);
    }

    case 'proactive_share': {
      const all = countable(ds.tickets);
      return share(all.filter((t) => t.kind === 'PROACTIVE').length, all.length);
    }

    case 'systemic_solutions_count':
      return ds.verifiedSolutions;

    // Eng ko'p yuklangan xodim soati / eng kam yuklangan xodim soati
    case 'load_balance_ratio': {
      const hours = ds.specialistKeys.map((key) =>
        ds.tickets.filter((t) => t.ownerKey === key).reduce((sum, t) => sum + (t.spentHours ?? 0), 0),
      );
      if (hours.length < 2) return null;
      const min = Math.min(...hours);
      const max = Math.max(...hours);
      if (min <= 0) return null; // bir xodimda umuman vaqt qayd etilmagan — nisbat ma'nosiz
      return round4(max / min);
    }

    // Tashqi tizimlardan olinadi — avtomatik hisoblanmaydi
    case 'lost_return_share':
    case 'stuck_tracks_share':
    case 'mgmt_ontime_rate':
      return null;

    default: {
      const exhaustive: never = metric;
      throw new Error(`Noma'lum metrika: ${String(exhaustive)}`);
    }
  }
}

/** Barcha ko'rsatkichlar uchun faktlarni bir yurishda hisoblash. */
export function computeAllMetrics(
  indicators: ReadonlyArray<{ code: string; metric: string; ownerKey: string; metricSource: 'AUTO' | 'MANUAL' }>,
  ds: MetricsDataset,
): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const ind of indicators) {
    out.set(
      ind.code,
      ind.metricSource === 'AUTO' ? computeMetric(ind.metric as MetricCode, ind.ownerKey, ds) : null,
    );
  }
  return out;
}

// ── Yordamchilar ─────────────────────────────────────────────────────────────

const isClosed = (t: MetricTicket) => t.status === 'CLOSED' && t.closedAt !== null;

/** Bekor qilingan murojaatlar hech qanday maxrajga kirmaydi. */
const countable = (rows: MetricTicket[]) => rows.filter((t) => t.status !== 'CANCELLED');

function share(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return round4(numerator / denominator);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
