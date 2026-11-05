/**
 * Server testlari (ruxsatlar + tranzaksiya) — HAQIQIY PostgreSQL'ga qarshi.
 * Faqat QC_TEST_DATABASE_URL berilganda ishlaydi (alohida «otk_test» bazasi; .env dagi bazaga tegmaydi).
 * Ishga tushirish:  pnpm test:db
 */

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { todayTashkent } from '@/qc/calc';
import type { Actor } from '@/qc/policy';

import {
  closeTask,
  createAudit,
  deleteAudit,
  getAudit,
  getSummaryData,
  listAudits,
  listDepartments,
  listTasks,
  saveDepartment,
  updateAudit,
  type Ctx,
} from './qc';

const url = process.env.QC_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('server qatlami (PostgreSQL)', () => {
  let db: PrismaClient;
  let ctx: Ctx;
  let d1: string; // Call center
  let d2: string; // Kuryerka
  let head: Actor;
  let insp1: Actor;
  let insp2: Actor;
  let viewer: Actor;
  const today = todayTashkent();

  async function ids(dept: string) {
    return (await db.qcCheckpoint.findMany({ where: { deptId: dept, active: true }, orderBy: { position: 'asc' } })).map(
      (c) => c.id,
    );
  }

  /** spec: har nuqta uchun y / n / x (faol nuqtalar tartibida). */
  async function body(dept: string, spec: string, extra: Record<string, unknown> = {}) {
    const cps = await ids(dept);
    const map = { y: 'yes', n: 'no', x: 'na' } as const;
    const answers: Record<string, string> = {};
    const notes: Record<string, { text: string; ref: string }> = {};
    const tasks: Array<{ cp: string; what: string; owner: string; due: string }> = [];
    [...spec].forEach((c, i) => {
      const id = cps[i]!;
      answers[id] = map[c as 'y' | 'n' | 'x'];
      if (c === 'n') {
        notes[id] = { text: 'Sabab', ref: '' };
        tasks.push({ cp: id, what: 'Tuzatish', owner: 'Aziz', due: today });
      }
    });
    return { dept, date: today, answers, notes, tasks, ...extra };
  }

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    await db.qcTask.deleteMany();
    await db.qcAudit.deleteMany();
    await db.user.deleteMany();
    await db.qcDepartment.deleteMany();
    const mk = async (name: string, position: number) =>
      (
        await db.qcDepartment.create({
          data: {
            name,
            position,
            checkpoints: {
              create: Array.from({ length: 6 }, (_, i) => ({
                id: `cp${i + 1}`,
                text: `Nuqta ${i + 1}`,
                position: i + 1,
                critical: i === 0,
              })),
            },
          },
        })
      ).id;
    d1 = await mk('Call center', 1);
    d2 = await mk('Kuryerka', 2);
    const user = async (key: string, role: 'HEAD' | 'INSPECTOR' | 'VIEWER', deptId?: string) =>
      (
        await db.user.create({
          data: { key, fullName: key, shortName: key, login: key, passwordHash: 'x', role, position: '-', deptId },
        })
      ).id;
    head = { id: await user('head', 'HEAD'), role: 'HEAD' };
    insp1 = { id: await user('insp1', 'INSPECTOR'), role: 'INSPECTOR' };
    insp2 = { id: await user('insp2', 'INSPECTOR'), role: 'INSPECTOR' };
    viewer = { id: await user('viewer', 'VIEWER', d1), role: 'VIEWER', deptId: d1 };
    ctx = { db };
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it('ko‘ruvchi boshqa bo‘lim tekshiruvini o‘qiy olmaydi (403), o‘z bo‘limini o‘qiydi', async () => {
    const mine = await createAudit(insp1, await body(d1, 'yyyyyy'), ctx);
    const other = await createAudit(insp1, await body(d2, 'yyyyyy'), ctx);
    expect(mine.ok && other.ok).toBe(true);
    if (!mine.ok || !other.ok) return;

    expect(await listAudits(viewer, { dept: d2 }, ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await getAudit(viewer, other.data.id, ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await getSummaryData(viewer, { dept: d2, from: today, to: today }, ctx)).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(await listTasks(viewer, { dept: d2 }, ctx)).toMatchObject({ ok: false, status: 403 });

    const own = await listAudits(viewer, { dept: d1 }, ctx);
    expect(own.ok && own.data.rows.length > 0 && own.data.rows.every((r) => r.dept === d1)).toBe(true);
    // bo'lim ko'rsatilmasa ham faqat o'zinikini ko'radi
    const all = await listAudits(viewer, {}, ctx);
    expect(all.ok && all.data.rows.every((r) => r.dept === d1)).toBe(true);
    expect((await listDepartments(viewer, {}, ctx)).map((d) => d.id)).toEqual([d1]);
    expect(await getAudit(viewer, mine.data.id, ctx)).toMatchObject({ ok: true });
  });

  it('ko‘ruvchi va tekshiruvchi bo‘lim yarata olmaydi; rahbar yaratadi', async () => {
    const input = {
      name: 'Yangi bo‘lim',
      norm: 90,
      estimate: true,
      active: true,
      checkpoints: [{ text: 'Savol', weight: 1, critical: false, active: true }],
    };
    expect(await saveDepartment(viewer, input, ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await saveDepartment(insp1, input, ctx)).toMatchObject({ ok: false, status: 403 });
    const r = await saveDepartment(head, input, ctx);
    expect(r.ok).toBe(true);
    const cps = await db.qcCheckpoint.findMany({ where: { deptId: r.ok ? r.data.id : '' } });
    expect(cps.map((c) => c.id)).toEqual(['cp1']);
  });

  it('nuqta o‘chirilmaydi: yashirilsa active:false bo‘ladi, yangisiga keyingi id beriladi', async () => {
    const dept = (await listDepartments(head, {}, ctx)).find((d) => d.id === d2)!;
    const cps = dept.checkpoints.map((c, i) => ({ ...c, active: i !== 0 }));
    const r = await saveDepartment(
      head,
      {
        id: d2,
        name: dept.name,
        norm: 85,
        estimate: false,
        active: true,
        checkpoints: [...cps, { text: 'Yangi', weight: 2, critical: true, active: true }],
      },
      ctx,
    );
    expect(r.ok).toBe(true);
    const rows = await db.qcCheckpoint.findMany({ where: { deptId: d2 }, orderBy: { position: 'asc' } });
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({ id: 'cp1', active: false });
    expect(rows[6]).toMatchObject({ id: 'cp7', weight: 2, critical: true });
  });

  it('tekshiruvchi boshqa tekshiruvchining eski tekshiruvini tuzata olmaydi; o‘zinikini tuzatadi', async () => {
    const created = await createAudit(insp1, await body(d1, 'yyyyyy'), ctx);
    if (!created.ok) throw new Error('create');
    const edit = await body(d1, 'yyyyyx');
    expect(await updateAudit(insp2, created.data.id, edit, ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await updateAudit(viewer, created.data.id, edit, ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await updateAudit(insp1, created.data.id, edit, ctx)).toMatchObject({ ok: true });
    // 24 soatdan keyin o'zinikini ham tuzata olmaydi, rahbar tuzata oladi
    const later = { db, now: new Date(Date.now() + 25 * 3_600_000) };
    expect(await updateAudit(insp1, created.data.id, edit, later)).toMatchObject({ ok: false, status: 403 });
    expect(await updateAudit(head, created.data.id, { ...edit, date: today }, later)).toMatchObject({ ok: true });
  });

  it('«Yo‘q» javobsiz izoh yoki topshiriqsiz tekshiruv 400 qaytaradi', async () => {
    const noNote = await body(d1, 'nyyyyy');
    noNote.notes = {};
    expect(await createAudit(insp1, noNote, ctx)).toMatchObject({ ok: false, status: 400 });
    const noTask = await body(d1, 'nyyyyy');
    noTask.tasks = [];
    expect(await createAudit(insp1, noTask, ctx)).toMatchObject({ ok: false, status: 400 });
    expect(await createAudit(insp1, await body(d1, 'yyyyy'), ctx)).toMatchObject({ ok: false, status: 400 });
    expect(await createAudit(viewer, await body(d1, 'yyyyyy'), ctx)).toMatchObject({ ok: false, status: 403 });
  });

  it('mijoz yuborgan by/created/critical e‘tiborga olinmaydi; jiddiy nuqta serverda hisoblanadi', async () => {
    const r = await createAudit(
      insp1,
      await body(d1, 'nyyyyy', { by: insp2.id, created: 1, updated: 1, critical: false }),
      ctx,
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const row = await db.qcAudit.findUniqueOrThrow({ where: { id: r.data.id } });
    expect(row.byId).toBe(insp1.id);
    expect(row.critical).toBe(true); // cp1 — jiddiy, «Yo'q»
    expect(row.createdAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('bitta tekshiruv va topshiriqlari bitta amalda saqlanadi: xato bo‘lsa hech biri saqlanmaydi', async () => {
    const before = [await db.qcAudit.count(), await db.qcTask.count()];
    const failing = new Proxy(db, {
      get(target, prop, recv) {
        if (prop === '$transaction') {
          return (fn: (tx: unknown) => unknown) =>
            target.$transaction(
              (tx) =>
                fn(
                  new Proxy(tx, {
                    get(t, p) {
                      if (p === 'qcTask') {
                        return {
                          createMany: async () => {
                            throw new Error('boom');
                          },
                        };
                      }
                      return (t as never)[p];
                    },
                  }),
                ) as never,
            );
        }
        return Reflect.get(target, prop, recv);
      },
    }) as PrismaClient;
    await expect(createAudit(insp1, await body(d1, 'nyyyyy'), { db: failing })).rejects.toThrow('boom');
    expect([await db.qcAudit.count(), await db.qcTask.count()]).toEqual(before);

    const saved = await createAudit(insp1, await body(d1, 'nnyyyy'), ctx);
    if (!saved.ok) throw new Error('create');
    expect(await db.qcTask.count({ where: { auditId: saved.data.id } })).toBe(2);
  });

  it('topshiriqni yopish izohsiz 400; tekshiruvchi yopadi; ko‘ruvchi yopa olmaydi; o‘chirish faqat rahbar (topshiriqlari bilan)', async () => {
    const r = await createAudit(insp1, await body(d1, 'nyyyyy'), ctx);
    if (!r.ok) throw new Error('create');
    const task = await db.qcTask.findFirstOrThrow({ where: { auditId: r.data.id } });
    expect(await closeTask(insp1, task.id, '  ', ctx)).toMatchObject({ ok: false, status: 400 });
    expect(await closeTask(viewer, task.id, 'ok', ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await closeTask(insp1, task.id, 'Qayta tekshirildi', ctx)).toMatchObject({ ok: true });
    const closed = await db.qcTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(closed).toMatchObject({ status: 'CLOSED', checkedById: insp1.id, checkedOn: today });
    expect(await closeTask(insp1, task.id, 'yana', ctx)).toMatchObject({ ok: false, status: 400 });

    expect(await deleteAudit(insp1, r.data.id, ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await deleteAudit(head, r.data.id, ctx)).toMatchObject({ ok: true });
    expect(await db.qcTask.count({ where: { auditId: r.data.id } })).toBe(0);
    expect(await getAudit(head, r.data.id, ctx)).toMatchObject({ ok: false, status: 404 });
  });

  it('tarix sahifalanadi, yangisi birinchi', async () => {
    const r = await listAudits(head, { limit: 2, offset: 0 }, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.rows.length).toBeLessThanOrEqual(2);
    const dates = r.data.rows.map((x) => x.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
