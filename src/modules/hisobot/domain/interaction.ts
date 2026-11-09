/**
 * Muloqot bahosi: operatorlar kesimi — SOF.
 */

import { type AuditRec, scoreAnswers } from '@/modules/auditlar/domain';
import type { Checkpoint } from '@/modules/bolimlar/domain';
import { listOf } from '@/shared/lists';

export interface InteractionRow {
  staffId: string;
  name: string;
  /** Baholangan muloqotlar soni */
  count: number;
  /** Muloqot ballari o'rtachasi, 0..100 yoki null */
  avgPct: number | null;
  /** Jiddiy holatli muloqotlar soni */
  critical: number;
  /** Eng ko'p «Yo'q» olgan mezonlar (ko'pi bilan 3 ta) */
  weakest: Array<{ id: string; text: string; no: number }>;
  /** Kanal bo'yicha soni */
  channels: Record<string, number>;
}

/**
 * Davrdagi muloqot baholari (list = 'interaction') bo'yicha har operator natijasi.
 * Eng past o'rtacha ball tepada. `names` — hodim id → ism (bo'lim ro'yxatidan).
 */
export function interactionBreakdown(
  audits: AuditRec[],
  checkpoints: Checkpoint[],
  names: Map<string, string>,
): InteractionRow[] {
  const text = new Map(checkpoints.map((c) => [c.id, c.text]));
  const rows = new Map<string, { scores: number[]; critical: number; no: Map<string, number>; channels: Record<string, number> }>();
  for (const a of audits) {
    if (listOf(a.list) !== 'interaction' || !a.staffId) continue;
    let r = rows.get(a.staffId);
    if (!r) {
      r = { scores: [], critical: 0, no: new Map(), channels: {} };
      rows.set(a.staffId, r);
    }
    const pct = scoreAnswers(a.answers, checkpoints, a.weights).pct;
    if (pct !== null) r.scores.push(a.critical ? 0 : pct); // jiddiy holat — muloqot bali 0
    if (a.critical) r.critical += 1;
    for (const [id, ans] of Object.entries(a.answers)) if (ans === 'no') r.no.set(id, (r.no.get(id) ?? 0) + 1);
    const ch = a.channel ?? 'phone';
    r.channels[ch] = (r.channels[ch] ?? 0) + 1;
  }
  return [...rows.entries()]
    .map(([staffId, r]) => ({
      staffId,
      name: names.get(staffId) ?? '—',
      count: r.scores.length || Object.values(r.channels).reduce((s, n) => s + n, 0),
      avgPct: r.scores.length > 0 ? r.scores.reduce((s, v) => s + v, 0) / r.scores.length : null,
      critical: r.critical,
      weakest: [...r.no.entries()]
        .sort((x, y) => y[1] - x[1])
        .slice(0, 3)
        .map(([id, no]) => ({ id, text: text.get(id) ?? id, no })),
      channels: r.channels,
    }))
    .sort((x, y) => (x.avgPct ?? 101) - (y.avgPct ?? 101) || y.critical - x.critical || x.name.localeCompare(y.name));
}
