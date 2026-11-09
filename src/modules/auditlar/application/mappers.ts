import type { Checkpoint } from '@/modules/bolimlar/domain';

import { type AuditDto, scoreAnswers } from '../domain';

import type { AuditRecord } from './ports';

/** Saqlangan tekshiruv → brauzerga uzatiladigan DTO (ball shu yerda hisoblanadi, saqlanmaydi). */
export function toAuditDto(a: AuditRecord, checkpoints: Checkpoint[]): AuditDto {
  return {
    list: a.list,
    staffId: a.staffId,
    staffName: a.staffName,
    channel: a.channel,
    id: a.id,
    dept: a.deptId,
    date: a.date,
    by: a.byId,
    byName: a.byName,
    subject: a.subject,
    answers: a.answers,
    notes: a.notes,
    critical: a.critical,
    staff: a.staff,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    noCount: Object.values(a.answers).filter((v) => v === 'no').length,
    scorePct: scoreAnswers(a.answers, checkpoints, a.weights, a.staff).pct,
  };
}
