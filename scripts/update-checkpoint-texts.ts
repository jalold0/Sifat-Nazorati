/**
 * Bazadagi boshlang'ich nuqtalar matnini prisma/qc-departments.json dagi yangi («Ha — yaxshi» savol)
 * matnlar bilan almashtiradi. XAVFSIZ qoidalar:
 *   - faqat me'yori hali tasdiqlanmagan («taxminiy») bo'limlarga tegadi;
 *   - tekshiruvi bor bo'limga TEGMAYDI (eski tekshiruvlar ma'nosi o'zgarib ketmasin);
 *   - faqat matn o'zgaradi (og'irlik, jiddiy belgisi, tartib saqlanadi).
 * Standart — quruq yurish (hech narsa yozilmaydi); yozish uchun `--apply`.
 *
 * Ishlatish:  pnpm exec tsx scripts/update-checkpoint-texts.ts [--apply]
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';

const apply = process.argv.includes('--apply');
const db = new PrismaClient();

interface Seed {
  name: string;
  checkpoints: Array<{ id: string; text: string }>;
}

async function main() {
  const seeds = JSON.parse(readFileSync(join(process.cwd(), 'prisma', 'qc-departments.json'), 'utf8')) as Seed[];
  console.log(apply ? 'YOZISH rejimi' : 'Quruq yurish (yozish uchun --apply)');
  for (const s of seeds) {
    const dept = await db.qcDepartment.findFirst({
      where: { name: s.name },
      include: { checkpoints: true, _count: { select: { audits: true } } },
    });
    if (!dept) {
      console.log(`- ${s.name}: bazada yo'q`);
      continue;
    }
    if (!dept.estimate) {
      console.log(`- ${s.name}: me'yori tasdiqlangan — tegilmadi`);
      continue;
    }
    if (dept._count.audits > 0) {
      console.log(`- ${s.name}: ${dept._count.audits} ta tekshiruvi bor — tegilmadi`);
      continue;
    }
    const changes = s.checkpoints.filter((c) => dept.checkpoints.some((x) => x.id === c.id && x.text !== c.text));
    console.log(`- ${s.name}: ${changes.length} ta nuqta matni almashadi`);
    if (!apply) continue;
    for (const c of changes) {
      await db.qcCheckpoint.update({ where: { deptId_id: { deptId: dept.id, id: c.id } }, data: { text: c.text } });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
