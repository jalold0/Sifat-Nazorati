import { describe, expect, it } from 'vitest';

import type { Actor } from '@/shared/actor';
import type { JournalEntry } from '@/shared/journal';

import type { ReportDeps, ReportNote } from './ports';
import { saveReportNote } from './weekly';

const head: Actor = { id: 'u1', role: 'HEAD' };
const inspector: Actor = { id: 'u2', role: 'INSPECTOR' };
const TODAY = new Date('2026-11-12T08:00:00Z'); // payshanba

function setup(prev: ReportNote | null = null) {
  const saved: string[] = [];
  const log: JournalEntry[] = [];
  const deps = {
    uow: { run: async (fn: (tx: never) => Promise<unknown>) => fn({} as never) },
    notes: () => ({ find: async () => prev, save: async (w: string, n: string, by: string) => void saved.push(`${w}|${n}|${by}`) }),
    journal: () => ({ write: async (e: JournalEntry) => void log.push(e) }),
    now: () => TODAY,
  } as unknown as ReportDeps;
  return { deps, saved, log };
}

describe('saveReportNote', () => {
  it('faqat rahbar yozadi', async () => {
    const { deps, saved } = setup();
    expect(await saveReportNote(deps, inspector, '2026-11-02', 'x')).toMatchObject({ ok: false, status: 403 });
    expect(saved).toEqual([]);
  });

  it('dushanba bo‘lmagan sana, matn bo‘lmagan izoh va juda uzun izoh rad etiladi', async () => {
    const { deps } = setup();
    expect(await saveReportNote(deps, head, '2026-11-03', 'x')).toMatchObject({ ok: false, status: 400 });
    expect(await saveReportNote(deps, head, '2026-11-02', 42)).toMatchObject({ ok: false, status: 400 });
    expect(await saveReportNote(deps, head, '2026-11-02', 'x'.repeat(4001))).toMatchObject({ ok: false, status: 400 });
  });

  it('izohni kesib saqlaydi; jurnalda «yozildi» / «o‘zgartirildi» farqlanadi', async () => {
    const first = setup();
    expect(await saveReportNote(first.deps, head, '2026-11-02', '  yaxshi hafta ')).toEqual({ ok: true, data: { week: '2026-11-02' } });
    expect(first.saved).toEqual(['2026-11-02|yaxshi hafta|u1']);
    expect(first.log[0]?.summary).toBe('Haftalik hisobot izohi (2026-11-02) yozildi');
    expect(first.log[0]?.details).toBeUndefined();

    const again = setup({ note: 'eski', byName: 'Rahbar', updatedAt: new Date() });
    await saveReportNote(again.deps, head, '2026-11-02', 'yangi');
    expect(again.log[0]?.summary).toBe('Haftalik hisobot izohi (2026-11-02) o‘zgartirildi');
    expect(again.log[0]?.details).toEqual({ before: 'eski' });
  });
});
