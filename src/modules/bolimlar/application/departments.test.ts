import { describe, expect, it } from 'vitest';

import type { Actor } from '@/shared/actor';
import type { JournalEntry } from '@/shared/journal';

import type { DeptDto } from '../domain';

import { moveDepartment, saveDepartment } from './departments';
import type { DepartmentDeps, DeptSavePlan } from './ports';

const head: Actor = { id: 'u1', role: 'HEAD' };
const inspector: Actor = { id: 'u2', role: 'INSPECTOR' };

const cp = (id: string) => ({ id, text: `Savol ${id}`, group: null, weight: 1, critical: false, active: true, kind: 'check' as const, okLabel: null, badLabel: null, list: 'shift' as const });
const dept = (): DeptDto => ({ id: 'd1', name: 'Kuryerka', position: 1, active: true, norm: 90, estimate: true, checkpoints: [cp('cp1'), cp('cp3')], staff: [] });

function setup(opts: { existing?: DeptDto | null; nameTaken?: boolean } = {}) {
  const plans: DeptSavePlan[] = [];
  const log: JournalEntry[] = [];
  const orders: string[][] = [];
  const existing = opts.existing === undefined ? dept() : opts.existing;
  const deps = {
    uow: { run: async (fn: (tx: never) => Promise<unknown>) => fn({} as never) },
    departments: () => ({
      nameTaken: async () => !!opts.nameTaken,
      get: async () => existing,
      nextPosition: async () => 5,
      save: async (p: DeptSavePlan) => {
        plans.push(p);
        return p.id ?? 'new1';
      },
      order: async () => [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
      setOrder: async (ids: string[]) => void orders.push(ids),
    }),
    journal: () => ({ write: async (e: JournalEntry) => void log.push(e) }),
  } as unknown as DepartmentDeps;
  return { deps, plans, log, orders };
}

type Input = Parameters<typeof saveDepartment>[2];
const point = (over: Record<string, unknown> = {}) => ({ text: 'Savol', weight: 1, critical: false, active: true, ...over });
const input = (over: Partial<Input> = {}): Input => ({
  id: 'd1', name: 'Kuryerka', norm: 90, estimate: true, active: true,
  checkpoints: [point({ id: 'cp1', text: 'Savol cp1' }), point({ id: 'cp3', text: 'Savol cp3' })],
  ...over,
});

describe('saveDepartment', () => {
  it('faqat rahbar saqlay oladi', async () => {
    const { deps, plans } = setup();
    expect(await saveDepartment(deps, inspector, input())).toMatchObject({ ok: false, status: 403 });
    expect(plans).toEqual([]);
  });

  it('takroriy nom, noma‘lum bo‘lim va noma‘lum nuqta rad etiladi', async () => {
    expect(await saveDepartment(setup({ nameTaken: true }).deps, head, input())).toMatchObject({ ok: false, status: 400 });
    expect(await saveDepartment(setup({ existing: null }).deps, head, input())).toMatchObject({ ok: false, status: 404 });
    const unknown = input({ checkpoints: [point({ id: 'cpX' })] });
    expect(await saveDepartment(setup().deps, head, unknown)).toMatchObject({ ok: false, status: 400 });
  });

  it('yangi nuqtaga eng kattadan keyingi cpN beradi va o‘zgarishni jurnalga yozadi', async () => {
    const { deps, plans, log } = setup();
    const withNew = input({ name: 'Kuryerka 2', checkpoints: [...input().checkpoints, point({ text: 'Yangi', weight: 2 })] });
    expect(await saveDepartment(deps, head, withNew)).toEqual({ ok: true, data: { id: 'd1' } });
    expect(plans[0]?.checkpoints.map((c) => [c.id, c.isNew])).toEqual([['cp1', false], ['cp3', false], ['cp4', true]]);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: 'dept.save', entityId: 'd1' });
  });

  it('o‘zgarishsiz saqlashda jurnalga yozilmaydi; yangi bo‘lim oxirgi o‘ringa qo‘yiladi', async () => {
    const same = setup();
    await saveDepartment(same.deps, head, input());
    expect(same.log).toHaveLength(0);

    const fresh = setup({ existing: null });
    const r = await saveDepartment(fresh.deps, head, input({ id: undefined, name: 'Yangi', checkpoints: [point()] }));
    expect(r).toEqual({ ok: true, data: { id: 'new1' } });
    expect(fresh.plans[0]?.position).toBe(5);
  });
});

describe('moveDepartment', () => {
  it('o‘rin almashtiradi va jurnalga yozadi; chetdan chiqmaydi', async () => {
    const { deps, orders, log } = setup();
    await moveDepartment(deps, head, 'b', -1);
    expect(orders).toEqual([['b', 'a', 'c']]);
    expect(log[0]).toMatchObject({ action: 'dept.move', summary: 'Bo‘lim tartibi o‘zgardi: «B» yuqoriga' });

    const edge = setup();
    expect(await moveDepartment(edge.deps, head, 'a', -1)).toEqual({ ok: true, data: { id: 'a' } });
    expect(edge.orders).toEqual([]);
    expect(await moveDepartment(edge.deps, head, 'zzz', 1)).toMatchObject({ ok: false, status: 404 });
    expect(await moveDepartment(edge.deps, inspector, 'a', 1)).toMatchObject({ ok: false, status: 403 });
  });
});
