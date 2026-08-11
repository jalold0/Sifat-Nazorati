'use client';

import { useActionState } from 'react';

import { setPasswordAction, updateUserAction, type SettingsState } from './actions';

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
