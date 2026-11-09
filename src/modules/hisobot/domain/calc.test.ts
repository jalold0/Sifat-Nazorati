import { describe, expect, it } from 'vitest';

import { evaluateDept } from './evaluate';
import { periodRange } from './period';
import { trafficCount, trafficPct } from './status';
import { buildSummary, topNoCheckpoints } from './summary';
import { auditCritical, type AuditRec, openAt, scoreAnswers, type TaskRec } from '@/modules/auditlar/domain';
import type { Checkpoint, DeptInput } from '@/modules/bolimlar/domain';
import { addDays, todayTashkent } from '@/shared/time';


const cps = (n: number, weights: number[] = []): Checkpoint[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `cp${i + 1}`,
    text: `Nuqta ${i + 1}`,
    weight: weights[i] ?? 1,
    critical: false,
    active: true,
  }));

const answersOf = (spec: string): Record<string, 'yes' | 'no' | 'na'> => {
  const map = { y: 'yes', n: 'no', x: 'na' } as const;
  return Object.fromEntries([...spec].map((c, i) => [`cp${i + 1}`, map[c as 'y' | 'n' | 'x']]));
};

describe('scoreAnswers — bo‘lim bali', () => {
  it('8 nuqta, 6 «Ha», 2 «Yo‘q» → 75%', () => {
    expect(scoreAnswers(answersOf('yyyyyynn'), cps(8)).pct).toBe(75);
  });

  it('shu holat, lekin 1 nuqta «Tegishli emas» → 6/7 = 85.7%', () => {
    const r = scoreAnswers(answersOf('yyyyyynx'), cps(8));
    expect(r.pct).toBeCloseTo(85.714, 2);
    expect(r.na).toBe(1);
  });

  it('og‘irliklar 1, 1, 3 va «Yo‘q» faqat og‘irligi 3 nuqtada → 40%', () => {
    expect(scoreAnswers(answersOf('yyn'), cps(3, [1, 1, 3])).pct).toBe(40);
  });

  it('hamma javob «Tegishli emas» → ball yo‘q (null), nolga bo‘lish xatosi yo‘q', () => {
    expect(scoreAnswers(answersOf('xxxx'), cps(4)).pct).toBeNull();
  });

  it('bo‘sh javoblar → null', () => {
    expect(scoreAnswers({}, cps(3)).pct).toBeNull();
  });

  it('noma‘lum nuqta javobi e‘tiborga olinmaydi', () => {
    expect(scoreAnswers({ zz: 'no', cp1: 'yes' }, cps(1)).pct).toBe(100);
  });
});

describe('svetofor', () => {
  it('foiz: me‘yorda yoki yuqori — yashil', () => {
    expect(trafficPct(90, 90)).toBe('green');
    expect(trafficPct(100, 90)).toBe('green');
  });
  it('foiz: me‘yordan 10 punktdan kam past — sariq (10 ning o‘zi ham sariq)', () => {
    expect(trafficPct(85, 90)).toBe('yellow');
    expect(trafficPct(80, 90)).toBe('yellow');
  });
  it('foiz: 10 dan ko‘p past — qizil', () => {
    expect(trafficPct(79.9, 90)).toBe('red');
    expect(trafficPct(40, 90)).toBe('red');
  });
  it('foiz: ma‘lumot yo‘q — kulrang', () => {
    expect(trafficPct(null, 90)).toBe('gray');
  });
  it('sonli: 0 yashil, 1 sariq, 2 va undan ko‘p qizil', () => {
    expect(trafficCount(0)).toBe('green');
    expect(trafficCount(1)).toBe('yellow');
    expect(trafficCount(2)).toBe('red');
    expect(trafficCount(7)).toBe('red');
    expect(trafficCount(null)).toBe('gray');
  });
});

describe('sana yordamchilari', () => {
  it('Toshkent vaqti (UTC+5): UTC 19:00 allaqachon ertangi kun', () => {
    expect(todayTashkent(new Date('2026-03-10T19:00:00Z'))).toBe('2026-03-11');
    expect(todayTashkent(new Date('2026-03-10T18:59:00Z'))).toBe('2026-03-10');
  });
  it('addDays oy chegarasidan o‘tadi', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('davr: bugun, 7 kun, 30 kun (chegaralar kiritilgan) va o‘tgan teng davr', () => {
    expect(periodRange('today', '2026-03-10')).toEqual({
      from: '2026-03-10',
      to: '2026-03-10',
      prevFrom: '2026-03-09',
      prevTo: '2026-03-09',
    });
    const w = periodRange('7', '2026-03-10');
    expect(w.from).toBe('2026-03-04');
    expect(w.to).toBe('2026-03-10');
    expect(w.prevFrom).toBe('2026-02-25');
    expect(w.prevTo).toBe('2026-03-03');
    const m = periodRange('30', '2026-03-10');
    expect(m.from).toBe('2026-02-09');
    expect(m.prevTo).toBe('2026-02-08');
  });
});

const TODAY = '2026-03-10';

function dept(over: Partial<DeptInput> = {}): DeptInput {
  return { id: 'd1', name: 'Call center', norm: 90, estimate: true, checkpoints: cps(8), ...over };
}
function audit(id: string, date: string, spec: string, over: Partial<AuditRec> = {}): AuditRec {
  return { id, dept: 'd1', date, answers: answersOf(spec), critical: false, ...over };
}
function task(id: string, due: string, status: 'open' | 'closed', closedAt?: string): TaskRec {
  return { id, audit: 'a1', dept: 'd1', cp: 'cp1', what: 'Tuzatish', owner: 'Aziz', due, status, closedAt };
}

describe('evaluateDept — 5 ko‘rsatkich', () => {
  const range = periodRange('7', TODAY);

  it('hech qanday ma‘lumot yo‘q → hamma ko‘rsatkich va bo‘lim kulrang', () => {
    const r = evaluateDept(dept(), [], [], range, TODAY);
    expect(r.metrics.map((m) => m.status)).toEqual(['gray', 'gray', 'gray', 'gray', 'info']);
    expect(r.status).toBe('gray');
    expect(r.auditCount).toBe(0);
  });

  it('bitta jiddiy tekshiruv: bo‘lim qizil, ball yuqori bo‘lsa ham', () => {
    const r = evaluateDept(
      dept(),
      [audit('a1', '2026-03-09', 'yyyyyyyy', { critical: true })],
      [],
      range,
      TODAY,
    );
    expect(r.metrics[0]!.value).toBe(100);
    expect(r.metrics[0]!.status).toBe('green');
    expect(r.criticalCount).toBe(1);
    expect(r.status).toBe('red');
  });

  it('ball bo‘yicha qizil → bo‘lim qizil; tekshiruvlar soni rangga hisoblanmaydi', () => {
    const r = evaluateDept(dept(), [audit('a1', '2026-03-09', 'yyyynnnn')], [], range, TODAY);
    expect(r.metrics[0]!.status).toBe('red');
    expect(r.metrics[4]!.status).toBe('info');
    expect(r.status).toBe('red');
  });

  it('ball yashil, jiddiy 0 → bo‘lim yashil', () => {
    const r = evaluateDept(dept(), [audit('a1', '2026-03-09', 'yyyyyyyy')], [], range, TODAY);
    expect(r.metrics[1]!.status).toBe('green');
    expect(r.status).toBe('green');
  });

  it('bir nechta tekshiruv bo‘yicha ball jamlangan og‘irlik bilan hisoblanadi', () => {
    const r = evaluateDept(
      dept(),
      [audit('a1', '2026-03-09', 'yyyyyyyy'), audit('a2', '2026-03-10', 'yyyynnnn')],
      [],
      range,
      TODAY,
    );
    expect(r.metrics[0]!.value).toBe(75); // 12 / 16
  });

  it('davr tashqarisidagi tekshiruv hisobga olinmaydi, chegaralar kiritilgan', () => {
    const r = evaluateDept(
      dept(),
      [
        audit('a1', '2026-03-03', 'nnnnnnnn'), // davrdan 1 kun oldin
        audit('a2', '2026-03-04', 'yyyyyyyy'), // chegara
        audit('a3', '2026-03-10', 'yyyyyyyy'), // chegara
      ],
      [],
      range,
      TODAY,
    );
    expect(r.auditCount).toBe(2);
    expect(r.metrics[0]!.value).toBe(100);
  });

  it('topshiriq: muddatida yopilgan, kech yopilgan, hali ochiq → 1/3 = 33%', () => {
    const r = evaluateDept(
      dept(),
      [audit('a1', '2026-03-05', 'yyyyyyyy')],
      [
        task('t1', '2026-03-08', 'closed', '2026-03-08'), // muddatida
        task('t2', '2026-03-07', 'closed', '2026-03-09'), // kech
        task('t3', '2026-03-09', 'open'), // hali ochiq, muddati o‘tgan
      ],
      range,
      TODAY,
    );
    expect(r.metrics[2]!.value).toBeCloseTo(33.33, 1);
    expect(r.metrics[2]!.status).toBe('red');
    expect(r.metrics[3]!.value).toBe(1); // t3
    expect(r.metrics[3]!.status).toBe('yellow');
  });

  it('muddati davrga tushmagan topshiriq 3-ko‘rsatkichga kirmaydi, lekin muddati o‘tgan ochiq 4-ga kiradi', () => {
    const r = evaluateDept(dept(), [], [task('t1', '2026-01-01', 'open')], range, TODAY);
    expect(r.metrics[2]!.value).toBeNull();
    expect(r.metrics[3]!.value).toBe(1);
  });

  it('muddati bugun bo‘lgan ochiq topshiriq hali muddati o‘tgan emas', () => {
    const r = evaluateDept(dept(), [], [task('t1', TODAY, 'open')], range, TODAY);
    expect(r.metrics[3]!.value).toBe(0);
    expect(r.metrics[3]!.status).toBe('green');
  });

  it('2 va undan ko‘p muddati o‘tgan topshiriq → qizil', () => {
    const r = evaluateDept(
      dept(),
      [],
      [task('t1', '2026-03-01', 'open'), task('t2', '2026-03-02', 'open')],
      range,
      TODAY,
    );
    expect(r.metrics[3]!.status).toBe('red');
    expect(r.status).toBe('red');
  });

  it('«taxminiy» belgisi bo‘lim bayrog‘idan olinadi', () => {
    expect(evaluateDept(dept(), [], [], range, TODAY).estimate).toBe(true);
    expect(evaluateDept(dept({ estimate: false }), [], [], range, TODAY).estimate).toBe(false);
  });
});

describe('auditCritical', () => {
  it('faqat faol jiddiy nuqtada «Yo‘q» bo‘lsa true', () => {
    const list = cps(3);
    list[1]!.critical = true;
    expect(auditCritical(answersOf('yny'), list)).toBe(true);
    expect(auditCritical(answersOf('yyn'), list)).toBe(false);
    expect(auditCritical(answersOf('yxy'), list)).toBe(false);
    list[1]!.active = false;
    expect(auditCritical(answersOf('yny'), list)).toBe(false);
  });
});

describe('topNoCheckpoints', () => {
  it('eng ko‘p «Yo‘q» olgan 3 nuqta, tenglikda tartib bo‘yicha', () => {
    const audits = [
      audit('a1', TODAY, 'nynynyyy'),
      audit('a2', TODAY, 'nyyyyyyy'),
      audit('a3', TODAY, 'nnyyyyyn'),
    ];
    const top = topNoCheckpoints(audits, cps(8), 3);
    expect(top.map((t) => [t.id, t.count])).toEqual([
      ['cp1', 3],
      ['cp2', 1],
      ['cp3', 1],
    ]);
  });
  it('«Yo‘q» yo‘q bo‘lsa — bo‘sh', () => {
    expect(topNoCheckpoints([audit('a1', TODAY, 'yyyyyyyy')], cps(8))).toEqual([]);
  });
});

describe('buildSummary — 3 qatorli xulosa', () => {
  const range = periodRange('7', TODAY);
  const mk = (spec: string, date: string, n: number) =>
    Array.from({ length: n }, (_, i) => audit(`${date}-${i}`, date, spec));

  it('tekshiruv bo‘lmasa: «Bu davrda tekshiruv yo‘q»', () => {
    expect(buildSummary(dept(), [], [], range, TODAY)).toEqual({
      kind: 'none',
      lines: ['Bu davrda tekshiruv yo‘q'],
    });
  });

  it('4 ta tekshiruv: xulosa o‘rniga «Namuna kichik (4 ta tekshiruv)…»', () => {
    const s = buildSummary(dept(), mk('yyyyyyyy', '2026-03-09', 4), [], range, TODAY);
    expect(s.kind).toBe('small');
    expect(s.lines).toEqual([
      'Namuna kichik (4 ta tekshiruv): xulosa chiqarilmaydi, tekshiruv hajmini oshiring',
    ]);
  });

  it('5 ta tekshiruv: 3 qatorli xulosa chiqadi', () => {
    const s = buildSummary(dept(), mk('yyyyyyyy', '2026-03-09', 5), [], range, TODAY);
    expect(s.kind).toBe('ok');
    expect(s.lines).toHaveLength(3);
  });

  it('o‘tgan davrda ma‘lumot yo‘q → «Yomonlashgani yo‘q», «Yaxshilanish yo‘q», xato chiqmaydi', () => {
    const s = buildSummary(dept(), mk('yyyyyynn', '2026-03-09', 5), [], range, TODAY);
    expect(s.lines[0]).toBe('Yomonlashdi: Yomonlashgani yo‘q.');
    expect(s.lines[1]).toBe('Yaxshilandi: Yaxshilanish yo‘q.');
  });

  it('ball pasaydi → «Umumiy ball 100% dan 75% ga»', () => {
    const audits = [...mk('yyyyyyyy', '2026-02-28', 5), ...mk('yyyyyynn', '2026-03-09', 5)];
    const s = buildSummary(dept(), audits, [], range, TODAY);
    expect(s.lines[0]).toContain('Umumiy ball 100% dan 75% ga');
    expect(s.lines[1]).toBe('Yaxshilandi: Yaxshilanish yo‘q.');
  });

  it('ball oshdi → «Yaxshilandi» qatorida', () => {
    const audits = [...mk('yyyyyynn', '2026-02-28', 5), ...mk('yyyyyyyy', '2026-03-09', 5)];
    const s = buildSummary(dept(), audits, [], range, TODAY);
    expect(s.lines[1]).toContain('Umumiy ball 75% dan 100% ga');
    expect(s.lines[0]).toBe('Yomonlashdi: Yomonlashgani yo‘q.');
  });

  it('«Birinchi navbatda»: eng ko‘p «Yo‘q» nuqta va muddati o‘tgan topshiriqlar soni', () => {
    const audits = mk('nyyyyyyy', '2026-03-09', 5);
    const s = buildSummary(dept(), audits, [task('t1', '2026-03-01', 'open')], range, TODAY);
    expect(s.lines[2]).toBe(
      'Birinchi navbatda: «Nuqta 1» — 5 marta «Yo‘q»; muddati o‘tgan topshiriqlar: 1 ta.',
    );
  });
});

describe('openAt — o‘tgan sanaga ochiq topshiriqlar', () => {
  it('shu kungacha yopilmagan va shu kungacha yaratilganlar; keyin yaratilgani kirmaydi', () => {
    const list: TaskRec[] = [
      { ...task('a', '2026-03-12', 'open'), createdOn: '2026-03-01' },
      { ...task('b', '2026-03-12', 'closed', '2026-03-09'), createdOn: '2026-03-01' }, // 9-da yopilgan
      { ...task('c', '2026-03-12', 'closed', '2026-03-11'), createdOn: '2026-03-01' }, // 10-ga hali ochiq edi
      { ...task('d', '2026-03-20', 'open'), createdOn: '2026-03-11' }, // keyin yaratilgan
    ];
    expect(openAt(list, '2026-03-10').map((x) => x.id)).toEqual(['a', 'c']);
  });
});

describe('og‘irlikni muzlatish — keyin og‘irlik o‘zgarsa eski ball o‘zgarmaydi', () => {
  it('tekshiruvning o‘z og‘irliklari joriy nuqta og‘irligidan ustun', () => {
    // Kiritilganda og'irliklar 1,1,3 edi; keyin rahbar 3-nuqtani 1 ga tushirdi
    const now = cps(3, [1, 1, 1]);
    expect(scoreAnswers(answersOf('yyn'), now).pct).toBeCloseTo(66.67, 1); // muzlatilmagan: joriy og'irlik
    expect(scoreAnswers(answersOf('yyn'), now, { cp1: 1, cp2: 1, cp3: 3 }).pct).toBe(40);
  });

  it('davr bali ham muzlatilgan og‘irlik bilan hisoblanadi; eski yozuv (weights yo‘q) joriy og‘irlikni oladi', () => {
    const d = dept({ checkpoints: cps(3, [1, 1, 1]) });
    const frozen = audit('a1', '2026-03-09', 'yyn', { weights: { cp1: 1, cp2: 1, cp3: 3 } });
    const legacy = audit('a2', '2026-03-09', 'yyn');
    const range = periodRange('7', TODAY);
    expect(evaluateDept(d, [frozen], [], range, TODAY).scorePct).toBe(40);
    expect(evaluateDept(d, [legacy], [], range, TODAY).scorePct).toBeCloseTo(66.67, 1);
    expect(evaluateDept(d, [frozen, legacy], [], range, TODAY).scorePct).toBe(50); // (2+2) / ((2+3)+(2+1))
  });
});
