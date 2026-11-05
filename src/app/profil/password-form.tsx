'use client';

import { useActionState } from 'react';

import { changePasswordAction, type PasswordState } from './actions';

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="field-label" htmlFor="current">
          Joriy parol
        </label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className="field min-h-[44px]" />
      </div>
      <div>
        <label className="field-label" htmlFor="next">
          Yangi parol (kamida 8 belgi, harf va raqam)
        </label>
        <input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} className="field min-h-[44px]" />
      </div>
      <div>
        <label className="field-label" htmlFor="confirm">
          Yangi parol takrori
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="field min-h-[44px]" />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-meta font-medium text-bad">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn-primary min-h-[48px] w-full" disabled={pending}>
        {pending ? 'Saqlanmoqda…' : 'Parolni almashtirish'}
      </button>
    </form>
  );
}
