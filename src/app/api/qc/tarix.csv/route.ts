import { NextResponse, type NextRequest } from 'next/server';

import { getActor } from '@/modules/foydalanuvchilar/ui';
import { listDepartments } from '@/modules/bolimlar';
import { listAudits } from '@/modules/auditlar';

import { canExport } from '@/modules/foydalanuvchilar/domain';
import { toCsv } from '@/shared/csv';

export const dynamic = 'force-dynamic';

const json = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Tekshiruvlar tarixi CSV (rahbar va tekshiruvchi). Filtr tarix sahifasi bilan bir xil: from, to, d. */
export async function GET(request: NextRequest) {
  const actor = await getActor();
  if (!actor) return json('Kirish talab qilinadi. Tizimga qayta kiring.', 401);
  if (!canExport(actor)) return json('CSV yuklash huquqingiz yo‘q.', 403);

  const sp = request.nextUrl.searchParams;
  const res = await listAudits(actor, {
    dept: sp.get('d') || undefined,
    from: sp.get('from') || undefined,
    to: sp.get('to') || undefined,
    limit: 50_000,
  });
  if (!res.ok) return json(res.error, res.status);

  const names = new Map((await listDepartments(actor, { includeInactive: true })).map((d) => [d.id, d.name]));
  const body = toCsv(
    ['Sana', 'Bo‘lim', 'Ball, %', 'Tekshiruvchi', 'Yo‘q soni', 'Jiddiy', 'Kim / nima tekshirildi'],
    res.data.rows.map((a) => [
      a.date,
      names.get(a.dept) ?? '',
      a.scorePct === null ? '' : Math.round(a.scorePct * 10) / 10,
      a.byName,
      a.noCount,
      a.critical ? 'ha' : '',
      a.subject,
    ]),
  );
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tekshiruvlar.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
