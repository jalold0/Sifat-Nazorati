'use client';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { scoreAnswers, type Answer } from '@/qc/calc';
import type { DeptDto, TaskDto } from '@/server/qc';
import { defaultDue, validateAudit } from '@/qc/validate';

import { saveAuditAction, updateAuditAction } from './actions';

interface TaskDraft {
  what: string;
  owner: string;
  due: string;
}
interface NoteDraft {
  text: string;
  ref: string;
}
interface Draft {
  subject: string;
  answers: Record<string, Answer>;
  notes: Record<string, NoteDraft>;
  tasks: Record<string, TaskDraft>;
}

const EMPTY: Draft = { subject: '', answers: {}, notes: {}, tasks: {} };
const LAST_DEPT = 'qc:lastDept';
const draftKey = (deptId: string) => `qc:draft:${deptId}`;

/** localStorage ishlamasa (yopiq rejim, bloklangan) jim o'tkazib yuboriladi. */
const store = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* jim */
    }
  },
  del(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* jim */
    }
  },
};

export interface EditInitial {
  id: string;
  deptId: string;
  date: string;
  subject: string;
  answers: Record<string, Answer>;
  notes: Record<string, NoteDraft>;
  tasks: TaskDto[];
}

type Props =
  | { mode: 'create'; departments: DeptDto[]; today: string }
  | { mode: 'edit'; departments: DeptDto[]; today: string; initial: EditInitial };

const ANSWER_BTN: Array<{ value: Answer; label: string; on: string }> = [
  { value: 'yes', label: 'Ha', on: 'bg-ok text-white border-ok' },
  { value: 'no', label: 'Yo‘q', on: 'bg-bad text-white border-bad' },
  { value: 'na', label: 'Tegishli emas', on: 'bg-ink2 text-plane border-ink2' },
];

export function AuditForm(props: Props) {
  const { departments, today } = props;
  const router = useRouter();
  const edit = props.mode === 'edit' ? props.initial : null;

  const [deptId, setDeptId] = useState<string>(edit?.deptId ?? departments[0]?.id ?? '');
  const [draft, setDraft] = useState<Draft>(() =>
    edit
      ? {
          subject: edit.subject,
          answers: edit.answers,
          notes: edit.notes,
          tasks: Object.fromEntries(
            edit.tasks.map((t) => [t.cp, { what: t.what, owner: t.owner, due: t.due }] as const).reverse(),
          ),
        }
      : EMPTY,
  );
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ready = useRef(false);

  const dept = useMemo(() => departments.find((d) => d.id === deptId), [departments, deptId]);
  const active = useMemo(() => dept?.checkpoints.filter((c) => c.active) ?? [], [dept]);

  // Oxirgi tanlangan bo'lim va qoralamani tiklash (faqat yangi tekshiruvda)
  useEffect(() => {
    if (edit) return;
    const last = store.get(LAST_DEPT);
    const id = last && departments.some((d) => d.id === last) ? last : (departments[0]?.id ?? '');
    setDeptId(id);
    const saved = store.get(draftKey(id));
    if (saved) {
      try {
        setDraft({ ...EMPTY, ...(JSON.parse(saved) as Draft) });
      } catch {
        /* buzuq qoralama e'tiborga olinmaydi */
      }
    }
    ready.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Qoralama: to'ldirilmagan shakl brauzerda saqlanadi
  useEffect(() => {
    if (edit || !ready.current || !deptId) return;
    const hasData = Object.keys(draft.answers).length > 0 || draft.subject !== '';
    if (hasData) store.set(draftKey(deptId), JSON.stringify(draft));
    else store.del(draftKey(deptId));
  }, [draft, deptId, edit]);

  function pickDept(id: string) {
    if (edit || id === deptId) return;
    setDeptId(id);
    store.set(LAST_DEPT, id);
    setError(null);
    setDone(null);
    const saved = store.get(draftKey(id));
    try {
      setDraft(saved ? { ...EMPTY, ...(JSON.parse(saved) as Draft) } : EMPTY);
    } catch {
      setDraft(EMPTY);
    }
  }

  function setAnswer(cpId: string, value: Answer) {
    setDone(null);
    setDraft((d) => {
      const next: Draft = { ...d, answers: { ...d.answers, [cpId]: value } };
      if (value === 'no') {
        next.notes = { ...d.notes, [cpId]: d.notes[cpId] ?? { text: '', ref: '' } };
        next.tasks = { ...d.tasks, [cpId]: d.tasks[cpId] ?? { what: '', owner: '', due: defaultDue(today) } };
      }
      return next;
    });
  }

  const answered = active.filter((c) => draft.answers[c.id]).length;
  const live = useMemo(() => {
    const only: Record<string, Answer> = {};
    for (const c of active) {
      const a = draft.answers[c.id];
      if (a) only[c.id] = a;
    }
    return scoreAnswers(only, active).pct;
  }, [active, draft.answers]);

  function buildBody() {
    const answers: Record<string, Answer> = {};
    const notes: Record<string, NoteDraft> = {};
    const tasks: Array<TaskDraft & { cp: string }> = [];
    for (const c of active) {
      const a = draft.answers[c.id];
      if (!a) continue;
      answers[c.id] = a;
      if (a === 'no') {
        notes[c.id] = draft.notes[c.id] ?? { text: '', ref: '' };
        const t = draft.tasks[c.id] ?? { what: '', owner: '', due: defaultDue(today) };
        tasks.push({ cp: c.id, ...t });
      }
    }
    return { dept: deptId, date: edit?.date ?? today, subject: draft.subject, answers, notes, tasks };
  }

  function submit() {
    setError(null);
    setDone(null);
    if (!dept) return;
    const body = buildBody();
    // Brauzerda oldindan tekshirish — xatoni darhol ko'rsatadi (asl tekshiruv serverda)
    const check = validateAudit(body, dept.checkpoints, {
      today,
      allowPast: !!edit,
      requireComplete: !edit,
    });
    if (!check.ok) {
      setError(check.error);
      return;
    }
    startTransition(async () => {
      try {
        const r = edit ? await updateAuditAction(edit.id, body) : await saveAuditAction(body);
        setOffline(false);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        if (edit) {
          router.push(`/tarix/${edit.id}`);
          return;
        }
        store.del(draftKey(deptId));
        setDraft(EMPTY);
        setDone(`Saqlandi: ${dept.name}${live === null ? '' : `, ball ${Math.round(live)}%`}. Yana tekshirishingiz mumkin.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        // Tarmoq uzilgan: shakl ochiq qoladi, hech narsa yo'qolmaydi
        setOffline(true);
      }
    });
  }

  if (!dept) return null;

  return (
    <div className="pb-28">
      {offline ? (
        <p role="alert" className="mb-4 rounded-lg bg-bad/10 px-3 py-3 text-body font-semibold text-bad">
          Aloqa yo‘q, saqlanmadi. Shakl ochiq turibdi — aloqa tiklangach «Saqlash» ni qayta bosing.
        </p>
      ) : null}
      {done ? (
        <p role="status" className="mb-4 rounded-lg bg-ok/10 px-3 py-3 text-body font-semibold text-ok">
          {done}
        </p>
      ) : null}

      {/* Bo'lim */}
      <section aria-labelledby="dept-h">
        <h2 id="dept-h" className="field-label">
          Bo‘lim
        </h2>
        {edit ? (
          <p className="text-title">{dept.name}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {departments.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => pickDept(d.id)}
                aria-pressed={d.id === deptId}
                className={clsx(
                  'min-h-[48px] rounded-lg border px-3 py-2 text-left text-meta font-semibold leading-tight transition',
                  d.id === deptId ? 'border-ink bg-ink text-plane' : 'border-line bg-surface text-ink hover:bg-raised',
                )}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-meta text-muted">
          Sana: <span className="tnum font-semibold text-ink">{edit?.date ?? today}</span>
          {edit ? null : ' (bugun)'}
        </p>
      </section>

      <div className="mt-4">
        <label className="field-label" htmlFor="subject">
          Kim / nima tekshirildi (ixtiyoriy)
        </label>
        <input
          id="subject"
          className="field min-h-[44px]"
          placeholder="Operator, smena yoki jo‘natma raqami"
          value={draft.subject}
          maxLength={200}
          onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
        />
      </div>

      {/* Nuqtalar */}
      <ol className="mt-5 space-y-3">
        {active.map((c, i) => {
          const a = draft.answers[c.id];
          const note = draft.notes[c.id] ?? { text: '', ref: '' };
          const task = draft.tasks[c.id] ?? { what: '', owner: '', due: defaultDue(today) };
          return (
            <li key={c.id} className={clsx('card p-3.5', a === 'no' && 'border-bad/50')}>
              <div className="flex items-start gap-2">
                <span className="tnum mt-0.5 text-meta font-semibold text-muted">{i + 1}.</span>
                <p className="min-w-0 flex-1 text-body font-medium">{c.text}</p>
                {c.critical ? (
                  <span className="shrink-0 rounded-md bg-bad px-2 py-0.5 text-micro font-semibold text-white">
                    Jiddiy
                  </span>
                ) : null}
              </div>

              <div role="group" aria-label={c.text} className="mt-3 grid grid-cols-3 gap-2">
                {ANSWER_BTN.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    aria-pressed={a === b.value}
                    onClick={() => setAnswer(c.id, b.value)}
                    className={clsx(
                      'min-h-[48px] rounded-lg border px-1.5 text-meta font-semibold leading-tight transition',
                      a === b.value ? b.on : 'border-line bg-surface text-ink hover:bg-raised',
                    )}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              {a === 'no' ? (
                <div className="mt-3 space-y-3 rounded-tile bg-bad/5 p-3">
                  <div>
                    <label className="field-label" htmlFor={`note-${c.id}`}>
                      Izoh (majburiy)
                    </label>
                    <textarea
                      id={`note-${c.id}`}
                      className="field min-h-[72px]"
                      placeholder="Nima topildi?"
                      value={note.text}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, notes: { ...d.notes, [c.id]: { ...note, text: e.target.value } } }))
                      }
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`ref-${c.id}`}>
                      Dalil raqami (ixtiyoriy)
                    </label>
                    <input
                      id={`ref-${c.id}`}
                      className="field min-h-[44px]"
                      placeholder="Murojaat raqami, audio vaqti"
                      value={note.ref}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, notes: { ...d.notes, [c.id]: { ...note, ref: e.target.value } } }))
                      }
                    />
                  </div>
                  <fieldset className="space-y-3 border-t border-bad/20 pt-3">
                    <legend className="field-label">Topshiriq</legend>
                    <div>
                      <label className="field-label" htmlFor={`what-${c.id}`}>
                        Nima qilinishi kerak
                      </label>
                      <input
                        id={`what-${c.id}`}
                        className="field min-h-[44px]"
                        value={task.what}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, tasks: { ...d.tasks, [c.id]: { ...task, what: e.target.value } } }))
                        }
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="field-label" htmlFor={`owner-${c.id}`}>
                          Mas‘ul
                        </label>
                        <input
                          id={`owner-${c.id}`}
                          className="field min-h-[44px]"
                          value={task.owner}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              tasks: { ...d.tasks, [c.id]: { ...task, owner: e.target.value } },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`due-${c.id}`}>
                          Muddat
                        </label>
                        <input
                          id={`due-${c.id}`}
                          type="date"
                          className="field min-h-[44px]"
                          value={task.due}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, tasks: { ...d.tasks, [c.id]: { ...task, due: e.target.value } } }))
                          }
                        />
                      </div>
                    </div>
                  </fieldset>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Pastki panel: javoblar soni, jonli ball, Saqlash */}
      <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-[1100px] px-4 py-2.5">
          {error ? (
            <p role="alert" className="mb-2 rounded-lg bg-bad/10 px-3 py-2 text-meta font-medium text-bad">
              {error}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <div className="tnum min-w-[92px] leading-tight">
              <p className="text-title">
                {answered} / {active.length}
              </p>
              <p className="text-micro text-muted">Ball: {live === null ? '—' : `${Math.round(live)}%`}</p>
            </div>
            <button
              type="button"
              className="btn-primary min-h-[52px] flex-1 text-body"
              disabled={pending}
              onClick={submit}
            >
              {pending ? 'Saqlanmoqda…' : 'Saqlash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
