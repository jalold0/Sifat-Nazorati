/**
 * O'quv moduli o'qish modellari (brauzerga uzatiladigan oddiy obyektlar).
 */

import type { Day, PublicQuestion, TrainingStatus } from './training';

export interface TrainingDto {
  deptId: string;
  deptName: string;
  title: string;
  intro: string;
  passPct: number;
  days: Day[];
  questionCount: number;
  /** Xodimning belgilagan topshiriqlari: d1t0, … */
  done: string[];
  progress: { done: number; total: number; complete: boolean };
  attempts: number;
  lastPct: number | null;
  status: TrainingStatus;
}

export interface TestDto {
  deptId: string;
  deptName: string;
  title: string;
  passPct: number;
  questions: PublicQuestion[];
}

export interface SubmitResult {
  score: number;
  total: number;
  pct: number;
  passed: boolean;
  review: Array<{ id: string; chosen: number; answer: number; why: string; correct: boolean }>;
}

export interface AttemptDto {
  id: string;
  at: string;
  score: number;
  total: number;
  pct: number;
  passed: boolean;
  /** Xato qilingan savollar (keys matni) — zaif mavzuni topish uchun. */
  wrong: Array<{ id: string; case: string }>;
}

export interface ProgressRow {
  userId: string;
  userName: string;
  deptId: string | null;
  deptName: string | null;
  done: number;
  total: number;
  status: TrainingStatus;
  lastPct: number | null;
  bestPct: number | null;
  lastAt: string | null;
  attempts: AttemptDto[];
}
