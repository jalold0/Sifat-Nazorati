/**
 * Next.js server ishga tushganda bir marta chaqiriladi.
 * - Noto'g'ri `.env` bo'lsa darhol, tushunarli xabar bilan to'xtaydi (birinchi so'rovni kutmasdan).
 * - Ushlanmagan server xatolari tuzilmali jurnalga yoziladi.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { assertEnv } = await import('@/shared/env');
  const { logger } = await import('@/shared/logger');
  try {
    assertEnv();
  } catch (err) {
    logger.error('startup.env_invalid', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
  logger.info('startup.ok', { node: process.version });
}

export async function onRequestError(err: unknown, request: { path: string; method: string }) {
  const { logger, errorFields } = await import('@/shared/logger');
  logger.error('request.error', { path: request.path, method: request.method, ...errorFields(err) });
}
