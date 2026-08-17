'use client';

import { useActionState, useState } from 'react';

import { createUserAction, setPasswordAction, updateUserAction, type SettingsState } from './actions';

export function UserForm({
  id,
  position,
  salary,
  active,
  canEdit,
}: {
  id: string;
  position: string;
  salary: number | null;
  active: boolean;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateUserAction, {});

  if (!canEdit) {
    return <p className="text-meta text-muted">O'zgartirish huquqi bo'lim boshlig'i va rahbariyatda.</p>;
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input name="position" className="field !py-1.5 !text-meta" defaultValue={position} placeholder="Lavozim" />
      <input
        name="salary"
        type="number"
        step="1000"
        min={0}
        className="field !py-1.5 !text-meta"
        defaultValue={salary ?? ''}
        placeholder="Oylik maosh (so'm)"
      />
      <label className="flex cursor-pointer items-center gap-2 text-meta">
        <input type="checkbox" name="active" defaultChecked={active} className="h-3.5 w-3.5 accent-[var(--brand)]" />
        Faol
      </label>
      <button type="submit" className="btn-ghost !py-1.5 !text-meta" disabled={pending}>
        {pending ? '…' : 'Saqlash'}
      </button>
      {state.error ? <p className="text-micro font-medium text-bad">{state.error}</p> : null}
      {state.ok ? <p className="text-micro font-medium text-ok">{state.ok}</p> : null}
    </form>
  );
}

const ROLE_OPTIONS = [
  ['SPECIALIST', 'Sifat nazorati mutaxassisi'],
  ['HEAD', "Bo'lim boshlig'i"],
  ['VIEWER', 'Kuzatuvchi (faqat o‘qish)'],
  ['CEO', 'Rahbariyat (CEO)'],
] as const;

/** Yangi xodim qo'shish shakli — bo'lim boshlig'i va rahbariyat uchun. */
export function CreateUserForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(createUserAction, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        Yangi xodim qo&apos;shish
      </button>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="field-label" htmlFor="fullName">
            To&apos;liq ism-familiya
          </label>
          <input id="fullName" name="fullName" className="field" placeholder="Masalan: Bafoev Jasur" required />
        </div>
        <div>
          <label className="field-label" htmlFor="shortName">
            Qisqa nom
          </label>
          <input id="shortName" name="shortName" className="field" placeholder="Jasur B." required />
          <p className="mt-1 text-micro text-muted">Jadval va hisobotlarda shu nom ko&apos;rinadi.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="new-login">
            Login
          </label>
          <input
            id="new-login"
            name="login"
            className="field"
            placeholder="jasur"
            autoComplete="off"
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="role">
            Rol
          </label>
          <select id="role" name="role" className="field" defaultValue="SPECIALIST">
            {ROLE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="new-position">
            Lavozim
          </label>
          <input
            id="new-position"
            name="position"
            className="field"
            placeholder="Sifat nazorati mutaxassisi — Zona A"
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="new-salary">
            Oylik maosh (so&apos;m)
          </label>
          <input
            id="new-salary"
            name="salary"
            type="number"
            step="1000"
            min={0}
            className="field"
            placeholder="6000000"
          />
          <p className="mt-1 text-micro text-muted">Bo&apos;sh qoldirilsa bonus hisoblanmaydi.</p>
        </div>
        <div className="lg:col-span-2">
          <label className="field-label" htmlFor="new-password">
            Boshlang&apos;ich parol
          </label>
          <input
            id="new-password"
            name="password"
            type="password"
            className="field"
            placeholder="kamida 8 belgi"
            autoComplete="new-password"
            required
          />
          <p className="mt-1 text-micro text-muted">
            Xodimga aytib qo&apos;ying — birinchi kirishdan keyin o&apos;zi almashtiradi.
          </p>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-meta font-medium text-bad">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rounded-lg bg-ok/10 px-3 py-2 text-meta font-medium text-ok">
          {state.ok}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Qo‘shilmoqda…' : 'Xodimni qo‘shish'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Bekor qilish
        </button>
      </div>
    </form>
  );
}

export function PasswordForm({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(setPasswordAction, {});

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <p className="text-meta font-medium text-ink2">{label}</p>
      <input
        name="password"
        type="password"
        className="field !py-1.5 !text-meta"
        placeholder="Yangi parol (kamida 8 belgi)"
        autoComplete="new-password"
        required
      />
      <input
        name="confirm"
        type="password"
        className="field !py-1.5 !text-meta"
        placeholder="Parolni takrorlang"
        autoComplete="new-password"
        required
      />
      <button type="submit" className="btn-ghost !py-1.5 !text-meta" disabled={pending}>
        {pending ? '…' : 'Parolni o‘zgartirish'}
      </button>
      {state.error ? <p className="text-micro font-medium text-bad">{state.error}</p> : null}
      {state.ok ? <p className="text-micro font-medium text-ok">{state.ok}</p> : null}
    </form>
  );
}
