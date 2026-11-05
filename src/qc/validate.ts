/**
 * Tekshiruv kiritishni tekshirish — SOF funksiya (serverda ham, brauzerda ham ishlatiladi).
 * Xato matnlari o'zbekcha va nima qilish kerakligini aytadi; server ularni 400 bilan qaytaradi.
 */

import { addDays, isYmd, type Answer, type Checkpoint } from './calc';

export interface NoteInput {
  text?: string;
  ref?: string;
}

export interface TaskInput {
  cp: string;
  what: string;
  owner: string;
  due: string;
}

export interface AuditInput {
  dept: string;
  date: string;
  subject?: string;
  answers: Record<string, Answer>;
  notes: Record<string, NoteInput>;
  tasks: TaskInput[];
}

export interface CleanAudit {
  dept: string;
  date: string;
  subject: string;
  answers: Record<string, Answer>;
  notes: Record<string, { text: string; ref: string }>;
  tasks: TaskInput[];
}

export type Validation = { ok: true; data: CleanAudit } | { ok: false; error: string };

export interface ValidateOptions {
  today: string;
  /** Sana bugundan boshqacha bo'lishi mumkinmi (rahbar tuzatganda). */
  allowPast: boolean;
  /** Barcha faol nuqtalar javoblanishi shartmi (yangi tekshiruvda ha). */
  requireComplete: boolean;
}

const ANSWERS = new Set(['yes', 'no', 'na']);
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

const fail = (error: string): Validation => ({ ok: false, error });

/** `body` — tasdiqlanmagan JSON; `checkpoints` — shu bo'limning nuqtalari. */
export function validateAudit(body: unknown, checkpoints: Checkpoint[], opts: ValidateOptions): Validation {
  if (!body || typeof body !== 'object') return fail('So‘rov noto‘g‘ri: tekshiruv ma‘lumoti yo‘q.');
  const b = body as Record<string, unknown>;

  const date = str(b.date);
  if (!isYmd(date)) return fail('Sana noto‘g‘ri: YYYY-MM-DD ko‘rinishida kiriting.');
  if (date > opts.today) return fail('Sana kelajakda bo‘lishi mumkin emas. Bugungi sanani tanlang.');
  if (!opts.allowPast && date !== opts.today) return fail('Tekshiruv faqat bugungi sana bilan kiritiladi.');

  const rawAnswers = b.answers;
  if (!rawAnswers || typeof rawAnswers !== 'object' || Array.isArray(rawAnswers)) {
    return fail('Javoblar yuborilmagan.');
  }
  const active = new Map(checkpoints.filter((c) => c.active).map((c) => [c.id, c]));
  const answers: Record<string, Answer> = {};
  for (const [id, a] of Object.entries(rawAnswers as Record<string, unknown>)) {
    if (!active.has(id)) return fail(`«${id}» nuqtasi bu bo‘limda faol emas. Sahifani yangilang.`);
    if (typeof a !== 'string' || !ANSWERS.has(a)) return fail('Javob «Ha», «Yo‘q» yoki «Tegishli emas» bo‘lishi kerak.');
    answers[id] = a as Answer;
  }
  if (Object.keys(answers).length === 0) return fail('Hech bir nuqta belgilanmagan.');
  if (opts.requireComplete) {
    const missing = [...active.values()].filter((c) => !answers[c.id]);
    if (missing.length > 0) {
      return fail(`Barcha nuqtalarni belgilang: javobsiz ${missing.length} ta nuqta qoldi («${missing[0]!.text}»).`);
    }
  }

  const rawNotes = b.notes && typeof b.notes === 'object' && !Array.isArray(b.notes) ? (b.notes as Record<string, NoteInput>) : {};
  const notes: CleanAudit['notes'] = {};
  const rawTasks = Array.isArray(b.tasks) ? (b.tasks as unknown[]) : [];
  const tasks: TaskInput[] = [];

  for (const t of rawTasks) {
    const o = (t ?? {}) as Record<string, unknown>;
    const task: TaskInput = { cp: str(o.cp), what: str(o.what), owner: str(o.owner), due: str(o.due) };
    if (answers[task.cp] !== 'no') return fail('Topshiriq faqat «Yo‘q» javob berilgan nuqtaga tegishli bo‘lishi mumkin.');
    if (!task.what) return fail('Topshiriqda «Nima qilinishi kerak» maydonini to‘ldiring.');
    if (!task.owner) return fail('Topshiriqda mas‘ul shaxsni yozing.');
    if (!isYmd(task.due)) return fail('Topshiriq muddati noto‘g‘ri: sanani tanlang.');
    if (task.due < date) return fail('Topshiriq muddati tekshiruv sanasidan oldin bo‘lishi mumkin emas.');
    tasks.push(task);
  }

  for (const [id, a] of Object.entries(answers)) {
    if (a !== 'no') continue;
    const text = str(rawNotes[id]?.text);
    if (!text) return fail(`«Yo‘q» javobga izoh majburiy: «${active.get(id)!.text}».`);
    notes[id] = { text, ref: str(rawNotes[id]?.ref) };
    if (!tasks.some((t) => t.cp === id)) {
      return fail(`«Yo‘q» javobga kamida bitta topshiriq kerak: «${active.get(id)!.text}».`);
    }
  }

  return { ok: true, data: { dept: str(b.dept), date, subject: str(b.subject), answers, notes, tasks } };
}

/** Topshiriq muddati uchun boshlang'ich qiymat: ertaga. */
export function defaultDue(today: string): string {
  return addDays(today, 1);
}
