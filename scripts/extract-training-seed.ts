/**
 * Eski sozlama (seed/config.json) dan 12 bo'limning o'quv dasturini (title, intro, days, quiz)
 * prisma/training/base.json ga ko'chiradi. Bir marta ishlatiladi; natija git'da saqlanadi.
 * O'quv matni yangidan yozilmaydi — o'zgarishsiz ko'chiriladi.
 *
 * Ishlatish:  pnpm exec tsx scripts/extract-training-seed.ts "<yo'l>/seed/config.json"
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { OldTraining } from '@/modules/oquv/domain';


const src = process.argv[2];
if (!src) throw new Error('Foydalanish: tsx scripts/extract-training-seed.ts <config.json>');

const config = JSON.parse(readFileSync(src, 'utf8')) as Record<string, { training?: OldTraining }>;
const out: Record<string, OldTraining> = {};
for (const [slug, dept] of Object.entries(config)) {
  const t = dept.training;
  if (!t) continue;
  out[slug] = { title: t.title, intro: t.intro ?? '', pass: t.pass, days: t.days, quiz: t.quiz };
}

writeFileSync(join(process.cwd(), 'prisma', 'training', 'base.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log(`${Object.keys(out).length} bo'lim dasturi yozildi`);
