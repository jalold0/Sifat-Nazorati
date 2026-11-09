/**
 * Tuzilmali (JSON) jurnal: har yozuv — bitta qator, `stdout`/`stderr` ga. NSSM/pm2 shu oqimni faylga yozadi.
 *
 *   logger.info('auth.login', { login: 'aziz', ok: true });
 *   → {"time":"2026-11-09T18:00:00.000Z","level":"info","msg":"auth.login","login":"aziz","ok":true}
 *
 * Parol, token va boshqa sirlarni HECH QACHON maydonlarga qo'ymang.
 * Bu ish jurnali (operatsion). Biznes o'zgarishlar tarixi — `jurnal` moduli (QcLog jadvali).
 */

type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

const RANK: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  // `env()` ga bog'lanmaymiz: logger server ishga tushmasdan oldin ham ishlashi kerak
  const raw = process.env.LOG_LEVEL;
  return raw && raw in RANK ? RANK[raw as Level] : RANK.info;
}

/** Error obyektini JSON'ga mos ko'rinishga keltiradi. */
export function errorFields(err: unknown): Fields {
  if (err instanceof Error) return { error: err.message, stack: err.stack };
  return { error: String(err) };
}

function write(level: Level, msg: string, bound: Fields, fields?: Fields): void {
  if (RANK[level] < threshold()) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...bound, ...fields });
  (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(`${line}\n`);
}

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  /** Har yozuvga qo'shiladigan maydonlar bilan yangi logger (masalan, so'rov identifikatori). */
  child(bound: Fields): Logger;
}

function make(bound: Fields): Logger {
  return {
    debug: (msg, fields) => write('debug', msg, bound, fields),
    info: (msg, fields) => write('info', msg, bound, fields),
    warn: (msg, fields) => write('warn', msg, bound, fields),
    error: (msg, fields) => write('error', msg, bound, fields),
    child: (more) => make({ ...bound, ...more }),
  };
}

export const logger: Logger = make({});
