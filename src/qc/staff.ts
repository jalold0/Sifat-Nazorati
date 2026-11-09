/**
 * Hodimlar kesimida tekshirish — SOF funksiyalar (docs/spec-hodimlar-kesimida.md).
 *
 * Nuqta turi:
 *   check        — butun bo'lim uchun Ha / Yo'q / Tegishli emas (eski usul);
 *   staff_check  — har hodim uchun Ha / Yo'q (masalan «Smenani topshirdi»);
 *   staff_count  — har hodim uchun «yaxshi» va «yomon» soni (masalan «Sifatli yopdi / Yopa olmadi»).
 *
 * Har hodimli nuqta 0..1 ulush beradi: yaxshi / (yaxshi + yomon). Umumiy javob shundan HOSIL qilinadi
 * (yiqilish yo'q — «Ha», bor — «Yo'q», ma'lumot yo'q — «Tegishli emas»), shuning uchun jiddiy holat,
 * «Yo'q» soni va eng ko'p «Yo'q» olgan nuqtalar o'zgarishsiz ishlaydi.
 */

import type { Answer } from './calc';

export type CheckpointKind = 'check' | 'staff_check' | 'staff_count';
export type StaffVerdict = 'yes' | 'no' | 'na';

/** Bitta hodimning bitta nuqtadagi natijasi. */
export type StaffCell = { v: StaffVerdict; reason?: string } | { ok: number; bad: number; reason?: string };

export interface StaffPerson {
  id: string;
  name: string;
}

/** Tekshiruvdagi hodimlar bloki: kimlar baholangan va har nuqta bo'yicha natijalar. */
export interface StaffBlock {
  people: StaffPerson[];
  /** { nuqtaId: { hodimId: yacheyka } } */
  results: Record<string, Record<string, StaffCell>>;
}

export const KIND_LABEL: Record<CheckpointKind, string> = {
  check: 'Butun bo‘lim: Ha / Yo‘q',
  staff_check: 'Har hodim: Ha / Yo‘q',
  staff_count: 'Har hodim: son (yaxshi / yomon)',
};

export function isStaffKind(kind: CheckpointKind | undefined | null): kind is 'staff_check' | 'staff_count' {
  return kind === 'staff_check' || kind === 'staff_count';
}

/** Nuqtaning «yaxshi» va «yomon» yorliqlari (bo'sh bo'lsa — turga mos standart). */
export function kindLabels(cp: { kind?: CheckpointKind; okLabel?: string | null; badLabel?: string | null }): {
  ok: string;
  bad: string;
} {
  const def = cp.kind === 'staff_count' ? { ok: 'Yaxshi', bad: 'Yomon' } : { ok: 'Ha', bad: 'Yo‘q' };
  return { ok: cp.okLabel?.trim() || def.ok, bad: cp.badLabel?.trim() || def.bad };
}

/** Yacheykani songa aylantiradi: Ha → 1/0, Yo'q → 0/1, Tegishli emas → 0/0, son — o'zi. */
export function cellCounts(cell: StaffCell | undefined): { ok: number; bad: number } {
  if (!cell) return { ok: 0, bad: 0 };
  if ('v' in cell) return cell.v === 'yes' ? { ok: 1, bad: 0 } : cell.v === 'no' ? { ok: 0, bad: 1 } : { ok: 0, bad: 0 };
  return { ok: Math.max(cell.ok, 0), bad: Math.max(cell.bad, 0) };
}

export interface CpTotals {
  ok: number;
  bad: number;
  /** Natijasi bor (ok + bad > 0) hodimlar soni. */
  rated: number;
  /** Kamida bitta «yomon» olgan hodimlar soni. */
  failing: number;
}

export function cpTotals(cells: Record<string, StaffCell> | undefined): CpTotals {
  const t: CpTotals = { ok: 0, bad: 0, rated: 0, failing: 0 };
  for (const cell of Object.values(cells ?? {})) {
    const c = cellCounts(cell);
    t.ok += c.ok;
    t.bad += c.bad;
    if (c.ok + c.bad > 0) t.rated += 1;
    if (c.bad > 0) t.failing += 1;
  }
  return t;
}

/** Nuqta ulushi 0..1; ma'lumot bo'lmasa null. */
export function staffRatio(cells: Record<string, StaffCell> | undefined): number | null {
  const t = cpTotals(cells);
  const total = t.ok + t.bad;
  return total > 0 ? t.ok / total : null;
}

/** Hodimli nuqtaning umumiy (hosil) javobi. */
export function derivedAnswer(cells: Record<string, StaffCell> | undefined): Answer {
  const t = cpTotals(cells);
  if (t.ok + t.bad === 0) return 'na';
  return t.bad > 0 ? 'no' : 'yes';
}

// ── Ko'rsatish uchun xulosa ──────────────────────────────────────────────────

export interface StaffRow {
  id: string;
  name: string;
  ok: number;
  bad: number;
  reason: string;
  /** staff_check uchun asl belgi */
  verdict?: StaffVerdict;
}

export interface CpStaffSummary {
  kind: 'staff_check' | 'staff_count';
  labels: { ok: string; bad: string };
  totals: CpTotals;
  /** 0..100 yoki null */
  pct: number | null;
  /** Bir qatorli o'zbekcha xulosa. */
  sentence: string;
  /** Avval yiqilganlar (ko'p «yomon» tepada), keyin qolganlar — ism tartibida. */
  rows: StaffRow[];
}

const round = (v: number) => Math.round(v * 10) / 10;
export const fmtPct = (v: number | null) => (v === null ? '—' : `${round(v)}%`.replace('.', ','));

/** Bitta tekshiruvdagi bitta hodimli nuqta bo'yicha xulosa. */
export function cpStaffSummary(
  cp: { kind?: CheckpointKind; okLabel?: string | null; badLabel?: string | null },
  block: StaffBlock | null | undefined,
  cpId: string,
): CpStaffSummary | null {
  if (!isStaffKind(cp.kind) || !block) return null;
  const cells = block.results[cpId];
  if (!cells) return null;
  const labels = kindLabels(cp);
  const totals = cpTotals(cells);
  const total = totals.ok + totals.bad;
  const pct = total > 0 ? (totals.ok / total) * 100 : null;
  const names = new Map(block.people.map((p) => [p.id, p.name]));
  const rows: StaffRow[] = Object.entries(cells)
    .map(([id, cell]) => {
      const c = cellCounts(cell);
      return {
        id,
        name: names.get(id) ?? '—',
        ok: c.ok,
        bad: c.bad,
        reason: cell.reason ?? '',
        ...('v' in cell ? { verdict: cell.v } : {}),
      };
    })
    .sort((a, b) => b.bad - a.bad || a.name.localeCompare(b.name));

  let sentence: string;
  if (total === 0) sentence = 'Ma’lumot yo‘q (hammasi «tegishli emas»)';
  else if (cp.kind === 'staff_check') {
    sentence = `${labels.ok}: ${totals.ok} / ${totals.rated} hodim (${fmtPct(pct)})`;
    if (totals.bad > 0) sentence += ` · ${labels.bad}: ${totals.bad}`;
  } else {
    sentence = `Jami ${total}: ${labels.ok} ${totals.ok}, ${labels.bad} ${totals.bad} (${fmtPct(pct)})`;
    if (totals.failing > 0) sentence += ` · ${totals.failing} / ${totals.rated} hodimda`;
  }
  return { kind: cp.kind, labels, totals, pct, sentence, rows };
}

// ── Davr bo'yicha hodimlar kesimi ────────────────────────────────────────────

export interface StaffBreakdownRow {
  id: string;
  /** Eng oxirgi tekshiruvdagi ism */
  name: string;
  /** Shu hodim baholangan tekshiruvlar soni */
  audits: number;
  ok: number;
  bad: number;
  /** 0..100 yoki null */
  pct: number | null;
  /** Nuqta bo'yicha: { nuqtaId: { ok, bad } } */
  byCp: Record<string, { ok: number; bad: number }>;
}

/**
 * Davrdagi tekshiruvlar bo'yicha har hodim natijasi. Eng zaif (ulushi past) hodimlar tepada;
 * ma'lumotsizlar oxirida.
 */
export function staffBreakdown(
  audits: Array<{ date: string; staff?: StaffBlock | null }>,
  checkpoints: Array<{ id: string; kind?: CheckpointKind }>,
): StaffBreakdownRow[] {
  const staffCps = new Set(checkpoints.filter((c) => isStaffKind(c.kind)).map((c) => c.id));
  const rows = new Map<string, StaffBreakdownRow & { lastDate: string }>();
  for (const a of audits) {
    if (!a.staff) continue;
    const seen = new Set<string>();
    for (const [cpId, cells] of Object.entries(a.staff.results)) {
      if (!staffCps.has(cpId)) continue;
      for (const [personId, cell] of Object.entries(cells)) {
        const c = cellCounts(cell);
        if (c.ok + c.bad === 0) continue;
        const person = a.staff.people.find((p) => p.id === personId);
        let row = rows.get(personId);
        if (!row) {
          row = { id: personId, name: person?.name ?? '—', audits: 0, ok: 0, bad: 0, pct: null, byCp: {}, lastDate: a.date };
          rows.set(personId, row);
        }
        if (person && a.date >= row.lastDate) {
          row.name = person.name;
          row.lastDate = a.date;
        }
        row.ok += c.ok;
        row.bad += c.bad;
        const cp = (row.byCp[cpId] ??= { ok: 0, bad: 0 });
        cp.ok += c.ok;
        cp.bad += c.bad;
        seen.add(personId);
      }
    }
    for (const id of seen) rows.get(id)!.audits += 1;
  }
  return [...rows.values()]
    .map(({ lastDate: _lastDate, ...r }) => ({ ...r, pct: r.ok + r.bad > 0 ? (r.ok / (r.ok + r.bad)) * 100 : null }))
    .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || b.bad - a.bad || a.name.localeCompare(b.name));
}
