import type { DeptDto } from '../domain';
import type { CheckpointKind } from '../domain';
import type { ListKind } from '@/shared/lists';
import type { JournalWriter } from '@/shared/journal';
import type { Tx, UnitOfWork } from '@/shared/unit-of-work';

/** Saqlash rejasi: use-case hamma qarorni (id berish, tartib) qabul qilgan, repozitoriy faqat yozadi. */
export interface DeptSavePlan {
  /** Bor bo'lsa — yangilanadi, yo'q bo'lsa — yaratiladi. */
  id?: string;
  name: string;
  norm: number;
  estimate: boolean;
  active: boolean;
  /** Yangi bo'limning panel tartibi. */
  position?: number;
  checkpoints: Array<{
    id: string;
    isNew: boolean;
    text: string;
    group: string | null;
    weight: number;
    critical: boolean;
    active: boolean;
    kind: CheckpointKind;
    okLabel: string | null;
    badLabel: string | null;
    list: ListKind;
  }>;
  /** Bo'lmasa — hodimlarga tegilmaydi. */
  staff?: Array<{ id?: string; name: string; role: string; active: boolean }>;
}

export interface DepartmentRepository {
  list(q: { scope: string | null; includeInactive: boolean }): Promise<DeptDto[]>;
  get(id: string): Promise<DeptDto | null>;
  /** Shu nomli (katta-kichik harfga e'tiborsiz) boshqa bo'lim bormi. */
  nameTaken(name: string, exceptId?: string): Promise<boolean>;
  nextPosition(): Promise<number>;
  save(plan: DeptSavePlan): Promise<string>;
  /** Hamma bo'lim: panel tartibida. */
  order(): Promise<Array<{ id: string; name: string }>>;
  setOrder(ids: string[]): Promise<void>;
}

export interface DepartmentDeps {
  uow: UnitOfWork;
  departments(tx?: Tx): DepartmentRepository;
  journal(tx?: Tx): JournalWriter;
}
