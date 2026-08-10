'use client';

import { useActionState } from 'react';

import { loginAction, type LoginState } from './actions';

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ''} />

      <div>
        <label className="field-label" htmlFor="login">
          Login
        </label>
        <input
          id="login"
          name="login"
          className="field"
          autoComplete="username"
          autoFocus
          required
          placeholder="masalan: saidali"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="password">
          Parol
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="field"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-[12.5px] font-medium text-bad">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? 'Tekshirilmoqda…' : 'Kirish'}
      </button>
    </form>
  );
}
