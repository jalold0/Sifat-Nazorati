/**
 * Davr KPI faktlarini reyestrdan qayta hisoblash.
 *
 *   pnpm recalc            — o'tgan va joriy oy
 *   pnpm recalc 2026-06    — aniq davr
 *
 * Odatda avtomatik ishlaydi (murojaat/audit saqlanganda), bu skript
 * metrika mantig'i o'zgargandan keyin tarixni yangilash uchun kerak.
 */

import { periodOf, shiftPeriod } from '../src/lib/period';
import { recalculatePeriod } from '../src/server/kpi-core';

async function main() {
  const periods = process.argv[2] ? [process.argv[2]] : [shiftPeriod(periodOf(), -1), periodOf()];
  for (const period of periods) {
    const count = await recalculatePeriod(period, null);
    console.log(`${period} → ${count} ko'rsatkich qayta hisoblandi`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
