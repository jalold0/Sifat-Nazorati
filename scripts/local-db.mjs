/**
 * Lokal PostgreSQL — Docker o'rnatilmagan mashinada rivojlantirish uchun.
 * Ishga tushirish:  node scripts/local-db.mjs
 * To'xtatish:       Ctrl+C
 *
 * Ma'lumotlar .local-db/ papkasida saqlanadi (git'ga kirmaydi).
 * PRODUCTION'da bu ishlatilmaydi — .env dagi Neon URL'i ishlatiladi.
 */

import EmbeddedPostgres from 'embedded-postgres';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), '.local-db');
const PORT = 5433;
const USER = 'otk';
const PASSWORD = 'otk';
const DATABASE = 'otk_crm';

mkdirSync(DIR, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
});

const url = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}`;

try {
  await pg.initialise();
  console.log('klaster yaratildi');
} catch {
  console.log('mavjud klaster ishlatiladi');
}

await pg.start();
console.log('postgres ishga tushdi');

// Bazani ATAYIN UTF8 kodlashida yaratamiz.
// Windows'da initdb standart locale'ni (WIN1251) oladi — unda "≥" va "—" kabi
// belgilar saqlanmaydi, KPI maqsad matnlari buziladi.
const client = pg.getPgClient('postgres');
await client.connect();
try {
  const { rows } = await client.query(
    'SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = $1',
    [DATABASE],
  );

  if (rows.length === 0) {
    await client.query(
      `CREATE DATABASE ${DATABASE} WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`,
    );
    console.log(`"${DATABASE}" bazasi yaratildi (UTF8)`);
  } else if (rows[0].enc !== 'UTF8') {
    console.log(`"${DATABASE}" ${rows[0].enc} kodlashida edi — UTF8 ga qayta yaratilmoqda`);
    await client.query(`DROP DATABASE ${DATABASE}`);
    await client.query(
      `CREATE DATABASE ${DATABASE} WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`,
    );
    console.log(`"${DATABASE}" bazasi UTF8 da qayta yaratildi`);
  } else {
    console.log(`"${DATABASE}" bazasi mavjud (UTF8)`);
  }
} finally {
  await client.end();
}

console.log(`\nDATABASE_URL="${url}"\n`);
console.log('To\'xtatish uchun Ctrl+C');

const shutdown = async () => {
  console.log('\ntoxtatilmoqda…');
  await pg.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Jarayonni tirik ushlab turish
setInterval(() => {}, 1 << 30);
