import { describe, expect, it } from 'vitest';

import { buildTrainingDoc, convertQuiz, validateKeys, type KeysFile, type OldTraining } from './training-seed';

const old: OldTraining = {
  title: 'Kuryerka bo‘limini tekshirish: 1 haftalik dastur',
  intro: 'Kirish',
  pass: 80,
  days: [
    { title: '1-kun', theory: ['a', 'b'], tasks: ['t1', 't2'] },
    { title: '2-kun', theory: ['c'], tasks: ['t3'] },
  ],
  quiz: [
    { q: 'Savol 1', o: ['a', 'b', 'c', 'd'], a: 1, w: 'Sabab 1' },
    { q: 'Savol 2', o: ['a', 'b', 'c', 'd'], a: 3, w: 'Sabab 2' },
  ],
};

const keys: KeysFile = {
  pass: 70,
  questions: [{ id: 'k1', case: '1-keys', options: ['a', 'b', 'c', 'd'], answer: 2, why: 'Sabab' }],
};

describe('convertQuiz', () => {
  it('q,o,a,w → id=q1.., case, options, answer, why', () => {
    expect(convertQuiz(old.quiz)).toEqual([
      { id: 'q1', case: 'Savol 1', options: ['a', 'b', 'c', 'd'], answer: 1, why: 'Sabab 1' },
      { id: 'q2', case: 'Savol 2', options: ['a', 'b', 'c', 'd'], answer: 3, why: 'Sabab 2' },
    ]);
  });
  it('quiz yo‘q — bo‘sh', () => {
    expect(convertQuiz(undefined)).toEqual([]);
  });
});

describe('buildTrainingDoc', () => {
  it('keys-fayl bo‘lmasa eski quiz, pass = 70 (TZ), kunlar o‘zgarishsiz', () => {
    const d = buildTrainingDoc(old);
    expect(d.source).toBe('quiz');
    expect(d.passPct).toBe(70);
    expect(d.questions).toHaveLength(2);
    expect(d.days).toEqual(old.days);
    expect(d.title).toBe(old.title);
  });
  it('keys-fayl bo‘lsa test shundan; eski quiz ishlatilmaydi; dastur eskidan', () => {
    const d = buildTrainingDoc(old, keys);
    expect(d.source).toBe('keys');
    expect(d.questions.map((q) => q.id)).toEqual(['k1']);
    expect(d.days).toHaveLength(2);
  });
  it('nusxa oladi (kirish o‘zgarmaydi)', () => {
    const d = buildTrainingDoc(old);
    d.days[0]!.tasks.push('x');
    expect(old.days[0]!.tasks).toEqual(['t1', 't2']);
  });
});

describe('validateKeys', () => {
  it('to‘g‘ri fayl — null', () => {
    expect(validateKeys(keys)).toBeNull();
  });
  it('4 variantsiz, indeksi noto‘g‘ri yoki takroriy id — xato matni', () => {
    const q = keys.questions[0]!;
    expect(validateKeys({ questions: [{ ...q, options: ['a', 'b'] }] })).toContain('4 ta variant');
    expect(validateKeys({ questions: [{ ...q, answer: 4 }] })).toContain('0–3');
    expect(validateKeys({ questions: [q, q] })).toContain('takrorlangan');
    expect(validateKeys({ questions: [] })).toContain('savollar yo‘q');
  });
});
