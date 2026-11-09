'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { QC_ROLE_LABEL, roleNeedsDept, type QcRole } from '@/qc/policy';
import type { UserDto } from '@/server/users';

import { saveUserAction } from '../actions';

type Dept = { id: string; name: string };

function useSave() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => ReturnType<typeof saveUserAction>, after?: () => void) =>
    start(async () => {
      setError(null);
      setOk(false);
      try {
        const r = await fn();
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setOk(true);
        after?.();
        router.refresh();
      } catch {
        setError('Aloqa yo‘q, saqlanmadi.');
      }
    });
  return { error, ok, pending, run };
}

export function UserRow({ user, departments, self }: { user: UserDto; departments: Dept[]; self: boolean }) {
  const [role, setRole] = useState<QcRole>(user.role);
  const [deptId, setDeptId] = useState(user.deptId ?? '');
  const [active, setActive] = useState(user.active);
  const [password, setPassword] = useState('');
  const { error, ok, pending, run } = useSave();

  return (
    <li className="card p-3.5">
      <p className="text-body font-semibold">
        {user.fullName} <span className="text-meta font-normal text-muted">· {user.login}</span>
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-4">
        <label className="text-meta">
          <span className="field-label">Rol</span>
          <select className="field min-h-[44px]" value={role} disabled={self} onChange={(e) => setRole(e.target.value as QcRole)}>
            {(Object.keys(QC_ROLE_LABEL) as QcRole[]).map((r) => (
              <option key={r} value={r}>
                {QC_ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-meta">
          <span className="field-label">Bo‘lim (ko‘ruvchi, supervayzer)</span>
          <select
            className="field min-h-[44px]"
            value={deptId}
            disabled={!roleNeedsDept(role)}
            onChange={(e) => setDeptId(e.target.value)}
          >
            <option value="">— tanlang —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-meta">
          <span className="field-label">Yangi parol (ixtiyoriy)</span>
          <input
            type="password"
            autoComplete="new-password"
            className="field min-h-[44px]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex min-h-[44px] items-center gap-2 text-meta">
            <input type="checkbox" className="h-5 w-5" checked={active} disabled={self} onChange={(e) => setActive(e.target.checked)} />
            Faol
          </label>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary min-h-[44px]"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                saveUserAction({
                  id: user.id,
                  fullName: user.fullName,
                  role,
                  deptId: roleNeedsDept(role) ? deptId || null : null,
                  active,
                  password: password || undefined,
                }),
              () => setPassword(''),
            )
          }
        >
          {pending ? 'Saqlanmoqda…' : 'Saqlash'}
        </button>
        {ok ? <span className="text-meta font-medium text-ok">Saqlandi</span> : null}
        {error ? (
          <span role="alert" className="text-meta font-medium text-bad">
            {error}
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function NewUserForm({ departments }: { departments: Dept[] }) {
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<QcRole>('VIEWER');
  const [deptId, setDeptId] = useState('');
  const [password, setPassword] = useState('');
  const { error, pending, run } = useSave();

  if (!open) {
    return (
      <button type="button" className="btn-ghost mt-4 min-h-[44px]" onClick={() => setOpen(true)}>
        + Yangi foydalanuvchi
      </button>
    );
  }
  return (
    <section className="card mt-4 p-card">
      <h2 className="mb-3 text-title">Yangi foydalanuvchi</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="field-label">Ism-familiya</span>
          <input className="field min-h-[44px]" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label>
          <span className="field-label">Login</span>
          <input className="field min-h-[44px]" autoComplete="off" value={login} onChange={(e) => setLogin(e.target.value)} />
        </label>
        <label>
          <span className="field-label">Rol</span>
          <select className="field min-h-[44px]" value={role} onChange={(e) => setRole(e.target.value as QcRole)}>
            {(Object.keys(QC_ROLE_LABEL) as QcRole[]).map((r) => (
              <option key={r} value={r}>
                {QC_ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Bo‘lim (ko‘ruvchi, supervayzer uchun majburiy)</span>
          <select className="field min-h-[44px]" value={deptId} disabled={!roleNeedsDept(role)} onChange={(e) => setDeptId(e.target.value)}>
            <option value="">— tanlang —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="field-label">Parol (kamida 8 belgi)</span>
          <input
            type="password"
            autoComplete="new-password"
            className="field min-h-[44px]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-meta font-medium text-bad">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn-primary min-h-[44px]"
          disabled={pending}
          onClick={() =>
            run(
              () => saveUserAction({ login, fullName, role, deptId: roleNeedsDept(role) ? deptId || null : null, active: true, password }),
              () => {
                setOpen(false);
                setLogin('');
                setFullName('');
                setPassword('');
                setDeptId('');
              },
            )
          }
        >
          {pending ? 'Saqlanmoqda…' : 'Yaratish'}
        </button>
        <button type="button" className="btn-ghost min-h-[44px]" onClick={() => setOpen(false)}>
          Bekor qilish
        </button>
      </div>
    </section>
  );
}
