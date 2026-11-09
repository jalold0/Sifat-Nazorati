import { describe, expect, it } from 'vitest';

import type { Actor } from '@/shared/actor';
import type { JournalEntry } from '@/shared/journal';

import type { TaskDto } from '../domain';

import type { AuditDeps } from './ports';
import { closeTask, updateTask } from './tasks';

const head: Actor = { id: 'u1', role: 'HEAD' };
const viewer: Actor = { id: 'u2', role: 'VIEWER', deptId: 'd1' };

const task = (over: Partial<TaskDto> = {}): TaskDto => ({
  id: 't1', audit: 'a1', dept: 'd1', cp: 'cp1', what: 'Tuzatish', owner: 'Aziz', due: '2026-11-20',
  status: 'open', closedAt: null, checkNote: null, checkedByName: null, ...over,
});

function setup(initial: TaskDto | null) {
  const calls: string[] = [];
  const log: JournalEntry[] = [];
  const deps = {
    uow: { run: async (fn: (tx: never) => Promise<unknown>) => fn({} as never) },
    tasks: () => ({
      find: async () => initial,
      close: async (id: string, c: { byId: string; on: string; note: string }) => void calls.push(`close:${id}:${c.byId}:${c.on}:${c.note}`),
      update: async (id: string, c: { what: string; owner: string; due: string }) => void calls.push(`update:${id}:${c.what}:${c.owner}:${c.due}`),
    }),
    journal: () => ({ write: async (e: JournalEntry) => void log.push(e) }),
    now: () => new Date('2026-11-12T08:00:00Z'),
  } as unknown as AuditDeps;
  return { deps, calls, log };
}

describe('closeTask', () => {
  it('ko‘ruvchi yopa olmaydi (403)', async () => {
    const { deps, calls } = setup(task());
    const r = await closeTask(deps, viewer, 't1', 'tekshirdim');
    expect(r).toMatchObject({ ok: false, status: 403, code: 'FORBIDDEN' });
    expect(calls).toEqual([]);
  });

  it('izohsiz 400, topilmasa 404, allaqachon yopilgan bo‘lsa 400', async () => {
    expect(await closeTask(setup(task()).deps, head, 't1', '  ')).toMatchObject({ ok: false, status: 400 });
    expect(await closeTask(setup(null).deps, head, 't1', 'ok')).toMatchObject({ ok: false, status: 404 });
    expect(await closeTask(setup(task({ status: 'closed' })).deps, head, 't1', 'ok')).toMatchObject({ ok: false, status: 400 });
  });

  it('izohni kesib, bugungi Toshkent sanasi bilan yopadi', async () => {
    const { deps, calls } = setup(task());
    expect(await closeTask(deps, head, 't1', '  qayta tekshirildi ')).toEqual({ ok: true, data: { id: 't1' } });
    expect(calls).toEqual(['close:t1:u1:2026-11-12:qayta tekshirildi']);
  });
});

describe('updateTask', () => {
  it('o‘zgarish bo‘lsa jurnalga yozadi, bo‘lmasa yozmaydi', async () => {
    const a = setup(task());
    await updateTask(a.deps, head, 't1', { owner: 'Vali' });
    expect(a.calls).toEqual(['update:t1:Tuzatish:Vali:2026-11-20']);
    expect(a.log).toHaveLength(1);
    expect(a.log[0]).toMatchObject({ action: 'task.update', summary: 'Topshiriq tahrirlandi: mas‘ul: Aziz → Vali' });

    const b = setup(task());
    await updateTask(b.deps, head, 't1', {});
    expect(b.log).toHaveLength(0);
  });

  it('noto‘g‘ri muddat va bo‘sh mas‘ul rad etiladi', async () => {
    expect(await updateTask(setup(task()).deps, head, 't1', { due: '20-11-2026' })).toMatchObject({ ok: false, status: 400 });
    expect(await updateTask(setup(task()).deps, head, 't1', { owner: ' ' })).toMatchObject({ ok: false, status: 400 });
  });
});
