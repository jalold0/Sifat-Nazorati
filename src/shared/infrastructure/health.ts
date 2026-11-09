/**
 * Tizim holati: ilova tirik va baza javob beryaptimi. `/api/health` shuni chaqiradi
 * (monitoring, NSSM/pm2 tekshiruvi, ofis serveridagi "ishlayaptimi?" so'rovi uchun).
 */

import { prisma } from './prisma';

export interface HealthReport {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  /** Bazaga so'rov vaqti, millisekund. */
  dbMs: number | null;
  uptimeSec: number;
  time: string;
}

export async function checkHealth(): Promise<HealthReport> {
  const started = Date.now();
  let db: HealthReport['db'] = 'down';
  let dbMs: number | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = 'up';
    dbMs = Date.now() - started;
  } catch {
    // Batafsil sabab jurnalga chaqiruvchi tomonda yoziladi; foydalanuvchiga ichki tafsilot ko'rsatilmaydi
  }
  return {
    status: db === 'up' ? 'ok' : 'degraded',
    db,
    dbMs,
    uptimeSec: Math.round(process.uptime()),
    time: new Date().toISOString(),
  };
}
