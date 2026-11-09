/**
 * Arxitektura testi: modulli monolit qoidalarini avtomatik tekshiradi (docs/ARXITEKTURA.md).
 * Har `import` kimdan kimga ekanini aniqlaydi va qoidaga zid bo'lsa — nima buzilganini aytib, yiqiladi.
 *
 * Qatlamlar (modul ichida):   ui → application → domain;   infrastructure → application + domain.
 * Modullar o'rtasida:         faqat ochiq kirish nuqtalari (index, domain, ui, edge) va e'lon qilingan bog'liqlik grafi.
 * Prisma:                     faqat infrastructure (modul va shared) bilishi mumkin.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname);

/**
 * Modullar bog'liqlik grafi (kim kimdan foydalanishi mumkin). Yangi bog'liqlik kerak bo'lsa — avval shu yerda
 * va docs/ARXITEKTURA.md da ongli ravishda e'lon qiling. Aylana (sikl) bo'lishi mumkin emas.
 */
const ALLOWED_MODULE_DEPS: Record<string, string[]> = {
  foydalanuvchilar: [],
  jurnal: ['foydalanuvchilar'],
  bolimlar: ['foydalanuvchilar'],
  auditlar: ['foydalanuvchilar', 'bolimlar'],
  oquv: ['foydalanuvchilar', 'bolimlar'],
  hisobot: ['foydalanuvchilar', 'bolimlar', 'auditlar'],
};

type Layer = 'domain' | 'application' | 'infrastructure' | 'ui' | 'index' | 'edge' | 'other';
type Area = 'module' | 'shared' | 'sharedInfra' | 'sharedUi' | 'app' | 'integration' | 'other';

interface Loc {
  area: Area;
  module?: string;
  layer?: Layer;
  /** src/ ga nisbatan, '/' bilan, kengaytmasiz */
  path: string;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

const rel = (abs: string) => relative(SRC, abs).split(sep).join('/').replace(/\.(ts|tsx)$/, '');

function locate(path: string): Loc {
  const p = path.replace(/\/index$/, '') || 'index';
  const m = /^modules\/([^/]+)(?:\/(.*))?$/.exec(path);
  if (m) {
    const moduleName = m[1] as string;
    const rest = m[2] ?? '';
    const seg = rest.split('/')[0] ?? '';
    const layer: Layer =
      seg === 'domain' || seg === 'application' || seg === 'infrastructure' || seg === 'ui'
        ? seg
        : rest === 'index' || rest === ''
          ? 'index'
          : rest === 'edge'
            ? 'edge'
            : 'other';
    return { area: 'module', module: moduleName, layer, path };
  }
  if (p.startsWith('shared/infrastructure')) return { area: 'sharedInfra', path };
  if (p.startsWith('shared/ui')) return { area: 'sharedUi', path };
  if (p.startsWith('shared')) return { area: 'shared', path };
  if (p.startsWith('app') || p === 'middleware') return { area: 'app', path };
  if (p.startsWith('integration')) return { area: 'integration', path };
  return { area: 'other', path };
}

interface Edge {
  from: Loc;
  fromFile: string;
  spec: string;
  /** Loyiha ichidagi manzil; tashqi paket bo'lsa — undefined */
  to?: Loc;
}

const IMPORT_RE = /^\s*(?:import|export)\s[^;]*?\bfrom\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm;

function edgesOf(file: string): Edge[] {
  const fromPath = rel(file);
  const src = readFileSync(file, 'utf8');
  const out: Edge[] = [];
  for (const match of src.matchAll(IMPORT_RE)) {
    const spec = (match[1] ?? match[2] ?? match[3]) as string;
    let to: Loc | undefined;
    if (spec.startsWith('@/')) to = locate(spec.slice(2));
    else if (spec.startsWith('.')) to = locate(rel(resolve(dirname(file), spec)));
    out.push({ from: locate(fromPath), fromFile: fromPath, spec, to });
  }
  return out;
}

const files = walk(SRC).filter((f) => rel(f) !== 'architecture.test');
const isTest = (f: string) => /\.test$/.test(f);
const edges = files.filter((f) => !isTest(rel(f))).flatMap(edgesOf);

const EXTERNAL_BANNED_IN_PURE = ['@prisma/client', 'next', 'react', 'react-dom', 'bcryptjs', 'jose'];
const isBanned = (spec: string) => EXTERNAL_BANNED_IN_PURE.some((b) => spec === b || spec.startsWith(`${b}/`));

/** Boshqa modulning ochiq kirish nuqtalari: index, domain, ui, edge. */
function publicEntry(to: Loc): 'index' | 'domain' | 'ui' | 'edge' | null {
  const rest = to.path.split('/').slice(2).join('/');
  if (rest === '' || rest === 'index') return 'index';
  if (rest === 'domain' || rest === 'domain/index') return 'domain';
  if (rest === 'ui' || rest === 'ui/index') return 'ui';
  if (rest === 'edge') return 'edge';
  return null;
}

function violations(): string[] {
  const bad: string[] = [];
  const add = (e: Edge, why: string) => bad.push(`${e.fromFile}  →  ${e.spec}\n    ${why}`);

  for (const e of edges) {
    const { from, to, spec } = e;

    // 1) Prisma va freymvork — faqat tegishli joyda
    if (spec === '@prisma/client' || spec.startsWith('@prisma/client/')) {
      const ok = from.area === 'sharedInfra' || (from.area === 'module' && from.layer === 'infrastructure');
      if (!ok) add(e, 'Prisma\'ni faqat infrastructure qatlami biladi (modul yoki shared/infrastructure).');
    }
    const pure =
      from.area === 'shared' || (from.area === 'module' && (from.layer === 'domain' || from.layer === 'application'));
    if (pure && isBanned(spec)) add(e, 'domain/application/shared sof bo\'lishi kerak: freymvork va infratuzilma paketlari taqiqlangan.');

    if (!to) continue;

    // 2) shared hech qachon modulga bog'lanmaydi
    if ((from.area === 'shared' || from.area === 'sharedInfra' || from.area === 'sharedUi') && to.area === 'module') {
      add(e, 'shared modullarga bog\'liq bo\'la olmaydi (bog\'liqlik faqat modul → shared).');
    }
    // shared (sof) infratuzilmani ishlatmaydi
    if (from.area === 'shared' && (to.area === 'sharedInfra' || to.area === 'sharedUi')) {
      add(e, 'sof shared infrastructure/ui ga bog\'lanmaydi.');
    }

    // 3) app / middleware: ichki qatlamlarga va infratuzilmaga tegmaydi
    if (from.area === 'app' && to.area === 'sharedInfra') add(e, 'sahifa/route infratuzilmani bilmaydi: use-case orqali ishlang.');

    // 4) modullar o'rtasi: faqat ochiq kirish nuqtalari
    if (to.area === 'module' && (from.area !== 'module' || from.module !== to.module)) {
      const entry = publicEntry(to);
      if (!entry) {
        add(e, `boshqa modulning ichki fayliga murojaat: faqat index, domain, ui yoki edge orqali (${to.module}).`);
        continue;
      }
      // Qatlamga qarab qaysi kirish nuqtasi mumkin
      if (from.area === 'module') {
        if (from.layer === 'domain' && entry !== 'domain') add(e, 'domain faqat boshqa modulning domain\'iga tayanadi.');
        if (from.layer === 'application' && entry !== 'domain') add(e, 'application boshqa modulga faqat domain orqali tayanadi; qolganini port orqali oling.');
        if (from.layer === 'infrastructure' && entry !== 'index' && entry !== 'domain') {
          add(e, 'infrastructure boshqa modulning faqat index (use-case) yoki domain\'ini ishlatadi.');
        }
        // dependency graph
        const allowed = ALLOWED_MODULE_DEPS[from.module as string] ?? [];
        if (!allowed.includes(to.module as string)) {
          add(e, `${from.module} → ${to.module} bog'liqligi e'lon qilinmagan (ALLOWED_MODULE_DEPS).`);
        }
      }
    }

    // 5) modul ichida qatlam qoidalari
    if (from.area === 'module' && to.area === 'module' && from.module === to.module) {
      const f = from.layer;
      const t = to.layer;
      if (f === 'domain' && t !== 'domain') add(e, 'domain faqat domain\'ga tayanadi.');
      if (f === 'application' && t !== 'application' && t !== 'domain') add(e, 'application faqat domain va o\'z portlariga tayanadi.');
      if (f === 'infrastructure' && (t === 'ui' || t === 'index')) add(e, 'infrastructure yuqori qatlamga (ui/index) bog\'lanmaydi.');
      if (f === 'ui' && (t === 'application' || t === 'infrastructure')) add(e, 'ui faqat use-case\'larni (modul index) chaqiradi; application/infrastructure ga tegmaydi.');
    }
    if (from.area === 'module' && (from.layer === 'domain' || from.layer === 'application') && to.area === 'sharedInfra') {
      add(e, 'domain/application shared/infrastructure ga bog\'lanmaydi.');
    }
    if (from.area === 'module' && from.layer === 'ui' && to.area === 'sharedInfra') {
      add(e, 'ui shared/infrastructure ga bog\'lanmaydi.');
    }
  }
  return bad;
}

describe('arxitektura qoidalari', () => {
  it('hech qanday import qoidani buzmaydi', () => {
    const v = violations();
    expect(v, `Arxitektura buzilishi (${v.length}):\n\n${v.join('\n\n')}\n`).toEqual([]);
  });

  it('modullar bog\'liqlik grafi sikl (aylana) hosil qilmaydi', () => {
    const visiting = new Set<string>();
    const done = new Set<string>();
    const cycle: string[] = [];
    const visit = (m: string, trail: string[]) => {
      if (done.has(m) || cycle.length > 0) return;
      if (visiting.has(m)) {
        cycle.push(...trail, m);
        return;
      }
      visiting.add(m);
      for (const d of ALLOWED_MODULE_DEPS[m] ?? []) visit(d, [...trail, m]);
      visiting.delete(m);
      done.add(m);
    };
    for (const m of Object.keys(ALLOWED_MODULE_DEPS)) visit(m, []);
    expect(cycle.join(' → '), 'modullar aylana bo\'lib bog\'langan').toBe('');
  });

  it('har modul papkasi grafda e\'lon qilingan va aksincha', () => {
    const onDisk = readdirSync(join(SRC, 'modules'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    expect(onDisk).toEqual(Object.keys(ALLOWED_MODULE_DEPS).sort());
  });

  it('har modulda ochiq index.ts bor', () => {
    for (const m of Object.keys(ALLOWED_MODULE_DEPS)) {
      expect(files.map(rel), `${m}: index.ts topilmadi`).toContain(`modules/${m}/index`);
    }
  });
});
