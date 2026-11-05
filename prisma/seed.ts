/**
 * Seed — xodimlar va 12 bo'lim (har birida 5–8 nuqta).
 *
 * Ishlatish:  pnpm db:seed
 * Xavfsiz qayta ishga tushiriladi: mavjud bo'lim va nuqtalarga TEGILMAYDI (rahbar tahrir qilgan
 * bo'lishi mumkin), faqat yo'q bo'limlar qo'shiladi. Mavjud xodimning paroli o'zgartirilmaydi.
 *
 * SEED_DEMO=1 — sinash uchun «Call center» ko'ruvchisini ham yaratadi.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient, type Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { buildTrainingDoc, validateKeys, type KeysFile, type OldTraining } from '../src/qc/training-seed';

const db = new PrismaClient();

interface SeedUser {
  key: string;
  fullName: string;
  shortName: string;
  login: string;
  role: Role;
  position: string;
}

const USERS: SeedUser[] = [
  { key: 'ceo', fullName: 'Rahbariyat', shortName: 'Rahbariyat', login: 'ceo', role: 'HEAD', position: 'Bosh direktor' },
  {
    key: 'head',
    fullName: 'Mirzakbarov Jaloldin',
    shortName: 'Jaloldin M.',
    login: 'jaloldin',
    role: 'HEAD',
    position: "Sifat nazorati boshlig'i",
  },
  {
    key: 'ulugbek',
    fullName: "Muqimjonov Ulug'bek",
    shortName: "Ulug'bek M.",
    login: 'ulugbek',
    role: 'INSPECTOR',
    position: 'Sifat nazorati tekshiruvchisi',
  },
  {
    key: 'jasur',
    fullName: 'Bafoev Jasur',
    shortName: 'Jasur B.',
    login: 'jasur',
    role: 'INSPECTOR',
    position: 'Sifat nazorati tekshiruvchisi',
  },
  {
    key: 'saidali',
    fullName: 'Shadiyev Saidali',
    shortName: 'Saidali Sh.',
    login: 'saidali',
    role: 'INSPECTOR',
    position: 'Sifat nazorati tekshiruvchisi',
  },
];

interface DeptSeed {
  slug: string;
  name: string;
  position: number;
  checkpoints: Array<{ id: string; text: string; group: string; weight: number; critical: boolean; active: boolean }>;
}

async function main() {
  console.log('iPOST OTK — seed boshlandi');
  const password = process.env.SEED_DEFAULT_PASSWORD ?? 'Otk2026!';
  const passwordHash = await bcrypt.hash(password, 12);

  for (const u of USERS) {
    await db.user.upsert({
      where: { key: u.key },
      create: { ...u, passwordHash },
      update: { fullName: u.fullName, shortName: u.shortName, role: u.role },
    });
  }
  console.log(`  ✔ ${USERS.length} xodim`);

  const depts = JSON.parse(readFileSync(join(process.cwd(), 'prisma', 'qc-departments.json'), 'utf8')) as DeptSeed[];
  let added = 0;
  for (const d of depts) {
    const exists = await db.qcDepartment.findFirst({ where: { name: d.name }, select: { id: true } });
    if (exists) continue;
    await db.qcDepartment.create({
      data: {
        name: d.name,
        position: d.position,
        norm: 90,
        estimate: true,
        active: true,
        checkpoints: {
          create: d.checkpoints.map((c, i) => ({
            id: c.id,
            text: c.text,
            grp: c.group,
            weight: c.weight,
            critical: c.critical,
            active: c.active,
            position: i + 1,
          })),
        },
      },
    });
    added++;
  }
  console.log(`  ✔ bo'limlar: ${added} ta qo'shildi, ${depts.length - added} ta mavjud (tegilmadi)`);

  // O'quv dasturi va test: eski sozlamadan ko'chirilgan; bo'limda keys-fayl bo'lsa test shundan.
  // Bo'limda dastur allaqachon bor bo'lsa TEGILMAYDI (rahbar tahrir qilgan bo'lishi mumkin).
  const base = JSON.parse(readFileSync(join(process.cwd(), 'prisma', 'training', 'base.json'), 'utf8')) as Record<string, OldTraining>;
  let trainingAdded = 0;
  let fromKeys = 0;
  for (const d of depts) {
    const dept = await db.qcDepartment.findFirst({ where: { name: d.name }, select: { id: true, training: { select: { deptId: true } } } });
    if (!dept || dept.training) continue;
    const old = base[d.slug];
    if (!old) {
      console.warn(`  ! ${d.name}: eski o'quv dasturi topilmadi (${d.slug})`);
      continue;
    }
    const keysPath = join(process.cwd(), 'prisma', 'training', `oquv_${d.slug}_keys.json`);
    let keys: KeysFile | null = null;
    if (existsSync(keysPath)) {
      keys = JSON.parse(readFileSync(keysPath, 'utf8')) as KeysFile;
      const problem = validateKeys(keys, `oquv_${d.slug}_keys.json`);
      if (problem) throw new Error(problem);
    }
    const doc = buildTrainingDoc(old, keys);
    await db.qcTraining.create({
      data: {
        deptId: dept.id,
        title: doc.title,
        intro: doc.intro,
        passPct: doc.passPct,
        days: doc.days as unknown as object,
        questions: doc.questions as unknown as object,
      },
    });
    trainingAdded++;
    if (doc.source === 'keys') fromKeys++;
  }
  console.log(`  ✔ o'quv dasturi: ${trainingAdded} ta qo'shildi (${fromKeys} tasida keys-test), qolganlariga tegilmadi`);

  if (process.env.SEED_DEMO === '1') {
    const cc = await db.qcDepartment.findFirst({ where: { name: 'Call center' }, select: { id: true } });
    await db.user.upsert({
      where: { key: 'demo-viewer' },
      create: {
        key: 'demo-viewer',
        fullName: "Call center ko'ruvchisi",
        shortName: 'Call center',
        login: 'callcenter',
        role: 'VIEWER',
        position: "Call center bo'limi",
        deptId: cc?.id ?? null,
        passwordHash,
      },
      update: { deptId: cc?.id ?? null },
    });
    console.log("  ✔ demo ko'ruvchi: callcenter");
  }

  console.log(`Tayyor. Boshlang'ich parol: SEED_DEFAULT_PASSWORD (hozirgi qiymat .env da)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
