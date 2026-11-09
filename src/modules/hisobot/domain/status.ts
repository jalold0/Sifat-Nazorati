/**
 * Svetofor: ko'rsatkich holati va rang qoidalari.
 */

export type Status = 'green' | 'yellow' | 'red' | 'gray';

/** Foizli ko'rsatkichda sariq zona kengligi (foiz punkti). */
export const YELLOW_BAND = 10;

// ── Svetofor ─────────────────────────────────────────────────────────────────

/** Foizli ko'rsatkich (≥ me'yor yaxshi). */
export function trafficPct(value: number | null, norm: number): Status {
  if (value === null) return 'gray';
  const v = Math.round(value * 1e6) / 1e6;
  if (v >= norm) return 'green';
  if (norm - v <= YELLOW_BAND) return 'yellow';
  return 'red';
}

/** Sonli ko'rsatkich (≤ 0 yaxshi): 0 yashil, 1 sariq, 2+ qizil. */
export function trafficCount(value: number | null): Status {
  if (value === null) return 'gray';
  if (value <= 0) return 'green';
  return value === 1 ? 'yellow' : 'red';
}

const SEVERITY: Record<Status, number> = { gray: -1, green: 0, yellow: 1, red: 2 };

export function worst(statuses: Status[]): Status {
  let result: Status = 'gray';
  for (const s of statuses) if (SEVERITY[s] > SEVERITY[result]) result = s;
  return result;
}

/** Panelda tartib: qizillar yuqorida, kulranglar pastda. */
export const STATUS_RANK: Record<Status, number> = { red: 0, yellow: 1, green: 2, gray: 3 };
