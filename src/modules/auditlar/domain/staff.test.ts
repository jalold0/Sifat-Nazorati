import { describe, expect, it } from 'vitest';

import { auditCritical, scoreAnswers, scoreAudits } from './scoring';
import { cpStaffSummary, derivedAnswer, type StaffBlock, staffBreakdown, staffRatio } from './staff';
import { validateAudit } from './validate';
import type { Checkpoint } from '@/modules/bolimlar/domain';


const cps: Checkpoint[] = [
  { id: 'cp1', text: 'Ish joyi tartibda', weight: 1, critical: false, active: true },
  { id: 'cp2', text: 'Smenani topshirdi', weight: 2, critical: true, active: true, kind: 'staff_check', okLabel: 'Topshirdi', badLabel: 'Topshirmadi' },
  { id: 'cp3', text: 'Murojaatlar sifatli yopildi', weight: 1, critical: false, active: true, kind: 'staff_count', okLabel: 'Sifatli', badLabel: 'Yopilmadi' },
];
const roster = [
  { id: 's1', name: 'Aziz' },
  { id: 's2', name: 'Vali' },
  { id: 's3', name: 'Laylo' },
  { id: 's4', name: 'Kecha ishdan ketgan' },
];
const opts = { today: '2026-11-06', allowPast: false, requireComplete: true, roster };

function body(over: Record<string, unknown> = {}) {
  return {
    dept: 'd1',
    date: '2026-11-06',
    answers: { cp1: 'yes' },
    notes: {},
    tasks: [],
    staff: {
      people: ['s1', 's2', 's3'],
      results: {
        cp2: { s1: { v: 'yes' }, s2: { v: 'no', reason: 'Kech qoldi' }, s3: { v: 'yes' } },
        cp3: { s1: { ok: 40, bad: 0 }, s2: { ok: 30, bad: 10, reason: 'Tizim sekin' }, s3: { ok: 40, bad: 0 } },
      },
    },
    ...over,
  };
}

describe('staffRatio va derivedAnswer', () => {
  it('Ha/Yo‘q va sonlar ulushga aylanadi; «tegishli emas» hisobga olinmaydi', () => {
    expect(staffRatio({ a: { v: 'yes' }, b: { v: 'no' }, c: { v: 'na' } })).toBe(0.5);
    expect(staffRatio({ a: { ok: 3, bad: 1 } })).toBe(0.75);
    expect(staffRatio({ a: { v: 'na' } })).toBeNull();
    expect(derivedAnswer({ a: { v: 'yes' } })).toBe('yes');
    expect(derivedAnswer({ a: { ok: 9, bad: 1 } })).toBe('no');
    expect(derivedAnswer({ a: { ok: 0, bad: 0 } })).toBe('na');
  });
});

describe('ball hodimli nuqtalar bilan', () => {
  const staff: StaffBlock = {
    people: roster.slice(0, 3),
    results: {
      cp2: { s1: { v: 'yes' }, s2: { v: 'no', reason: 'x' }, s3: { v: 'yes' } },
      cp3: { s1: { ok: 40, bad: 0 }, s2: { ok: 30, bad: 10, reason: 'y' }, s3: { ok: 40, bad: 0 } },
    },
  };
  const answers = { cp1: 'yes', cp2: 'no', cp3: 'no' } as const;

  it('ulush og‘irlikka ko‘paytiriladi: (1·1 + 2·2/3 + 1·110/120) / 4', () => {
    const expected = ((1 + 2 * (2 / 3) + 110 / 120) / 4) * 100;
    expect(scoreAnswers(answers, cps, null, staff).pct).toBeCloseTo(expected, 6);
  });

  it('hodim bloki bo‘lmasa — eski formula (Yo‘q = 0) o‘zgarishsiz', () => {
    expect(scoreAnswers(answers, cps).pct).toBeCloseTo(25, 6);
  });

  it('davr bali ham hodim ulushini hisobga oladi', () => {
    const one = scoreAnswers(answers, cps, null, staff).pct!;
    const agg = scoreAudits([{ id: 'a', dept: 'd1', date: '2026-11-06', answers, critical: true, staff }], cps).pct!;
    expect(agg).toBeCloseTo(one, 6);
  });

  it('jiddiy hodimli nuqtada bitta yiqilish — tekshiruv jiddiy (hosil javob «Yo‘q»)', () => {
    expect(auditCritical(answers, cps)).toBe(true);
  });
});

describe('cpStaffSummary', () => {
  const block: StaffBlock = {
    people: roster.slice(0, 3),
    results: {
      cp2: { s1: { v: 'yes' }, s2: { v: 'no', reason: 'Kech qoldi' }, s3: { v: 'yes' } },
      cp3: { s1: { ok: 40, bad: 0 }, s2: { ok: 30, bad: 10, reason: 'Tizim sekin' }, s3: { ok: 40, bad: 0 } },
    },
  };

  it('Ha/Yo‘q: «Topshirdi: 2 / 3 hodim»; yiqilganlar tepada', () => {
    const s = cpStaffSummary(cps[1]!, block, 'cp2')!;
    expect(s.sentence).toBe('Topshirdi: 2 / 3 hodim (66,7%) · Topshirmadi: 1');
    expect(s.rows[0]).toMatchObject({ name: 'Vali', bad: 1, reason: 'Kech qoldi', verdict: 'no' });
  });

  it('son: jami, yaxshi, yomon va nechta hodimda', () => {
    const s = cpStaffSummary(cps[2]!, block, 'cp3')!;
    expect(s.sentence).toBe('Jami 120: Sifatli 110, Yopilmadi 10 (91,7%) · 1 / 3 hodimda');
  });

  it('oddiy nuqta uchun null', () => {
    expect(cpStaffSummary(cps[0]!, block, 'cp1')).toBeNull();
  });
});

describe('staffBreakdown', () => {
  it('hodim bo‘yicha jamlaydi, eng zaifi tepada, ism eng oxirgi tekshiruvdan', () => {
    const rows = staffBreakdown(
      [
        { date: '2026-11-05', staff: { people: [{ id: 's2', name: 'Vali (eski)' }], results: { cp2: { s2: { v: 'no', reason: 'x' } } } } },
        {
          date: '2026-11-06',
          staff: {
            people: [{ id: 's1', name: 'Aziz' }, { id: 's2', name: 'Vali' }],
            results: { cp2: { s1: { v: 'yes' }, s2: { v: 'yes' } }, cp3: { s2: { ok: 8, bad: 2, reason: 'y' } } },
          },
        },
        { date: '2026-11-06', staff: null },
      ],
      cps,
    );
    expect(rows.map((r) => r.name)).toEqual(['Vali', 'Aziz']);
    expect(rows[0]).toMatchObject({ audits: 2, ok: 9, bad: 3, byCp: { cp2: { ok: 1, bad: 1 }, cp3: { ok: 8, bad: 2 } } });
    expect(rows[0]!.pct).toBeCloseTo(75, 6);
    expect(rows[1]).toMatchObject({ audits: 1, ok: 1, bad: 0, pct: 100 });
  });
});

describe('validateAudit — hodimli nuqtalar', () => {
  it('to‘g‘ri kiritish: javob hosil qilinadi, ism ro‘yxatdan olinadi, umumiy izoh/topshiriq shart emas', () => {
    const v = validateAudit(body(), cps, opts);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.data.answers).toEqual({ cp1: 'yes', cp2: 'no', cp3: 'no' });
    expect(v.data.staff?.people).toEqual(roster.slice(0, 3));
    expect(v.data.tasks).toEqual([]);
  });

  it('mijoz yuborgan umumiy javob e‘tiborga olinmaydi', () => {
    const v = validateAudit(body({ answers: { cp1: 'yes', cp2: 'yes', cp3: 'yes' } }), cps, opts);
    expect(v.ok && v.data.answers.cp2).toBe('no');
  });

  it('ro‘yxatda yo‘q hodim rad etiladi', () => {
    const b = body();
    (b.staff as { people: string[] }).people.push('begona');
    expect(validateAudit(b, cps, opts)).toMatchObject({ ok: false, error: expect.stringContaining('ro‘yxatida yo‘q') });
  });

  it('«Yo‘q» va yomon > 0 da sabab majburiy', () => {
    const b1 = body();
    (b1.staff.results.cp2 as Record<string, unknown>).s2 = { v: 'no' };
    expect(validateAudit(b1, cps, opts)).toMatchObject({ ok: false, error: expect.stringContaining('Vali uchun sababni') });
    const b2 = body();
    (b2.staff.results.cp3 as Record<string, unknown>).s2 = { ok: 1, bad: 2 };
    expect(validateAudit(b2, cps, opts)).toMatchObject({ ok: false, error: expect.stringContaining('Vali uchun sababni') });
  });

  it('sonlar butun va manfiy emas', () => {
    const b = body();
    (b.staff.results.cp3 as Record<string, unknown>).s1 = { ok: -1, bad: 0 };
    expect(validateAudit(b, cps, opts)).toMatchObject({ ok: false, error: expect.stringContaining('butun son') });
  });

  it('smenadagi har hodimga natija majburiy (yangi tekshiruv)', () => {
    const b = body();
    delete (b.staff.results.cp2 as Record<string, unknown>).s3;
    expect(validateAudit(b, cps, opts)).toMatchObject({ ok: false, error: expect.stringContaining('Laylo uchun natija') });
  });

  it('nuqta butunlay «Tegishli emas» bo‘lishi mumkin', () => {
    const b = body({ answers: { cp1: 'yes', cp3: 'na' } });
    delete (b.staff.results as Record<string, unknown>).cp3;
    const v = validateAudit(b, cps, opts);
    expect(v.ok && v.data.answers.cp3).toBe('na');
    expect(v.ok && Object.keys(v.data.staff!.results)).toEqual(['cp2']);
  });

  it('natija ham, «Tegishli emas» ham bo‘lmasa — xato', () => {
    const b = body();
    delete (b.staff.results as Record<string, unknown>).cp3;
    expect(validateAudit(b, cps, opts)).toMatchObject({ ok: false, error: expect.stringContaining('Murojaatlar sifatli yopildi') });
  });

  it('smenada belgilanmagan hodimga natija yozib bo‘lmaydi', () => {
    const b = body();
    (b.staff.results.cp2 as Record<string, unknown>).s4 = { v: 'yes' };
    expect(validateAudit(b, cps, opts)).toMatchObject({ ok: false, error: expect.stringContaining('smenada belgilanmagan') });
  });

  it('oddiy nuqtada «Yo‘q» uchun izoh va topshiriq avvalgidek majburiy', () => {
    expect(validateAudit(body({ answers: { cp1: 'no' } }), cps, opts)).toMatchObject({ ok: false, error: expect.stringContaining('izoh majburiy') });
  });
});
