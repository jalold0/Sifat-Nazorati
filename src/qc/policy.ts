/**
 * Ruxsat qoidalari — SOF funksiyalar (server shularni har so'rovda tekshiradi, brauzerga ishonilmaydi).
 *
 * Rollar:
 *   HEAD      — Rahbar: hammasi.
 *   INSPECTOR — Tekshiruvchi: tekshiruv kiritadi, topshiriqni yopadi; o'zi kiritganini 24 soat ichida tuzatadi.
 *   VIEWER    — Ko'ruvchi: faqat o'z bo'limini o'qiydi.
 */

export type QcRole = 'HEAD' | 'INSPECTOR' | 'VIEWER';

export interface Actor {
  id: string;
  role: QcRole;
  /** Ko'ruvchining bo'limi. */
  deptId?: string | null;
}

export const EDIT_WINDOW_MS = 24 * 3_600_000;

export const QC_ROLE_LABEL: Record<QcRole, string> = {
  HEAD: 'Rahbar',
  INSPECTOR: 'Tekshiruvchi',
  VIEWER: 'Ko‘ruvchi',
};

/** Ko'ruvchi uchun faqat o'z bo'limi; qolganlar uchun null (cheklov yo'q). */
export function deptScope(actor: Actor): string | null {
  return actor.role === 'VIEWER' ? (actor.deptId ?? '__none__') : null;
}

export function canReadDept(actor: Actor, deptId: string): boolean {
  const scope = deptScope(actor);
  return scope === null || scope === deptId;
}

export function canManageDepartments(actor: Actor): boolean {
  return actor.role === 'HEAD';
}

export function canCreateAudit(actor: Actor): boolean {
  return actor.role === 'HEAD' || actor.role === 'INSPECTOR';
}

export function canEditAudit(actor: Actor, audit: { byId: string; createdAt: Date }, now: Date = new Date()): boolean {
  if (actor.role === 'HEAD') return true;
  if (actor.role !== 'INSPECTOR') return false;
  return audit.byId === actor.id && now.getTime() - audit.createdAt.getTime() <= EDIT_WINDOW_MS;
}

export function canDeleteAudit(actor: Actor): boolean {
  return actor.role === 'HEAD';
}

export function canEditTask(actor: Actor): boolean {
  return actor.role === 'HEAD' || actor.role === 'INSPECTOR';
}

export function canTrain(actor: Actor): boolean {
  return actor.role === 'HEAD' || actor.role === 'INSPECTOR';
}

/** Hamma xodimlarning o'quv natijalari. */
export function canSeeProgress(actor: Actor): boolean {
  return actor.role === 'HEAD';
}

export function canSeeReport(actor: Actor): boolean {
  return actor.role === 'HEAD' || actor.role === 'INSPECTOR';
}

export function canEditReport(actor: Actor): boolean {
  return actor.role === 'HEAD';
}

export function canExport(actor: Actor): boolean {
  return actor.role === 'HEAD' || actor.role === 'INSPECTOR';
}

/** Rolga mos bosh sahifa. */
export function homePath(role: QcRole): string {
  if (role === 'HEAD') return '/panel';
  if (role === 'INSPECTOR') return '/tekshiruv';
  return '/bolimim';
}

export interface NavEntry {
  href: string;
  label: string;
  roles: QcRole[];
}

/** Yuqori navigatsiya. Ko'ruvchiga faqat Bo'limim (o'quv va hisobot ekranlari unga yo'q). */
export const QC_NAV: NavEntry[] = [
  { href: '/panel', label: 'Panel', roles: ['HEAD'] },
  { href: '/tekshiruv', label: 'Tekshiruv', roles: ['HEAD', 'INSPECTOR'] },
  { href: '/topshiriqlar', label: 'Topshiriqlar', roles: ['HEAD', 'INSPECTOR'] },
  { href: '/tarix', label: 'Tarix', roles: ['HEAD', 'INSPECTOR'] },
  { href: '/oquv', label: 'O‘quv dasturi', roles: ['HEAD', 'INSPECTOR'] },
  { href: '/natijalar', label: 'Natijalar', roles: ['HEAD'] },
  { href: '/hisobot', label: 'Haftalik hisobot', roles: ['HEAD', 'INSPECTOR'] },
  { href: '/sozlamalar', label: 'Sozlamalar', roles: ['HEAD'] },
  { href: '/bolimim', label: 'Bo‘limim', roles: ['VIEWER'] },
];

export function navFor(role: QcRole): NavEntry[] {
  return QC_NAV.filter((n) => n.roles.includes(role));
}

/** Sahifa yo'li shu rolga ruxsat etilganmi (middleware/layout uchun). */
export function canOpenPath(role: QcRole, pathname: string): boolean {
  const entry = QC_NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
  return entry ? entry.roles.includes(role) : true;
}
