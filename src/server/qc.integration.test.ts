/**
 * Server testlari (ruxsatlar + tranzaksiya) — HAQIQIY PostgreSQL'ga qarshi.
 * Faqat QC_TEST_DATABASE_URL berilganda ishlaydi (alohida «otk_test» bazasi; .env dagi bazaga tegmaydi).
 * Ishga tushirish:  pnpm test:db
 */

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import bcrypt from 'bcryptjs';

import { changePassword } from '@/modules/foydalanuvchilar';
import { listLog } from '@/modules/jurnal';
import { listUsers, saveUser } from '@/modules/foydalanuvchilar';

import {
  closeTask,
  createAudit,
  deleteAudit,
  getAudit,
  getSummaryData,
  listAudits,
  listTasks,
  listTaskTab,
  updateAudit,
  type Ctx,
} from './qc';
import { listDepartments, saveDepartment } from '@/modules/bolimlar';

import type { Actor } from '@/shared/actor';
import { todayTashkent } from '@/shared/time';

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
    await db.qcLog.deleteMany();
    await db.qcReport.deleteMany();
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

  it('foydalanuvchi: faqat rahbar boshqaradi; ko‘ruvchiga bo‘lim majburiy; o‘zini pasaytira olmaydi', async () => {
    const input = { login: 'yangi.k', fullName: 'Yangi Ko‘ruvchi', role: 'VIEWER' as const, active: true, password: 'parol1234' };
    expect(await saveUser(insp1, { ...input, deptId: d1 }, ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await listUsers(viewer, ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await saveUser(head, input, ctx)).toMatchObject({ ok: false, status: 400 }); // bo'limsiz
    expect(await saveUser(head, { ...input, password: '123' , deptId: d1 }, ctx)).toMatchObject({ ok: false, status: 400 });
    const created = await saveUser(head, { ...input, deptId: d1 }, ctx);
    expect(created.ok).toBe(true);
    expect(await saveUser(head, { ...input, deptId: d1 }, ctx)).toMatchObject({ ok: false, status: 400 }); // login band
    expect(await saveUser(head, { id: head.id, fullName: 'head', role: 'INSPECTOR', active: true }, ctx)).toMatchObject({ ok: false, status: 400 });
    const row = await db.user.findUniqueOrThrow({ where: { login: 'yangi.k' } });
    expect(row).toMatchObject({ role: 'VIEWER', deptId: d1 });
    expect(row.passwordHash).not.toContain('parol1234');
  });

  it('og‘irlik muzlatiladi: keyin nuqta og‘irligi o‘zgarsa ham eski tekshiruv bali o‘zgarmaydi', async () => {
    const created = await createAudit(insp1, await body(d1, 'nyyyyy'), ctx);
    if (!created.ok) throw new Error('create');
    const before = await getAudit(head, created.data.id, ctx);
    if (!before.ok) throw new Error('get');
    expect(before.data.audit.scorePct).toBeCloseTo(83.33, 1); // 5 / 6

    const dept = (await listDepartments(head, {}, ctx)).find((d) => d.id === d1)!;
    const edited = dept.checkpoints.map((c) => (c.id === 'cp1' ? { ...c, weight: 3 } : c));
    expect(await saveDepartment(head, { id: d1, name: dept.name, norm: dept.norm, estimate: dept.estimate, active: true, checkpoints: edited }, ctx)).toMatchObject({ ok: true });

    const row = await db.qcAudit.findUniqueOrThrow({ where: { id: created.data.id } });
    expect((row.weights as Record<string, number>).cp1).toBe(1); // kiritilgan paytdagi qiymat
    const after = await getAudit(head, created.data.id, ctx);
    if (!after.ok) throw new Error('get2');
    expect(after.data.audit.scorePct).toBeCloseTo(83.33, 1); // 5 / (5 + 3) = 62.5 BO'LMAYDI

    // yangi tekshiruv esa yangi og'irlik bilan hisoblanadi
    const fresh = await createAudit(insp1, await body(d1, 'nyyyyy'), ctx);
    if (!fresh.ok) throw new Error('create2');
    const f = await getAudit(head, fresh.data.id, ctx);
    if (!f.ok) throw new Error('get3');
    expect(f.data.audit.scorePct).toBeCloseTo(62.5, 1);
  });

  it('o‘zgarishlar jurnali: bo‘lim sozlamasi va o‘chirilgan tekshiruv nusxasi izsiz yo‘qolmaydi; jurnalni faqat rahbar ko‘radi', async () => {
    const log = await listLog(head, {}, ctx);
    if (!log.ok) throw new Error('log');
    const dept = log.data.rows.find((r) => r.action === 'dept.save' && r.summary.includes('og‘irlik 1 → 3'));
    expect(dept).toBeTruthy();

    const created = await createAudit(insp1, await body(d1, 'nnyyyy'), ctx);
    if (!created.ok) throw new Error('create');
    expect(await deleteAudit(head, created.data.id, ctx)).toMatchObject({ ok: true });
    const del = await db.qcLog.findFirstOrThrow({ where: { action: 'audit.delete', entityId: created.data.id } });
    expect(del.actorId).toBe(head.id);
    expect((del.details as { answers: Record<string, string> }).answers.cp1).toBe('no');
    expect((del.details as { tasks: unknown[] }).tasks).toHaveLength(2);

    expect(await listLog(insp1, {}, ctx)).toMatchObject({ ok: false, status: 403 });
    expect(await listLog(viewer, {}, ctx)).toMatchObject({ ok: false, status: 403 });
  });

  it('parol: rahbar o‘rnatgan/yangi hisobda almashtirish majburiy; noto‘g‘ri joriy parol va oddiy parol 400', async () => {
    const made = await saveUser(head, { login: 'parol.sinov', fullName: 'Parol Sinov', role: 'INSPECTOR', active: true, password: 'Boshlangich1' }, ctx);
    if (!made.ok) throw new Error(JSON.stringify(made));
    const row = await db.user.findUniqueOrThrow({ where: { id: made.data.id } });
    expect(row.mustChangePassword).toBe(true);

    expect(await changePassword(row.id, { current: 'Xato-Parol9', next: 'Yangi-Parol7', confirm: 'Yangi-Parol7' }, ctx)).toMatchObject({ ok: false, status: 400 });
    expect(await changePassword(row.id, { current: 'Boshlangich1', next: 'Otk2026!', confirm: 'Otk2026!' }, ctx)).toMatchObject({ ok: false, status: 400 });
    expect(await changePassword(row.id, { current: 'Boshlangich1', next: 'Yangi-Parol7', confirm: 'Boshqa-Parol7' }, ctx)).toMatchObject({ ok: false, status: 400 });
    expect(await changePassword(row.id, { current: 'Boshlangich1', next: 'Yangi-Parol7', confirm: 'Yangi-Parol7' }, ctx)).toMatchObject({ ok: true });

    const after = await db.user.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.mustChangePassword).toBe(false);
    expect(await bcrypt.compare('Yangi-Parol7', after.passwordHash)).toBe(true);

    // rahbar parolni qayta o'rnatsa — yana majburiy almashtirish
    expect(await saveUser(head, { id: row.id, fullName: 'Parol Sinov', role: 'INSPECTOR', active: true, password: 'Tiklangan-12' }, ctx)).toMatchObject({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: row.id } })).mustChangePassword).toBe(true);
    const logged = await db.qcLog.findFirst({ where: { action: 'user.save', entityId: row.id, summary: { contains: 'parol qayta o‘rnatildi' } } });
    expect(logged).toBeTruthy();
    expect(JSON.stringify(logged)).not.toContain('Tiklangan-12'); // parol jurnalga tushmaydi
  });

  it('sessiya versiyasi: parol almashtirish, rahbar tiklashi va o‘chirish eski sessiyalarni bekor qiladi; oddiy tahrir — yo‘q', async () => {
    const made = await saveUser(head, { login: 'sessiya.sinov', fullName: 'Sessiya Sinov', role: 'INSPECTOR', active: true, password: 'Boshlangich1' }, ctx);
    if (!made.ok) throw new Error(JSON.stringify(made));
    const sv = async () => (await db.user.findUniqueOrThrow({ where: { id: made.data.id } })).sessionVersion;
    expect(await sv()).toBe(0);

    await changePassword(made.data.id, { current: 'Boshlangich1', next: 'Yangi-Parol7', confirm: 'Yangi-Parol7' }, ctx);
    expect(await sv()).toBe(1);

    // ism o'zgarishi sessiyani bekor qilmaydi
    await saveUser(head, { id: made.data.id, fullName: 'Sessiya Sinov 2', role: 'INSPECTOR', active: true }, ctx);
    expect(await sv()).toBe(1);

    await saveUser(head, { id: made.data.id, fullName: 'Sessiya Sinov 2', role: 'INSPECTOR', active: true, password: 'Tiklangan-12' }, ctx);
    expect(await sv()).toBe(2);

    await saveUser(head, { id: made.data.id, fullName: 'Sessiya Sinov 2', role: 'INSPECTOR', active: false }, ctx);
    expect(await sv()).toBe(3);
  });

  it('topshiriqlar varag‘i: bazada filtrlanadi, sonlar to‘liq, 50 tadan sahifalanadi (hech biri tushib qolmaydi)', async () => {
    const audit = await db.qcAudit.findFirstOrThrow({ where: { deptId: d2 } });
    const past = '2020-01-01';
    const far = '2099-12-31';
    await db.qcTask.createMany({
      data: [
        // 60 ta eski yopilgan — avvalgi 1000 talik cheklovda yangi ochiqlarni siqib chiqargan holat
        ...Array.from({ length: 60 }, (_, i) => ({ auditId: audit.id, deptId: d2, cpId: 'cp2', what: `yopiq ${i}`, owner: 'A', due: past, status: 'CLOSED' as const, checkedOn: past })),
        { auditId: audit.id, deptId: d2, cpId: 'cp3', what: 'uzoq muddatli ochiq', owner: 'B', due: far },
      ],
    });
    const counts = {
      overdue: await db.qcTask.count({ where: { deptId: d2, status: 'OPEN', due: { lt: today } } }),
      open: await db.qcTask.count({ where: { deptId: d2, status: 'OPEN' } }),
      closed: await db.qcTask.count({ where: { deptId: d2, status: 'CLOSED' } }),
    };

    const closed = await listTaskTab(head, { tab: 'closed', dept: d2 }, ctx);
    if (!closed.ok) throw new Error('closed');
    expect(closed.data.counts).toEqual(counts);
    expect(closed.data.total).toBe(counts.closed);
    expect(closed.data.rows).toHaveLength(Math.min(50, counts.closed));
    const page2 = await listTaskTab(head, { tab: 'closed', dept: d2, offset: 50 }, ctx);
    if (!page2.ok) throw new Error('page2');
    expect(page2.data.rows).toHaveLength(counts.closed - 50);

    const open = await listTaskTab(head, { tab: 'open', dept: d2 }, ctx);
    if (!open.ok) throw new Error('open');
    expect(open.data.rows.every((t) => t.status === 'open')).toBe(true);
    expect(open.data.rows.some((t) => t.what === 'uzoq muddatli ochiq')).toBe(true);

    const overdue = await listTaskTab(head, { tab: 'overdue', dept: d2 }, ctx);
    if (!overdue.ok) throw new Error('overdue');
    expect(overdue.data.rows.every((t) => t.status === 'open' && t.due < today)).toBe(true);

    expect(await listTaskTab(viewer, { tab: 'open', dept: d2 }, ctx)).toMatchObject({ ok: false, status: 403 });
  });

  it('hodimlar kesimi: ro‘yxat saqlanadi, natija hodim bo‘yicha, begona hodim rad etiladi, ism serverdan', async () => {
    // Alohida bo'lim: oddiy nuqta + hodim Ha/Yo'q + hodim soni
    const saved = await saveDepartment(
      head,
      {
        name: 'Call center (hodimlar)',
        norm: 90,
        estimate: true,
        active: true,
        checkpoints: [
          { text: 'Ish joyi tartibda', weight: 1, critical: false, active: true },
          { text: 'Smenani topshirdi', weight: 2, critical: false, active: true, kind: 'staff_check', okLabel: 'Topshirdi', badLabel: 'Topshirmadi' },
          { text: 'Murojaatlar sifatli yopildi', weight: 1, critical: false, active: true, kind: 'staff_count', okLabel: 'Sifatli', badLabel: 'Yopilmadi' },
        ],
        staff: [
          { name: 'Aziz', active: true },
          { name: 'Vali', active: true },
          { name: 'Ketgan hodim', active: false },
        ],
      },
      ctx,
    );
    if (!saved.ok) throw new Error(JSON.stringify(saved));
    const deptId = saved.data.id;
    const dept = (await listDepartments(head, { includeInactive: true }, ctx)).find((d) => d.id === deptId)!;
    expect(dept.checkpoints.map((c) => c.kind)).toEqual(['check', 'staff_check', 'staff_count']);
    expect(dept.staff.map((s) => [s.name, s.active])).toEqual([['Aziz', true], ['Vali', true], ['Ketgan hodim', false]]);
    const [aziz, vali, ketgan] = dept.staff.map((s) => s.id) as [string, string, string];

    // hodimsiz bo'limda hodimli nuqta saqlanmaydi
    expect(
      await saveDepartment(head, { name: 'Bo‘sh', norm: 90, estimate: true, active: true, checkpoints: [{ text: 'x', weight: 1, critical: false, active: true, kind: 'staff_check' }] }, ctx),
    ).toMatchObject({ ok: false, status: 400 });

    const good = {
      dept: deptId,
      date: today,
      answers: { cp1: 'yes' },
      notes: {},
      tasks: [],
      staff: {
        people: [aziz, vali],
        results: {
          cp2: { [aziz]: { v: 'yes' }, [vali]: { v: 'no', reason: 'Kech qoldi' } },
          cp3: { [aziz]: { ok: 40, bad: 0 }, [vali]: { ok: 30, bad: 10, reason: 'Tizim sekin' } },
        },
      },
    };
    const created = await createAudit(insp1, good, ctx);
    if (!created.ok) throw new Error(JSON.stringify(created));
    const got = await getAudit(head, created.data.id, ctx);
    if (!got.ok) throw new Error('get');
    expect(got.data.audit.answers).toEqual({ cp1: 'yes', cp2: 'no', cp3: 'no' });
    expect(got.data.audit.staff?.people).toEqual([{ id: aziz, name: 'Aziz' }, { id: vali, name: 'Vali' }]);
    expect(got.data.audit.scorePct).toBeCloseTo(((1 + 2 * 0.5 + 70 / 80) / 4) * 100, 6);
    expect(await db.qcTask.count({ where: { auditId: created.data.id } })).toBe(0); // hodimli nuqtada topshiriq ixtiyoriy

    // yashirilgan hodim yangi tekshiruvda tanlanmaydi; boshqa bo'lim hodimi ham
    const hidden = { ...good, staff: { ...good.staff, people: [aziz, vali, ketgan] } };
    expect(await createAudit(insp1, hidden, ctx)).toMatchObject({ ok: false, status: 400 });

    // ism serverdan: hodim nomi o'zgarsa ham eski tekshiruvda nusxa qoladi
    await saveDepartment(
      head,
      {
        id: deptId,
        name: dept.name,
        norm: 90,
        estimate: true,
        active: true,
        checkpoints: dept.checkpoints.map((c) => ({ ...c })),
        staff: [
          { id: aziz, name: 'Aziz Karimov', active: true },
          { id: vali, name: 'Vali', active: true },
          { id: ketgan, name: 'Ketgan hodim', active: false },
        ],
      },
      ctx,
    );
    const again = await getAudit(head, created.data.id, ctx);
    if (!again.ok) throw new Error('get2');
    expect(again.data.audit.staff?.people[0]?.name).toBe('Aziz');
    const log = await db.qcLog.findFirst({ where: { action: 'dept.save', entityId: deptId, summary: { contains: 'Aziz Karimov' } } });
    expect(log).toBeTruthy();
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
