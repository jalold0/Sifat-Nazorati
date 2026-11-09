/**
 * Eski sozlama guruhlaridan yangi tizim uchun nuqtalarni tanlash.
 * Guruhlardan navbatma-navbat olinadi: har guruhdan birinchisi, keyin ikkinchisi va hokazo,
 * jami `max` tagacha — shunda hamma guruh qoplanadi.
 */

export interface SeedGroup {
  title: string;
  items: string[];
}

export interface SeedCheckpoint {
  id: string;
  text: string;
  group: string;
  weight: number;
  critical: boolean;
  active: boolean;
}

export const MAX_CHECKPOINTS = 8;

export function pickCheckpoints(groups: SeedGroup[], max = MAX_CHECKPOINTS): SeedCheckpoint[] {
  const picked: Array<{ text: string; group: string }> = [];
  const depth = Math.max(0, ...groups.map((g) => g.items.length));
  for (let level = 0; level < depth && picked.length < max; level++) {
    for (const g of groups) {
      const text = g.items[level];
      if (text === undefined) continue;
      if (picked.length >= max) break;
      picked.push({ text: text.trim(), group: g.title });
    }
  }
  return picked.map((p, i) => ({
    id: `cp${i + 1}`,
    text: p.text,
    group: p.group,
    weight: 1,
    critical: false,
    active: true,
  }));
}
