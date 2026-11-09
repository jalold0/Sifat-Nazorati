/**
 * Eski sozlamadagi o'quv dasturi (training: title, intro, pass, days, quiz) va yangi keys-fayllarini
 * yangi shaklga o'tkazish — SOF funksiyalar (seed va test ishlatadi).
 *
 * Eski quiz[]: { q, o, a, w }  →  { id: q1.., case: q, options: o, answer: a, why: w }.
 * Bo'lim uchun `oquv_<kalit>_keys.json` ({ pass, questions }) bo'lsa — test shundan olinadi, bo'lmasa eski quiz.
 */

import { type Day, DEFAULT_PASS, type Question } from './training';


export interface OldTraining {
  title: string;
  intro?: string;
  pass?: number;
  days: Array<{ title: string; theory?: string[]; tasks?: string[] }>;
  quiz?: Array<{ q: string; o: string[]; a: number; w: string }>;
}

export interface KeysFile {
  pass?: number;
  questions: Question[];
}

export interface TrainingDoc {
  title: string;
  intro: string;
  passPct: number;
  days: Day[];
  questions: Question[];
  source: 'keys' | 'quiz';
}

export function convertQuiz(quiz: OldTraining['quiz']): Question[] {
  return (quiz ?? []).map((x, i) => ({ id: `q${i + 1}`, case: x.q, options: [...x.o], answer: x.a, why: x.w }));
}

/** Keys-fayl tuzilishini tekshiradi; xato bo'lsa nima noto'g'ri ekanini aytadi (seed to'xtaydi). */
export function validateKeys(file: KeysFile, name = 'keys'): string | null {
  if (!file || !Array.isArray(file.questions) || file.questions.length === 0) return `${name}: savollar yo‘q`;
  const ids = new Set<string>();
  for (const q of file.questions) {
    if (!q.id || ids.has(q.id)) return `${name}: savol id takrorlangan yoki yo‘q (${q.id})`;
    ids.add(q.id);
    if (!q.case || !q.why) return `${name}: ${q.id} keys yoki tushuntirish yo‘q`;
    if (!Array.isArray(q.options) || q.options.length !== 4) return `${name}: ${q.id} da 4 ta variant bo‘lishi kerak`;
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) return `${name}: ${q.id} to‘g‘ri javob indeksi 0–3 emas`;
  }
  return null;
}

export function buildTrainingDoc(old: OldTraining, keys?: KeysFile | null): TrainingDoc {
  const days: Day[] = old.days.map((d) => ({ title: d.title, theory: [...(d.theory ?? [])], tasks: [...(d.tasks ?? [])] }));
  if (keys) {
    return {
      title: old.title,
      intro: old.intro ?? '',
      passPct: keys.pass ?? DEFAULT_PASS,
      days,
      questions: keys.questions,
      source: 'keys',
    };
  }
  return {
    title: old.title,
    intro: old.intro ?? '',
    passPct: DEFAULT_PASS,
    days,
    questions: convertQuiz(old.quiz),
    source: 'quiz',
  };
}
