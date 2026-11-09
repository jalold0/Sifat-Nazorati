import type { Day, Question } from '../domain';

/** Bo'limning o'quv dasturi va testi. */
export interface ProgramRecord {
  deptId: string;
  deptName: string;
  deptPosition: number;
  title: string;
  intro: string;
  passPct: number;
  days: Day[];
  questions: Question[];
}

export interface AttemptRecord {
  id: string;
  userId: string;
  deptId: string;
  at: Date;
  score: number;
  total: number;
  pct: number;
  passed: boolean;
  /** Savol id → tanlangan variant. */
  answers: Record<string, number>;
}

export interface NewAttempt {
  userId: string;
  deptId: string;
  score: number;
  total: number;
  pct: number;
  passed: boolean;
  answers: unknown;
}

export interface TrainingRepository {
  /** Faqat faol bo'limlar yoki hammasi. */
  programs(opts: { activeOnly: boolean }): Promise<ProgramRecord[]>;
  program(deptId: string): Promise<ProgramRecord | null>;
  /** Belgilangan topshiriqlar (kalitlar). */
  doneTasks(filter: { userId?: string; deptId?: string }): Promise<Array<{ userId: string; deptId: string; key: string }>>;
  /** Bitta xodimning urinishlari (javoblarsiz — yengil). */
  attemptSummaries(userId: string): Promise<Array<{ deptId: string; at: Date; pct: number; passed: boolean }>>;
  /** Hamma urinishlar, eskisi birinchi (rahbar natijalari uchun). */
  allAttempts(): Promise<AttemptRecord[]>;
  addAttempt(attempt: NewAttempt): Promise<void>;
  markTask(userId: string, deptId: string, key: string, done: boolean): Promise<void>;
}

/** Foydalanuvchilar ro'yxati — `foydalanuvchilar` modulining ochiq API'si orqali. */
export interface ReviewerLookup {
  list(): Promise<Array<{ id: string; name: string }>>;
}

export interface TrainingDeps {
  training: TrainingRepository;
  reviewers: ReviewerLookup;
}
