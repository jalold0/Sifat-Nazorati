'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Sahifani yangilamasdan yangi ma'lumot ko'rinishi uchun: ko'rinib turgan oynada har `seconds` soniyada
 * serverdan qayta o'qiydi (faqat shu sahifaning server qismi; kiritilgan shakllarga tegmaydi).
 */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const timer = setInterval(tick, seconds * 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [router, seconds]);
  return null;
}
