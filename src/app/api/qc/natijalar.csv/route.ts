import { NextResponse, type NextRequest } from 'next/server';

import { getActor } from '@/modules/foydalanuvchilar/ui';
import { dateTime } from '@/lib/format';
import { listProgress } from '@/server/training';

import { toCsv } from '@/shared/csv';

export const dynamic = 'force-dynamic';

const STATUS = { passed: 'o‘tdi', failed: 'o‘tmadi', none: 'boshlamagan' } as const;

/** O'quv natijalari CSV (faqat rahbar). Filtr natijalar sahifasi bilan bir xil: d, s. */
export async function GET(request: NextRequest) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: 'Kirish talab qilinadi. Tizimga qayta kiring.' }, { status: 401 });
  const res = await listProgress(actor);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  const d = request.nextUrl.searchParams.get('d');
  const s = request.nextUrl.searchParams.get('s');
  const rows = res.data.filter((r) => (!d || r.deptId === d) && (!s || r.status === s));

  const body = toCsv(
    ['Xodim', 'Bo‘lim', 'Bajarilgan topshiriq', 'Jami topshiriq', 'Oxirgi test, %', 'Eng yaxshi test, %', 'Holat', 'Oxirgi urinish', 'Urinishlar soni'],
    rows.map((r) => [
      r.userName,
      r.deptName ?? '',
      r.deptId ? r.done : '',
      r.deptId ? r.total : '',
      r.lastPct ?? '',
      r.bestPct ?? '',
      STATUS[r.status],
      r.lastAt ? dateTime(r.lastAt) : '',
      r.attempts.length,
    ]),
  );
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="oquv-natijalari.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
