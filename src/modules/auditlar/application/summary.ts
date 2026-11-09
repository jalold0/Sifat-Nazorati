import { canReadDept } from '@/modules/foydalanuvchilar/domain';
import type { Actor } from '@/shared/actor';
import { bad, forbidden, ok, type Res } from '@/shared/result';
import { isYmd, todayTashkent } from '@/shared/time';

import type { SummaryData } from '../domain';

import type { AuditDeps } from './ports';

/**
 * Hisoblash uchun xom yozuvlar (bir juft so'rovda): `from` dan `to` gacha tekshiruvlar va
 * hisoblashga kerak topshiriqlar (muddati `from` dan keyin yoki hali ochiq bo'lganlar).
 */
export async function getSummaryData(
  deps: AuditDeps,
  actor: Actor,
  q: { dept?: string; from: string; to: string },
): Promise<Res<SummaryData>> {
  if (!isYmd(q.from) || !isYmd(q.to) || q.from > q.to) {
    return bad('Davr noto‘g‘ri: boshlanish sanasi oxirgisidan keyin bo‘lmasligi kerak.');
  }
  if (q.dept && !canReadDept(actor, q.dept)) return forbidden('Bu bo‘limni ko‘rishga ruxsatingiz yo‘q.');

  const departments = (await deps.departments.list(actor, {})).filter((d) => !q.dept || d.id === q.dept);
  const ids = departments.map((d) => d.id);
  const [audits, tasks] = await Promise.all([deps.audits().inRange(ids, q.from, q.to), deps.tasks().forSummary(ids, q.from)]);
  return ok({ today: todayTashkent(deps.now()), departments, audits, tasks });
}
