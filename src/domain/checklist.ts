/**
 * Checklist auditlari — baholash 0/1/2 shkalasi bo'yicha.
 * Manba: 'Checklist Ombor-RS / Filial / Murojaat' varaqlari.
 *
 * Xulosa pog'onalari Excel formulasidan aynan:
 *   ≥90% Yaxshi · ≥75% Qoniqarli · ≥60% Past (7 kunda qayta tekshiruv) · aks holda eskalatsiya
 */

export type AuditVerdictLevel = 'GOOD' | 'ACCEPTABLE' | 'LOW' | 'FAIL';

export interface AuditVerdict {
  level: AuditVerdictLevel;
  label: string;
  /** Rahbariyatga eskalatsiya talab etiladimi */
  escalate: boolean;
  /** 7 kun ichida qayta tekshiruv kerakmi */
  recheck: boolean;
}

const VERDICTS: ReadonlyArray<{ min: number; verdict: AuditVerdict }> = [
  {
    min: 0.9,
    verdict: { level: 'GOOD', label: 'Yaxshi — chora talab etilmaydi', escalate: false, recheck: false },
  },
  {
    min: 0.75,
    verdict: {
      level: 'ACCEPTABLE',
      label: 'Qoniqarli — kamchilik bartaraf etilsin',
      escalate: false,
      recheck: false,
    },
  },
  {
    min: 0.6,
    verdict: { level: 'LOW', label: 'Past — 7 kunda qayta tekshiruv', escalate: false, recheck: true },
  },
  {
    min: Number.NEGATIVE_INFINITY,
    verdict: {
      level: 'FAIL',
      label: 'Qoniqarsiz — rahbariyatga eskalatsiya',
      escalate: true,
      recheck: true,
    },
  },
];

export function verdictOf(percent: number): AuditVerdict {
  return VERDICTS.find((v) => percent >= v.min)!.verdict;
}

export interface AuditAnswerInput {
  itemId: number;
  score: number;
  note?: string | null;
}

export interface AuditItemSpec {
  id: number;
  no: number;
  max: number;
}

export interface AuditScore {
  totalScore: number;
  maxScore: number;
  percent: number;
  verdict: AuditVerdict;
  /** 0 yoki 1 baho olgan bandlar — ularga dalil yozilishi SHART */
  weakItems: number[];
  /** Dalil yozilmagan 0/1 bandlar — saqlashga to'sqinlik qiladi */
  missingEvidence: number[];
}

export function scoreAudit(items: AuditItemSpec[], answers: AuditAnswerInput[]): AuditScore {
  const byItem = new Map(answers.map((a) => [a.itemId, a]));

  let totalScore = 0;
  let maxScore = 0;
  const weakItems: number[] = [];
  const missingEvidence: number[] = [];

  for (const item of items) {
    maxScore += item.max;
    const answer = byItem.get(item.id);
    if (!answer) continue;

    const score = clamp(answer.score, 0, item.max);
    totalScore += score;

    if (score < item.max) {
      weakItems.push(item.no);
      if (!answer.note || answer.note.trim().length === 0) missingEvidence.push(item.no);
    }
  }

  const percent = maxScore > 0 ? totalScore / maxScore : 0;

  return {
    totalScore,
    maxScore,
    percent: Math.round(percent * 10000) / 10000,
    verdict: verdictOf(percent),
    weakItems,
    missingEvidence,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}
