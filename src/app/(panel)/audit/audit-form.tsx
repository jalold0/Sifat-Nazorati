'use client';

import { useActionState, useMemo, useState } from 'react';

import { verdictOf } from '@/domain/checklist';

import { createAuditAction, type AuditState } from './actions';

export interface TemplateItem {
  id: number;
  no: number;
  title: string;
  requirement: string;
  max: number;
}

export interface TemplateOption {
  kind: 'WAREHOUSE' | 'BRANCH' | 'CALL';
  title: string;
  note: string;
  items: TemplateItem[];
}

const SCORES = [
  { value: 2, label: '2 — to‘liq bajarilgan' },
  { value: 1, label: '1 — qisman, kamchilik bor' },
  { value: 0, label: '0 — bajarilmagan' },
];

/**
 * Checklist auditi shakli.
 * Ball va xulosa brauzerda darhol ko'rinadi, lekin haqiqiy hisob serverda qayta bajariladi.
 * 0 va 1 baholarga dalil yozilmasa, server saqlashni rad etadi.
 */
export function AuditForm({ templates, today }: { templates: TemplateOption[]; today: string }) {
  const [state, action, pending] = useActionState<AuditState, FormData>(createAuditAction, {});
  const [kind, setKind] = useState<TemplateOption['kind']>(templates[0]?.kind ?? 'BRANCH');
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const template = templates.find((t) => t.kind === kind);

  const live = useMemo(() => {
    if (!template) return null;
    const max = template.items.reduce((s, i) => s + i.max, 0);
    const total = template.items.reduce((s, i) => s + (answers[i.id] ?? 0), 0);
    const answered = template.items.filter((i) => answers[i.id] !== undefined).length;
    const percent = max > 0 ? total / max : 0;
    return { total, max, percent, answered, verdict: verdictOf(percent) };
  }, [template, answers]);

  function setKindAndReset(next: TemplateOption['kind']) {
    setKind(next);
    setAnswers({});
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="kind" value={kind} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="kindSelect">
            Checklist turi
          </label>
          <select
            id="kindSelect"
            className="field"
            value={kind}
            onChange={(e) => setKindAndReset(e.target.value as TemplateOption['kind'])}
          >
            {templates.map((t) => (
              <option key={t.kind} value={t.kind}>
                {t.title}
              </option>
            ))}
          </select>
          {template ? <p className="mt-1 text-micro text-muted">{template.note}</p> : null}
        </div>

        <div>
          <label className="field-label" htmlFor="objectName">
            {kind === 'CALL' ? 'Operator F.I.Sh.' : "Ob'ekt nomi"}
          </label>
          <input id="objectName" name="objectName" className="field" required />
        </div>

        <div>
          <label className="field-label" htmlFor="auditedAt">
            Tekshiruv sanasi
          </label>
          <input id="auditedAt" name="auditedAt" type="date" className="field" defaultValue={today} required />
        </div>

        <div>
          <label className="field-label" htmlFor="objectCode">
            Kod (filial/RS raqami)
          </label>
          <input id="objectCode" name="objectCode" className="field" />
        </div>

        <div>
          <label className="field-label" htmlFor="externalRef">
            Murojaat ID / trek
          </label>
          <input id="externalRef" name="externalRef" className="field" />
        </div>
      </div>

      {/* ── Bandlar ───────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="th w-8">№</th>
              <th className="th">Tekshiruv bandi</th>
              <th className="th w-[190px]">Baho</th>
              <th className="th">Izoh / dalil</th>
            </tr>
          </thead>
          <tbody>
            {template?.items.map((item) => {
              const value = answers[item.id];
              const weak = value !== undefined && value < item.max;
              return (
                <tr key={item.id} className={weak ? 'bg-bad/[0.04]' : undefined}>
                  <td className="td tnum text-muted">{item.no}</td>
                  <td className="td">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-0.5 text-micro text-muted">Talab: {item.requirement}</p>
                  </td>
                  <td className="td">
                    <select
                      name={`score-${item.id}`}
                      className="field !py-1.5 !text-meta"
                      value={value ?? ''}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))
                      }
                    >
                      <option value="">— baholanmagan —</option>
                      {SCORES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td">
                    <input
                      name={`note-${item.id}`}
                      className="field !py-1.5 !text-meta"
                      placeholder={weak ? 'Dalil majburiy: foto, hujjat raqami, trek' : 'ixtiyoriy'}
                      required={weak}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <label className="field-label" htmlFor="notes">
          Umumiy xulosa va tavsiyalar
        </label>
        <textarea id="notes" name="notes" className="field min-h-[70px]" />
      </div>

      {/* ── Joriy natija ──────────────────────────────────────────────────── */}
      {live ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-raised px-4 py-3">
          <div>
            <p className="eyebrow">Joriy natija</p>
            <p className="tnum mt-0.5 text-stat">
              {live.total} / {live.max}
              <span className="ml-2 text-body font-medium text-ink2">
                {Math.round(live.percent * 100)}%
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow">Xulosa</p>
            <p
              className={`mt-0.5 text-body font-semibold ${
                live.verdict.level === 'GOOD'
                  ? 'text-ok'
                  : live.verdict.level === 'ACCEPTABLE'
                    ? 'text-warn'
                    : 'text-bad'
              }`}
            >
              {live.verdict.label}
            </p>
            <p className="mt-0.5 text-micro text-muted">
              {live.answered} / {template?.items.length ?? 0} band baholandi
            </p>
          </div>
        </div>
      ) : null}

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

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Saqlanmoqda…' : 'Auditni saqlash'}
      </button>
    </form>
  );
}
