import type { DeptDto } from '@/modules/bolimlar/domain';
import type { Actor } from '@/shared/actor';
import type { JournalWriter } from '@/shared/journal';
import type { ListKind } from '@/shared/lists';
import type { Tx, UnitOfWork } from '@/shared/unit-of-work';

import type { Answer, AuditRec, StaffBlock, TaskDto, TaskInput, TaskRec, TaskTab } from '../domain';

/** Saqlangan tekshiruv (bazadagi ko'rinishga yaqin; DTO'ga use-case aylantiradi). */
export interface AuditRecord {
  id: string;
  deptId: string;
  date: string;
  byId: string;
  byName: string;
  subject: string;
  answers: Record<string, Answer>;
  notes: Record<string, { text: string; ref: string }>;
  critical: boolean;
  /** Kiritilgan paytdagi og'irliklar (eski yozuvda null). */
  weights: Record<string, number> | null;
  staff: StaffBlock | null;
  list: ListKind;
  staffId: string | null;
  staffName: string | null;
  channel: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Yangi tekshiruv: use-case hamma qiymatni (jumladan `critical` va qotirilgan `weights`) hisoblab beradi. */
export interface NewAudit {
  deptId: string;
  date: string;
  byId: string;
  answers: Record<string, Answer>;
  notes: Record<string, { text: string; ref: string }>;
  subject: string;
  staff: StaffBlock | null;
  list: ListKind;
  staffId: string | null;
  channel: string | null;
  critical: boolean;
  weights: Record<string, number>;
}

export type AuditChange = Omit<NewAudit, 'deptId' | 'byId' | 'list'>;

export interface AuditRepository {
  list(
    filter: { deptId?: string; from?: string; to?: string; list?: ListKind },
    page: { take: number; skip: number },
  ): Promise<{ rows: AuditRecord[]; total: number }>;
  get(id: string): Promise<AuditRecord | null>;
  create(audit: NewAudit): Promise<string>;
  update(id: string, change: AuditChange): Promise<void>;
  /** Topshiriqlari bilan birga o'chiradi. */
  delete(id: string): Promise<void>;
  /** Hisob uchun xom yozuvlar. */
  inRange(deptIds: string[], from: string, to: string): Promise<AuditRec[]>;
}

export interface TaskRepository {
  list(filter: { deptId?: string; status?: 'open' | 'closed'; dueBefore?: string }): Promise<TaskDto[]>;
  ofAudit(auditId: string): Promise<TaskDto[]>;
  /** Bir varaq (sahifalangan) va uchala varaqdagi sonlar. */
  tab(q: { tab: TaskTab; deptId?: string; today: string; offset: number }): Promise<{
    rows: TaskDto[];
    total: number;
    counts: Record<TaskTab, number>;
  }>;
  find(id: string): Promise<TaskDto | null>;
  close(id: string, c: { byId: string; on: string; note: string }): Promise<void>;
  update(id: string, c: { what: string; owner: string; due: string }): Promise<void>;
  createMany(auditId: string, deptId: string, tasks: TaskInput[]): Promise<void>;
  deleteOpen(auditId: string): Promise<void>;
  /** Tekshiruvda topshirig'i allaqachon bor nuqtalar (yopilgan ham). */
  checkpointsWithTasks(auditId: string): Promise<string[]>;
  /** Hisob uchun xom yozuvlar: muddati `from` dan keyin yoki hali ochiq/yaqinda yopilganlar. */
  forSummary(deptIds: string[], from: string): Promise<TaskRec[]>;
}

/** Boshqa modul (`bolimlar`) ochiq API'si orqali olinadigan bo'limlar. */
export interface DepartmentLookup {
  find(id: string): Promise<DeptDto | null>;
  list(actor: Actor, opts: { includeInactive?: boolean }): Promise<DeptDto[]>;
}

export interface AuditDeps {
  uow: UnitOfWork;
  audits(tx?: Tx): AuditRepository;
  tasks(tx?: Tx): TaskRepository;
  journal(tx?: Tx): JournalWriter;
  departments: DepartmentLookup;
  now(): Date;
}
