/**
 * Ball hisobi: Ha / (Ha + Yo'q), og'irlik, jiddiylik, cheklist kesimi — SOF.
 */

import { type StaffBlock, staffRatio } from './staff';
import type { Answer, AuditRec } from './types';
import type { Checkpoint } from '@/modules/bolimlar/domain';
import { LIST_ORDER, type ListKind, listOf } from '@/shared/lists';

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

/** Tekshiruvning o'z (muzlatilgan) og'irliklari bo'lsa ular, bo'lmasa (eski yozuv) joriy nuqta og'irliklari. */
function weightsFor(base: Map<string, number>, frozen?: Record<string, number> | null): Map<string, number> {
  if (!frozen) return base;
  const m = new Map(base);
  for (const [id, w] of Object.entries(frozen)) if (w > 0) m.set(id, w);
  return m;
}

function tally(
  answers: Record<string, Answer>,
  weights: Map<string, number>,
  into: ScoreResult,
  staff?: StaffBlock | null,
): ScoreResult {
  for (const [id, a] of Object.entries(answers)) {
    const w = weights.get(id);
    if (w === undefined) continue; // noma'lum nuqta
    const cells = staff?.results[id];
    if (cells) {
      // Hodimli nuqta: ulush (yaxshi / jami) og'irlikka ko'paytiriladi — «7 / 9» va «0 / 9» bir xil emas
      const r = staffRatio(cells);
      if (r === null) {
        into.na += 1;
        continue;
      }
      if (r === 1) into.yes += 1;
      else into.no += 1;
      into.yesWeight += w * r;
      into.noWeight += w * (1 - r);
    } else if (a === 'yes') {
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
export function scoreAnswers(
  answers: Record<string, Answer>,
  checkpoints: Checkpoint[],
  frozen?: Record<string, number> | null,
  staff?: StaffBlock | null,
): ScoreResult {
  return finish(tally(answers, weightsFor(weightMap(checkpoints), frozen), { ...EMPTY_SCORE }, staff));
}

/** Davrdagi barcha tekshiruvlar bo'yicha jamlangan ball. */
export function scoreAudits(audits: AuditRec[], checkpoints: Checkpoint[]): ScoreResult {
  const base = weightMap(checkpoints);
  const acc: ScoreResult = { ...EMPTY_SCORE };
  for (const a of audits) tally(a.answers, weightsFor(base, a.weights), acc, a.staff);
  return finish(acc);
}

/**
 * Bo'lim bali: har cheklist bali alohida hisoblanadi va ularning o'rtachasi olinadi (ma'lumotsizlari
 * hisobga kirmaydi). Shunda kuniga o'nlab muloqot bahosi bitta kunlik smena tekshiruvini «bosib ketmaydi».
 * Faqat bitta cheklist bo'lsa (eski holat) — natija avvalgi `scoreAudits` bilan aynan bir xil.
 */
export function scoreByLists(
  audits: AuditRec[],
  checkpoints: Checkpoint[],
): { pct: number | null; byList: Partial<Record<ListKind, number | null>> } {
  const byList: Partial<Record<ListKind, number | null>> = {};
  const vals: number[] = [];
  for (const list of LIST_ORDER) {
    const of = audits.filter((a) => listOf(a.list) === list);
    if (of.length === 0) continue;
    const pct = scoreAudits(of, checkpoints).pct;
    byList[list] = pct;
    if (pct !== null) vals.push(pct);
  }
  return { pct: vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null, byList };
}

/** Faol jiddiy nuqtada «Yo'q» bo'lsa — tekshiruv jiddiy. Saqlashda server shuni hisoblab yozadi. */
export function auditCritical(answers: Record<string, Answer>, checkpoints: Checkpoint[]): boolean {
  return checkpoints.some((c) => c.active && c.critical && answers[c.id] === 'no');
}
