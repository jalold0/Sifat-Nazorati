/**
 * Mijoz IP manzili — SOF funksiya (login cheklovi uchun).
 *
 * `X-Forwarded-For` ni mijozning o'zi yuborishi mumkin, shuning uchun uning CHAP qismiga ishonib bo'lmaydi.
 * Har ishonchli proxy (nginx, IIS ARR, Caddy) o'zi ko'rgan manzilni ro'yxat OXIRIGA qo'shadi; demak `hops` ta
 * ishonchli proxy bo'lsa, haqiqiy mijoz — o'ngdan `hops`-inchi yozuv. Undan chapdagilar soxta bo'lishi mumkin.
 *
 * `hops = 0` (proxysiz): Next.js sarlavha bo'lmasa uni soket manzili bilan to'ldiradi, lekin mijoz yuborgan
 * sarlavhani o'zgartirmaydi — bu holda manzil ishonchsiz. Shunda `null` qaytadi va IP bo'yicha cheklov
 * ishlatilmaydi (login bo'yicha cheklov — asosiy himoya — ishlayveradi).
 */
export function clientIp(forwardedFor: string | null, hops: number): string | null {
  if (!Number.isInteger(hops) || hops < 1 || !forwardedFor) return null;
  const list = forwardedFor
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const ip = list[list.length - hops];
  return ip && /^[0-9a-fA-F.:]{2,45}$/.test(ip) ? ip : null;
}

/** `TRUSTED_PROXY_HOPS` muhit o'zgaruvchisi: ilova oldidagi ishonchli proxylar soni (bo'lmasa 0). */
export function trustedHops(value: string | undefined): number {
  const n = Number(value ?? 0);
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 0;
}
