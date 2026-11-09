/**
 * Eski sozlama (seed/config.json) dan 12 bo'lim va ularning nuqtalarini tanlab,
 * prisma/qc-departments.json ni yozadi. Bir marta ishlatiladi; natija git'da saqlanadi.
 *
 * Ishlatish:  pnpm exec tsx scripts/extract-qc-seed.ts "<yo'l>/seed/config.json"
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { pickCheckpoints, type SeedGroup } from '@/modules/bolimlar/domain';


interface OldDept {
  id: string;
  name: string;
  order: number;
  checkpoints?: { groups?: Array<{ t: string; items: string[] }> };
}

const src = process.argv[2];
if (!src) throw new Error('Foydalanish: tsx scripts/extract-qc-seed.ts <config.json>');

const config = JSON.parse(readFileSync(src, 'utf8')) as Record<string, OldDept>;
const depts = Object.values(config)
  .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  .map((d, i) => {
    const groups: SeedGroup[] = (d.checkpoints?.groups ?? []).map((g) => ({ title: g.t, items: g.items }));
    return { slug: d.id, name: d.name, position: i + 1, checkpoints: pickCheckpoints(groups) };
  });

writeFileSync(join(process.cwd(), 'prisma', 'qc-departments.json'), `${JSON.stringify(depts, null, 2)}\n`, 'utf8');
console.log(`${depts.length} bo'lim yozildi`);
for (const d of depts) console.log(`  ${d.position}. ${d.name}: ${d.checkpoints.length} nuqta`);
