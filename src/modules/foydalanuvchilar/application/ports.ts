import type { Throttle } from '../domain';
import type { QcRole } from '@/shared/actor';
import type { JournalWriter } from '@/shared/journal';
import type { Tx, UnitOfWork } from '@/shared/unit-of-work';

export interface StoredUser {
  id: string;
  key: string;
  login: string;
  fullName: string;
  shortName: string;
  role: QcRole;
  deptId: string | null;
  active: boolean;
  passwordHash: string;
  mustChangePassword: boolean;
  sessionVersion: number;
}

export interface UserDto {
  id: string;
  login: string;
  fullName: string;
  role: QcRole;
  deptId: string | null;
  active: boolean;
}

export interface UserInput {
  id?: string;
  login?: string;
  fullName: string;
  role: QcRole;
  /** Ko'ruvchi va supervayzer uchun majburiy; boshqa rollar uchun e'tiborga olinmaydi. */
  deptId?: string | null;
  active: boolean;
  /** Yangi foydalanuvchi uchun majburiy; mavjudda — faqat to'ldirilsa almashtiriladi. */
  password?: string;
}

export interface NewUser {
  key: string;
  login: string;
  fullName: string;
  shortName: string;
  role: QcRole;
  position: string;
  deptId: string | null;
  active: boolean;
  passwordHash: string;
  mustChangePassword: boolean;
}

export interface UserPatch {
  fullName?: string;
  role?: QcRole;
  deptId?: string | null;
  active?: boolean;
  passwordHash?: string;
  mustChangePassword?: boolean;
  /** Sessiya versiyasini oshiradi: ochiq sessiyalar bekor bo'ladi. */
  revokeSessions?: boolean;
}

export interface UserRepository {
  findByLogin(login: string): Promise<StoredUser | null>;
  findById(id: string): Promise<StoredUser | null>;
  list(): Promise<UserDto[]>;
  /** Ko'ruvchi/supervayzerga biriktiriladigan bo'lim bormi. */
  departmentExists(id: string): Promise<boolean>;
  create(data: NewUser): Promise<string>;
  update(id: string, patch: UserPatch): Promise<void>;
  recordLogin(id: string, at: Date): Promise<void>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
  /** Login topilmaganda ham bir xil vaqt sarflash uchun HAQIQIY hash (vaqt bo'yicha loginni bilib bo'lmasin). */
  dummyHash(): Promise<string>;
}

/** Kirishdagi noto'g'ri urinishlarni cheklash: login va manzil bo'yicha. */
export interface LoginGuard {
  login: Throttle;
  ip: Throttle;
}

export interface UserDeps {
  uow: UnitOfWork;
  users(tx?: Tx): UserRepository;
  journal(tx?: Tx): JournalWriter;
  hasher: PasswordHasher;
  guard: LoginGuard;
}
