import { describe, expect, it } from 'vitest';

import { computeMetric, type MetricsDataset, type MetricTicket } from './metrics';

const base: Omit<MetricTicket, 'ownerKey' | 'zoneCode'> = {
  kind: 'REACTIVE',
  status: 'CLOSED',
  priority: 'HIGH',
  day: '2026-06-02',
  receivedAt: new Date('2026-06-02T09:00:00Z'),
  firstResponseAt: new Date('2026-06-02T09:30:00Z'),
  escalatedAt: null,
  closedAt: new Date('2026-06-02T11:00:00Z'),
  spentHours: 2,
  slaMet: true,
  isRepeat: false,
  taskNo: null,
};

const t = (over: Partial<MetricTicket> & { ownerKey: string; zoneCode: string }): MetricTicket => ({
  ...base,
  ...over,
});

const dataset = (tickets: MetricTicket[], extra: Partial<MetricsDataset> = {}): MetricsDataset => ({
  workingDays: 21,
  workingDaysElapsed: 21,
  tickets,
  audits: [],
  verifiedSolutions: 0,
  specialistKeys: ['ulugbek', 'jasur', 'saidali'],
  ...extra,
});

describe('zoneA_resolution_rate', () => {
  it('yopilgan / tushgan', () => {
    const ds = dataset([
      t({ ownerKey: 'ulugbek', zoneCode: 'A' }),
      t({ ownerKey: 'ulugbek', zoneCode: 'A', status: 'OPEN', closedAt: null }),
      t({ ownerKey: 'jasur', zoneCode: 'B' }), // boshqa zona — hisobga kirmaydi
    ]);
    expect(computeMetric('zoneA_resolution_rate', 'ulugbek', ds)).toBe(0.5);
  });

  it('bekor qilingan murojaat maxrajga kirmaydi', () => {
    const ds = dataset([
      t({ ownerKey: 'ulugbek', zoneCode: 'A' }),
      t({ ownerKey: 'ulugbek', zoneCode: 'A', status: 'CANCELLED', closedAt: null }),
    ]);
    expect(computeMetric('zoneA_resolution_rate', 'ulugbek', ds)).toBe(1);
  });

  it('ma`lumot yo`q — null (0 emas)', () => {
    expect(computeMetric('zoneA_resolution_rate', 'ulugbek', dataset([]))).toBe(null);
  });
});

describe('zoneA_avg_close_hours', () => {
  it('faqat yopilganlar bo`yicha o`rtacha', () => {
    const ds = dataset([
      t({ ownerKey: 'ulugbek', zoneCode: 'A', closedAt: new Date('2026-06-02T11:00:00Z') }), // 2 soat
      t({ ownerKey: 'ulugbek', zoneCode: 'A', closedAt: new Date('2026-06-02T13:00:00Z') }), // 4 soat
      t({ ownerKey: 'ulugbek', zoneCode: 'A', status: 'OPEN', closedAt: null }),
    ]);
    expect(computeMetric('zoneA_avg_close_hours', 'ulugbek', ds)).toBe(3);
  });
});

describe('registry_discipline', () => {
  it('reyestr yuritilgan kunlar / ish kunlari', () => {
    const ds = dataset(
      [
        t({ ownerKey: 'saidali', zoneCode: 'C', day: '2026-06-01' }),
        t({ ownerKey: 'saidali', zoneCode: 'C', day: '2026-06-01' }), // bir kun — bir marta
        t({ ownerKey: 'saidali', zoneCode: 'C', day: '2026-06-02' }),
      ],
      { workingDays: 4, workingDaysElapsed: 4 },
    );
    expect(computeMetric('registry_discipline', 'saidali', ds)).toBe(0.5);
  });

  it('tugamagan oyda o`tgan ish kunlariga bo`linadi, butun oyga emas', () => {
    const ds = dataset(
      [
        t({ ownerKey: 'saidali', zoneCode: 'C', day: '2026-08-03' }),
        t({ ownerKey: 'saidali', zoneCode: 'C', day: '2026-08-04' }),
      ],
      { workingDays: 26, workingDaysElapsed: 2 },
    );
    // 2/2 = 100%, 2/26 = 8% emas
    expect(computeMetric('registry_discipline', 'saidali', ds)).toBe(1);
  });

  it('ish kunidan ko`p bo`lsa 1 bilan kesiladi', () => {
    const ds = dataset(
      [
        t({ ownerKey: 'jasur', zoneCode: 'B', day: '2026-06-01' }),
        t({ ownerKey: 'jasur', zoneCode: 'B', day: '2026-06-02' }),
        t({ ownerKey: 'jasur', zoneCode: 'B', day: '2026-06-03' }),
      ],
      { workingDays: 2, workingDaysElapsed: 2 },
    );
    expect(computeMetric('registry_discipline', 'jasur', ds)).toBe(1);
  });
});

describe('escalation_within_2h', () => {
  it('2 soat ichida eskalatsiya qilinganlar ulushi', () => {
    const received = new Date('2026-06-02T09:00:00Z');
    const ds = dataset([
      t({ ownerKey: 'jasur', zoneCode: 'B', receivedAt: received, escalatedAt: new Date('2026-06-02T10:00:00Z') }),
      t({ ownerKey: 'jasur', zoneCode: 'B', receivedAt: received, escalatedAt: new Date('2026-06-02T14:00:00Z') }),
      t({ ownerKey: 'jasur', zoneCode: 'B', receivedAt: received, slaMet: false }), // kechikkan, eskalatsiya yo'q
      t({ ownerKey: 'jasur', zoneCode: 'B' }), // muammosiz — maxrajga kirmaydi
    ]);
    expect(computeMetric('escalation_within_2h', 'jasur', ds)).toBeCloseTo(1 / 3, 4);
  });
});

describe('proactive_share va repeat_share', () => {
  it('proaktiv ulushi', () => {
    const ds = dataset([
      t({ ownerKey: 'ulugbek', zoneCode: 'A', kind: 'PROACTIVE' }),
      t({ ownerKey: 'jasur', zoneCode: 'B' }),
      t({ ownerKey: 'jasur', zoneCode: 'B' }),
      t({ ownerKey: 'jasur', zoneCode: 'B' }),
    ]);
    expect(computeMetric('proactive_share', 'head', ds)).toBe(0.25);
  });

  it('takroriy ulushi — faqat o`z murojaatlari bo`yicha', () => {
    const ds = dataset([
      t({ ownerKey: 'jasur', zoneCode: 'B', isRepeat: true }),
      t({ ownerKey: 'jasur', zoneCode: 'B' }),
      t({ ownerKey: 'saidali', zoneCode: 'C', isRepeat: true }),
    ]);
    expect(computeMetric('repeat_share', 'jasur', ds)).toBe(0.5);
  });
});

describe('official_ontime_rate — 102 va Qo`mita', () => {
  it('faqat kritik Zona C murojaatlari sanaladi', () => {
    const ds = dataset([
      t({ ownerKey: 'saidali', zoneCode: 'C', priority: 'CRITICAL', slaMet: true }),
      t({ ownerKey: 'saidali', zoneCode: 'C', priority: 'CRITICAL', slaMet: false }),
      t({ ownerKey: 'saidali', zoneCode: 'C', priority: 'HIGH', slaMet: false }), // kritik emas
    ]);
    expect(computeMetric('official_ontime_rate', 'saidali', ds)).toBe(0.5);
  });
});

describe('fcr_rate va avg_first_response_hours', () => {
  it('qayta murojaatsiz yopilganlar ulushi', () => {
    const ds = dataset([
      t({ ownerKey: 'saidali', zoneCode: 'C' }),
      t({ ownerKey: 'saidali', zoneCode: 'C', isRepeat: true }),
      t({ ownerKey: 'saidali', zoneCode: 'C', status: 'OPEN', closedAt: null }),
    ]);
    expect(computeMetric('fcr_rate', 'saidali', ds)).toBe(0.5);
  });

  it('birinchi javob vaqti o`rtachasi', () => {
    const ds = dataset([
      t({
        ownerKey: 'saidali',
        zoneCode: 'C',
        receivedAt: new Date('2026-06-02T09:00:00Z'),
        firstResponseAt: new Date('2026-06-02T10:00:00Z'),
      }),
      t({
        ownerKey: 'saidali',
        zoneCode: 'C',
        receivedAt: new Date('2026-06-02T09:00:00Z'),
        firstResponseAt: new Date('2026-06-02T12:00:00Z'),
      }),
      t({ ownerKey: 'saidali', zoneCode: 'C', firstResponseAt: null }),
    ]);
    expect(computeMetric('avg_first_response_hours', 'saidali', ds)).toBe(2);
  });
});

describe('load_balance_ratio — eng ko`p / eng kam yuklangan', () => {
  it('sarflangan soat nisbati', () => {
    const ds = dataset([
      t({ ownerKey: 'ulugbek', zoneCode: 'A', spentHours: 10 }),
      t({ ownerKey: 'jasur', zoneCode: 'B', spentHours: 15 }),
      t({ ownerKey: 'saidali', zoneCode: 'C', spentHours: 12 }),
    ]);
    expect(computeMetric('load_balance_ratio', 'head', ds)).toBe(1.5);
  });

  it('bir xodimda vaqt qayd etilmagan — nisbat ma`nosiz, null', () => {
    const ds = dataset([t({ ownerKey: 'ulugbek', zoneCode: 'A', spentHours: 10 })]);
    expect(computeMetric('load_balance_ratio', 'head', ds)).toBe(null);
  });
});

describe('audit va tizimli yechim metrikalari', () => {
  it('ombor auditlari soni', () => {
    const ds = dataset([], {
      audits: [
        { kind: 'WAREHOUSE', auditorKey: 'ulugbek' },
        { kind: 'WAREHOUSE', auditorKey: 'ulugbek' },
        { kind: 'BRANCH', auditorKey: 'saidali' },
      ],
    });
    expect(computeMetric('warehouse_audit_count', 'ulugbek', ds)).toBe(2);
  });

  it('baholangan qo`ng`iroq va chatlar soni', () => {
    const ds = dataset([], { audits: [{ kind: 'CALL', auditorKey: 'saidali' }] });
    expect(computeMetric('graded_calls_count', 'saidali', ds)).toBe(1);
  });

  it('faqat natijasi tasdiqlangan tizimli yechimlar', () => {
    expect(computeMetric('systemic_solutions_count', 'head', dataset([], { verifiedSolutions: 2 }))).toBe(2);
  });
});

describe('tashqi tizim metrikalari avtomatik hisoblanmaydi', () => {
  it.each(['lost_return_share', 'stuck_tracks_share', 'mgmt_ontime_rate'] as const)('%s → null', (metric) => {
    expect(computeMetric(metric, 'head', dataset([]))).toBe(null);
  });
});
