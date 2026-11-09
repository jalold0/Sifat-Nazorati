import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE, verifySession } from '@/lib/session';

import { canOpenPath } from '@/modules/foydalanuvchilar/domain';

const PUBLIC_PATHS = ['/login', '/ruxsat-yoq'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    // Kirgan foydalanuvchini /login dan yo'naltirish sahifaning o'zida (sessiya versiyasi bazada tekshiriladi);
    // bu yerda JWT ga qarab qilinsa, bekor qilingan sessiya /login ↔ / orasida aylanib qoladi.
    return NextResponse.next();
  }

  if (!session) {
    // API: yo'naltirish emas, 401 va o'zbekcha xato
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Kirish talab qilinadi. Tizimga qayta kiring.' }, { status: 401 });
    }
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('keyin', pathname);
    return NextResponse.redirect(url);
  }

  // Parolni almashtirish majburiy: boshqa sahifalar o'rniga /profil (asl tekshiruv serverda ham bor)
  if (session.mc && !pathname.startsWith('/profil') && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(new URL('/profil', request.url));
  }

  // Rolga ruxsat etilmagan ekran: qo'lda manzil yozib ham ochib bo'lmaydi (asl tekshiruv serverda ham bor)
  if (!canOpenPath(session.role, pathname)) {
    return NextResponse.redirect(new URL('/ruxsat-yoq', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};
