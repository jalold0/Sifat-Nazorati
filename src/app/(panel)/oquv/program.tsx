'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';

import { ProgressBar } from '@/components/ui';
import type { TrainingDto } from '@/server/training';

import { setTaskAction } from './actions';

import { programProgress, taskKey } from '@/modules/oquv/domain';

export function Program({ training }: { training: TrainingDto }) {
  const [done, setDone] = useState<Set<string>>(() => new Set(training.done));
  // Tez-tez bosilganda yangilanish yo'qolmasligi uchun joriy holat ref'da ham turadi
  const live = useRef(done);
  const apply = (fn: (s: Set<string>) => void) => {
    const next = new Set(live.current);
    fn(next);
    live.current = next;
    setDone(next);
  };
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const progress = programProgress(training.days, [...done]);
  const hasTest = training.questionCount > 0;

  function toggle(key: string) {
    const value = !live.current.has(key);
    apply((s) => (value ? s.add(key) : s.delete(key)));
    setError(null);
    start(async () => {
      try {
        const r = await setTaskAction(training.deptId, key, value);
        if (!r.ok) throw new Error(r.error);
      } catch (e) {
        // Saqlanmadi — belgini qaytaramiz
        apply((s) => (value ? s.delete(key) : s.add(key)));
        setError(e instanceof Error && e.message ? e.message : 'Aloqa yo‘q, saqlanmadi. Qayta urinib ko‘ring.');
      }
    });
  }

  return (
    <div>
      <div className="card p-card">
        <h2 className="text-title">{training.title}</h2>
        {training.intro ? <p className="mt-1 text-body text-ink2">{training.intro}</p> : null}
        <p className="tnum mt-3 text-body font-semibold">
          {progress.total} topshiriqdan {progress.done} tasi
        </p>
        <div className="mt-2">
          <ProgressBar value={progress.total === 0 ? 0 : progress.done / progress.total} tone={progress.complete ? 'ok' : 'brand'} height={8} />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-bad/10 px-3 py-2 text-meta font-medium text-bad">
          {error}
        </p>
      ) : null}

      <ol className="mt-4 space-y-3">
        {training.days.map((day, di) => {
          const dayDone = day.tasks.filter((_, ti) => done.has(taskKey(di + 1, ti))).length;
          return (
            <li key={di}>
              <details className="card group p-0" open={di === 0}>
                <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 p-3.5">
                  <span className="text-body font-semibold">{day.title}</span>
                  <span className={clsx('tnum text-meta', dayDone === day.tasks.length && day.tasks.length > 0 ? 'text-ok' : 'text-muted')}>
                    {dayDone} / {day.tasks.length}
                  </span>
                </summary>
                <div className="border-t border-grid p-3.5">
                  <p className="eyebrow mb-2">Nazariya</p>
                  <ul className="list-disc space-y-1.5 pl-5 text-body">
                    {day.theory.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                  <p className="eyebrow mb-2 mt-4">Topshiriqlar</p>
                  <ul className="space-y-1">
                    {day.tasks.map((t, ti) => {
                      const key = taskKey(di + 1, ti);
                      return (
                        <li key={key}>
                          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-1 py-2 hover:bg-raised">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-6 w-6 shrink-0"
                              checked={done.has(key)}
                              onChange={() => toggle(key)}
                            />
                            <span className={clsx('text-body', done.has(key) && 'text-muted line-through')}>{t}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </details>
            </li>
          );
        })}
      </ol>

      <div className="mt-5">
        {!hasTest ? (
          <p className="rounded-tile border border-dashed border-grid px-4 py-4 text-meta text-muted">
            Bu bo‘lim uchun test hali yozilmagan
          </p>
        ) : progress.complete ? (
          <Link href={`/oquv/test/${training.deptId}`} className="btn-primary min-h-[52px] w-full text-body sm:w-auto">
            Testni boshlash
          </Link>
        ) : (
          <>
            <button type="button" className="btn-primary min-h-[52px] w-full text-body sm:w-auto" disabled>
              Testni boshlash
            </button>
            <p className="mt-2 text-meta text-muted">
              Testni boshlash uchun hamma topshiriqni belgilang: yana {progress.total - progress.done} ta qoldi.
            </p>
          </>
        )}
        {training.attempts > 0 ? (
          <p className="tnum mt-3 text-meta text-ink2">
            Oxirgi urinish: {training.lastPct}% ({training.status === 'passed' ? 'o‘tdi' : 'o‘tmadi'}), urinishlar: {training.attempts}
          </p>
        ) : null}
      </div>
    </div>
  );
}
