/**
 * Server testlarini (src/server/qc.integration.test.ts) lokal PostgreSQL'dagi alohida «otk_test»
 * bazasida ishga tushiradi. Avval `pnpm db:local` ishlab turishi kerak.
 * .env dagi (masalan Neon) bazaga TEGILMAYDI.
 */
import { spawnSync } from 'node:child_process';

import { PrismaClient } from '@prisma/client';

const base = process.env.QC_TEST_BASE_URL ?? 'postgresql://otk:otk@localhost:5433';

const admin = new PrismaClient({ datasources: { db: { url: `${base}/postgres` } } });
const rows = await admin.$queryRawUnsafe("SELECT 1 AS x FROM pg_database WHERE datname = 'otk_test'");
if (rows.length === 0) {
  await admin.$executeRawUnsafe(
    "CREATE DATABASE otk_test WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0",
  );
}
await admin.$disconnect();

const url = `${base}/otk_test`;
const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, QC_TEST_DATABASE_URL: url };
const run = (args) => spawnSync('pnpm', args, { stdio: 'inherit', env, shell: true });

let r = run(['exec', 'prisma', 'migrate', 'deploy']);
if (r.status !== 0) process.exit(r.status ?? 1);
r = run(['exec', 'vitest', 'run', 'src/server', '--no-file-parallelism']);
process.exit(r.status ?? 1);
