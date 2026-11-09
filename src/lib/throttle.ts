import { createThrottle, type Throttle } from '@/modules/foydalanuvchilar/domain';


/** Kirishdagi muvaffaqiyatsiz urinishlar: login bo'yicha 5 ta / 15 daqiqa, manzil bo'yicha 30 ta / 15 daqiqa. */
const g = globalThis as unknown as { __loginThrottle?: { login: Throttle; ip: Throttle } };

export const loginThrottle =
  g.__loginThrottle ??
  (g.__loginThrottle = {
    login: createThrottle({ max: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 }),
    ip: createThrottle({ max: 30, windowMs: 15 * 60_000, lockMs: 15 * 60_000 }),
  });
