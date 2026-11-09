'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';

import type { TestDto } from '@/server/training';

import { submitTestAction } from '../../actions';

import { shuffleWithSeed } from '@/modules/oquv/domain';

type Result = Extract<Awaited<ReturnType<typeof submitTestAction>>, { ok: true }>;

const newSeed = () => Math.random().toString(36).slice(2);

export function TestForm({ test }: { test: TestDto }) {
  // Savollar va variantlar har ochilganda aralashadi; bir o'tirishda barqaror.
  // Javob ASL indeks bilan saqlanadi — server matn yoki ko'rinish tartibiga emas, savolId + asl indeksga qaraydi.
  const [seed, setSeed] = useState(newSeed);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const view = useMemo(
    () =>
      shuffleWithSeed(test.questions, seed).map((q) => ({
        ...q,
        shown: shuffleWithSeed(q.options.map((text, index) => ({ text, index })), `${seed}:${q.id}`),
      })),
    [test.questions, seed],
  );
  const total = test.questions.length;
  const answered = Object.keys(chosen).length;

  function submit() {
    setError(null);
    if (answered < total) {
      setError(`Hamma savolga javob bering: ${answered} / ${total}.`);
      return;
    }
    start(async () => {
      try {
        const r = await submitTestAction(test.deptId, chosen);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setResult(r);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        setError('Aloqa yo‘q, saqlanmadi. Javoblaringiz shu yerda turibdi — aloqa tiklangach qayta topshiring.');
      }
    });
  }

  function retry() {
    setResult(null);
    setChosen({});
    setError(null);
    setSeed(newSeed());
    window.scrollTo({ top: 0 });
  }

  const byId = new Map(test.questions.map((q) => [q.id, q]));

  if (result) {
    return (
      <div className="pb-8">
        <div className={clsx('card mb-5 border-l-[5px] p-card', result.passed ? 'border-l-ok' : 'border-l-bad')}>
          <p className={clsx('text-display tnum', result.passed ? 'text-ok' : 'text-bad')}>{result.pct}%</p>
          <p className="mt-1 text-title">{result.passed ? 'O‘tdi' : 'O‘tmadi'}</p>
          <p className="tnum mt-1 text-body text-ink2">
            Ball: {result.score} / {result.total}. O‘tish: {test.passPct}%.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!result.passed ? (
              <button type="button" className="btn-primary min-h-[48px]" onClick={retry}>
                Qayta urinish
              </button>
            ) : null}
            <Link href={`/oquv?d=${test.deptId}`} className="btn-ghost min-h-[48px]">
              O‘quv dasturiga qaytish
            </Link>
          </div>
        </div>

        <ol className="space-y-3">
          {result.review.map((r, i) => {
            const q = byId.get(r.id);
            if (!q) return null;
            return (
              <li key={r.id} className={clsx('card p-3.5', !r.correct && 'border-bad/50')}>
                <p className="text-body font-medium">
                  <span className="tnum text-muted">{i + 1}. </span>
                  {q.case}
                </p>
                <p className="mt-2 text-meta">
                  <span className="font-semibold">Sizning javobingiz: </span>
                  <span className={r.correct ? 'text-ok' : 'text-bad'}>{q.options[r.chosen]}</span>
                  <span className="ml-2 font-semibold">{r.correct ? '✓ to‘g‘ri' : '✗ xato'}</span>
                </p>
                {!r.correct ? (
                  <p className="mt-1 text-meta">
                    <span className="font-semibold">To‘g‘ri javob: </span>
                    <span className="text-ok">{q.options[r.answer]}</span>
                  </p>
                ) : null}
                <p className="mt-2 rounded-tile bg-raised px-3 py-2 text-meta text-ink2">{r.why}</p>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <ol className="space-y-4">
        {view.map((q, i) => (
          <li key={q.id} className="card p-3.5">
            <p className="text-body font-medium">
              <span className="tnum text-muted">{i + 1}. </span>
              {q.case}
            </p>
            <div role="radiogroup" aria-label={`${i + 1}-savol`} className="mt-3 space-y-2">
              {q.shown.map((o) => {
                const on = chosen[q.id] === o.index;
                return (
                  <label
                    key={o.index}
                    className={clsx(
                      'flex min-h-[48px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-body transition',
                      on ? 'border-ink bg-ink/[0.06]' : 'border-line hover:bg-raised',
                    )}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      className="mt-1 h-5 w-5 shrink-0"
                      checked={on}
                      onChange={() => setChosen((c) => ({ ...c, [q.id]: o.index }))}
                    />
                    <span>{o.text}</span>
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-[1100px] px-4 py-2.5">
          {error ? (
            <p role="alert" className="mb-2 rounded-lg bg-bad/10 px-3 py-2 text-meta font-medium text-bad">
              {error}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <p className="tnum min-w-[72px] text-title">
              {answered} / {total}
            </p>
            <button type="button" className="btn-primary min-h-[52px] flex-1 text-body" disabled={pending} onClick={submit}>
              {pending ? 'Tekshirilmoqda…' : 'Topshirish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
