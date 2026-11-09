/**
 * Tekshiruv kiritishni tekshirish — SOF funksiya (serverda ham, brauzerda ham ishlatiladi).
 * Xato matnlari o'zbekcha va nima qilish kerakligini aytadi; server ularni 400 bilan qaytaradi.
 */

import { derivedAnswer, type StaffBlock, type StaffCell, type StaffPerson } from './staff';
import type { Answer } from './types';
import { type Checkpoint, isStaffKind } from '@/modules/bolimlar/domain';
import { type Channel, isChannel, LIST_LABEL, type ListKind, listOf } from '@/shared/lists';
import { addDays, isYmd } from '@/shared/time';


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
  /** Hodimli nuqtalar: smenadagilar (id) va natijalar. Ismni server ro'yxatdan oladi. */
  staff?: StaffInput;
}

export interface StaffInput {
  people: string[];
  results: Record<string, Record<string, StaffCell>>;
}

export interface CleanAudit {
  dept: string;
  date: string;
  subject: string;
  answers: Record<string, Answer>;
  notes: Record<string, { text: string; ref: string }>;
  tasks: TaskInput[];
  /** Hodimli nuqta bo'lmasa yoki hammasi «Tegishli emas» bo'lsa — null. */
  staff: StaffBlock | null;
  list: ListKind;
  /** Muloqot bahosi: baholangan operator (ro'yxatdan) va kanal; boshqa cheklistda null. */
  staffId: string | null;
  channel: Channel | null;
}

/** Hodim sababi va son chegaralari. */
export const REASON_MAX = 500;
export const COUNT_MAX = 100_000;
const PEOPLE_MAX = 200;

export type Validation = { ok: true; data: CleanAudit } | { ok: false; error: string };

export interface ValidateOptions {
  today: string;
  /** Sana bugundan boshqacha bo'lishi mumkinmi (rahbar tuzatganda). */
  allowPast: boolean;
  /** Barcha faol nuqtalar javoblanishi shartmi (yangi tekshiruvda ha). */
  requireComplete: boolean;
  /** Tanlash mumkin bo'lgan hodimlar (bo'lim ro'yxati; tuzatishda tekshiruvdagilar ham). Ism shu yerdan olinadi. */
  roster?: StaffPerson[];
  /** Qaysi cheklist bo'yicha (faqat shu cheklist nuqtalari qabul qilinadi). Bo'lmasa — 'shift'. */
  list?: ListKind;
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
  const list = listOf(opts.list);
  const active = new Map(checkpoints.filter((c) => c.active && listOf(c.list) === list).map((c) => [c.id, c]));
  if (active.size === 0) return fail(`Bu bo‘limda «${LIST_LABEL[list]}» cheklisti yo‘q.`);

  // Muloqot bahosi: kim, qaysi kanal, qaysi qo'ng'iroq/yozishma — majburiy
  let staffId: string | null = null;
  let channel: Channel | null = null;
  if (list === 'interaction') {
    staffId = str(b.staffId);
    if (!staffId) return fail('Qaysi operator baholanayotganini tanlang.');
    if (!(opts.roster ?? []).some((p) => p.id === staffId)) return fail('Operator bu bo‘lim ro‘yxatida yo‘q. Sahifani yangilang.');
    if (!isChannel(b.channel)) return fail('Kanalni tanlang: telefon, Telegram yoki sayt chati.');
    channel = b.channel;
    if (!str(b.subject)) return fail('Qo‘ng‘iroq yoki yozishma raqamini yozing (qayta tinglash/topish uchun).');
  }

  const answers: Record<string, Answer> = {};
  for (const [id, a] of Object.entries(rawAnswers as Record<string, unknown>)) {
    if (!active.has(id)) return fail(`«${id}» nuqtasi bu cheklistda faol emas. Sahifani yangilang.`);
    if (typeof a !== 'string' || !ANSWERS.has(a)) return fail('Javob «Ha», «Yo‘q» yoki «Tegishli emas» bo‘lishi kerak.');
    answers[id] = a as Answer;
  }

  // Hodimli nuqtalar: natijalar tekshiriladi va umumiy javob shulardan HOSIL qilinadi (mijozdagisi e'tiborsiz)
  const staffRes = validateStaff(b.staff, active, answers, opts);
  if (!staffRes.ok) return fail(staffRes.error);
  const staff = staffRes.block;

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
    if (isStaffKind(active.get(id)!.kind)) {
      // Hodimli nuqtada sabab hodim darajasida yozilgan: umumiy izoh va topshiriq ixtiyoriy
      const text = str(rawNotes[id]?.text);
      if (text) notes[id] = { text, ref: str(rawNotes[id]?.ref) };
      continue;
    }
    const text = str(rawNotes[id]?.text);
    if (!text) return fail(`«Yo‘q» javobga izoh majburiy: «${active.get(id)!.text}».`);
    notes[id] = { text, ref: str(rawNotes[id]?.ref) };
    // Muloqot bahosida «Yo'q» — operatorga murabbiylik (hisobotda ko'rinadi), topshiriq ixtiyoriy
    if (list !== 'interaction' && !tasks.some((t) => t.cp === id)) {
      return fail(`«Yo‘q» javobga kamida bitta topshiriq kerak: «${active.get(id)!.text}».`);
    }
  }

  return {
    ok: true,
    data: { dept: str(b.dept), date, subject: str(b.subject), answers, notes, tasks, staff, list, staffId, channel },
  };
}

type StaffCheck = { ok: true; block: StaffBlock | null } | { ok: false; error: string };

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= COUNT_MAX;

/**
 * Hodimli nuqtalarni tekshiradi va `answers` ga hosil javobni yozadi.
 * Nuqta butunlay «Tegishli emas» bo'lsa (answers[id] = 'na' va natija yo'q) — o'tkaziladi.
 */
function validateStaff(
  raw: unknown,
  active: Map<string, Checkpoint>,
  answers: Record<string, Answer>,
  opts: ValidateOptions,
): StaffCheck {
  const bad = (error: string): StaffCheck => ({ ok: false, error });
  const staffCps = [...active.values()].filter((c) => isStaffKind(c.kind));
  if (staffCps.length === 0) return { ok: true, block: null };

  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Partial<StaffInput>) : {};
  const ids = Array.isArray(input.people) ? input.people.filter((x): x is string => typeof x === 'string') : [];
  if (ids.length > PEOPLE_MAX) return bad(`Bitta tekshiruvda ${PEOPLE_MAX} tadan ortiq hodim bo‘lmaydi.`);
  const roster = new Map((opts.roster ?? []).map((p) => [p.id, p]));
  const people: StaffPerson[] = [];
  for (const id of new Set(ids)) {
    const p = roster.get(id);
    if (!p) return bad('Hodim bu bo‘lim ro‘yxatida yo‘q. Sahifani yangilang.');
    people.push({ id: p.id, name: p.name });
  }
  const present = new Set(people.map((p) => p.id));
  const rawResults =
    input.results && typeof input.results === 'object' && !Array.isArray(input.results)
      ? (input.results as Record<string, unknown>)
      : {};

  const results: StaffBlock['results'] = {};
  for (const cp of staffCps) {
    const cellsRaw = rawResults[cp.id];
    const cells: Record<string, StaffCell> = {};
    if (cellsRaw && typeof cellsRaw === 'object' && !Array.isArray(cellsRaw)) {
      for (const [personId, v] of Object.entries(cellsRaw as Record<string, unknown>)) {
        if (!present.has(personId)) return bad(`«${cp.text}»: natija smenada belgilanmagan hodimga yozilgan.`);
        const name = roster.get(personId)!.name;
        const o = (v ?? {}) as Record<string, unknown>;
        const reason = str(o.reason).slice(0, REASON_MAX);
        if (cp.kind === 'staff_check') {
          if (typeof o.v !== 'string' || !ANSWERS.has(o.v)) return bad(`«${cp.text}»: ${name} uchun natijani belgilang.`);
          if (o.v === 'no' && !reason) return bad(`«${cp.text}»: ${name} uchun sababni yozing.`);
          cells[personId] = reason ? { v: o.v as Answer, reason } : { v: o.v as Answer };
        } else {
          if (!isCount(o.ok) || !isCount(o.bad)) {
            return bad(`«${cp.text}»: ${name} uchun sonlar 0 dan ${COUNT_MAX} gacha butun son bo‘lsin.`);
          }
          if (o.bad > 0 && !reason) return bad(`«${cp.text}»: ${name} uchun sababni yozing.`);
          cells[personId] = reason ? { ok: o.ok, bad: o.bad, reason } : { ok: o.ok, bad: o.bad };
        }
      }
    }

    const filled = Object.keys(cells).length;
    if (filled === 0) {
      // Natija yo'q: nuqta «Tegishli emas» deb belgilangan bo'lsa qabul qilinadi
      if (answers[cp.id] === 'na') continue;
      delete answers[cp.id];
      if (opts.requireComplete) {
        return bad(
          people.length === 0
            ? `«${cp.text}»: smenadagi hodimlarni belgilang yoki nuqtani «Tegishli emas» deb belgilang.`
            : `«${cp.text}»: hodimlar natijasini kiriting yoki nuqtani «Tegishli emas» deb belgilang.`,
        );
      }
      continue;
    }
    if (opts.requireComplete && filled < present.size) {
      const missing = people.find((p) => !cells[p.id]);
      return bad(`«${cp.text}»: ${missing?.name ?? 'hodim'} uchun natija kiritilmagan.`);
    }
    results[cp.id] = cells;
    answers[cp.id] = derivedAnswer(cells);
  }

  return { ok: true, block: Object.keys(results).length > 0 ? { people, results } : null };
}

/** Topshiriq muddati uchun boshlang'ich qiymat: ertaga. */
export function defaultDue(today: string): string {
  return addDays(today, 1);
}
