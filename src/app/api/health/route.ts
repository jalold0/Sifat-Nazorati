/**
 * GET /api/health — kirishsiz (middleware matcher'da istisno). Baza ishlasa 200, bo'lmasa 503.
 * Kompozitsiya ildizi: shu fayl infratuzilmaga to'g'ridan-to'g'ri ulanadi (arxitektura testida istisno).
 */

import { NextResponse } from 'next/server';

import { checkHealth } from '@/shared/infrastructure/health';
import { logger } from '@/shared/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const report = await checkHealth();
  if (report.status !== 'ok') logger.error('health.degraded', { db: report.db });
  return NextResponse.json(report, { status: report.status === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
