'use client';

import { useActionState, useState } from 'react';

import { resolveOwnerAt, type AssignmentWindow } from '@/domain/assignment';

import { createTicketAction, type FormState } from './actions';

/** Biriktirish oralig'i — server tomondan ISO satr sifatida keladi */
export interface AssignmentOption {
  ownerId: string;
  backupId: string | null;
  from: string;
  until: string | null;
}

export interface TaskOption {
  id: number;
  no: number;
  zoneCode: string;
  title: string;
  ownerId: string;
  slaHours: number | null;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  kind: 'PROACTIVE' | 'REACTIVE';
  source: string;
  assignments: AssignmentOption[];
}

export interface UserOption {
  id: string;
  shortName: string;
}

const PRIORITIES = [
  ['CRITICAL', 'Kritik'],
  ['HIGH', 'Yuqori'],
  ['MEDIUM', "O'rta"],
  ['LOW', 'Past'],
] as const;

const CHANNELS = [
  'Telegram',
  '102 tizimi',
  'Qo‘mita (rasmiy xat)',
  'Call center',
  'Filiallar',
  'Hamkor (EMU/BTS/Uzpost/Starex)',
  'Viloyat RS',
  'Ombor',
  'CRM',
  'IT',
  'Moliya',
  'Sotuv',
  'Rahbariyat',
  'Ichki tekshiruv',
];

/**
 * Murojaat kiritish shakli.
 * Vazifa katalogidan tanlash mas'ul, SLA, ustuvorlik va turni avtomatik to'ldiradi —
 * shu bilan reyestr yuritish tezlashadi va xatolar kamayadi.
 */
export function TicketForm({
  tasks,
  users,
  defaultOwnerId,
  today,
  now,
}: {
  tasks: TaskOption[];
  users: UserOption[];
  defaultOwnerId: string;
  today: string;
  now: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createTicketAction, {});

  const [taskId, setTaskId] = useState('');
  const [zoneCode, setZoneCode] = useState('C');
  const [ownerId, setOwnerId] = useState(defaultOwnerId);
  const [priority, setPriority] = useState<string>('HIGH');
  const [kind, setKind] = useState<string>('REACTIVE');
  const [slaHours, setSlaHours] = useState('4');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [reportDate, setReportDate] = useState(today);
  const [historyNote, setHistoryNote] = useState<string | null>(null);

  const windowsOf = (task: TaskOption): AssignmentWindow[] =>
    task.assignments.map((a, i) => ({
      id: i,
      ownerId: a.ownerId,
      backupId: a.backupId,
      from: new Date(a.from),
      until: a.until === null ? null : new Date(a.until),
    }));

  /**
   * Mas'ulni murojaat SANASIGA qarab aniqlaydi.
   * Vazifa qayta biriktirilgan bo'lsa, orqaga sana bilan kiritilgan murojaat
   * o'sha paytda javob bergan xodimga tushishi kerak — joriy mas'ulga emas.
   */
  function applyOwnerFor(task: TaskOption | undefined, dateValue: string) {
    if (!task) return;
    const at = new Date(`${dateValue}T12:00:00.000Z`);
    const w = resolveOwnerAt(windowsOf(task), at);
    const resolved = w?.ownerId ?? task.ownerId;
    setOwnerId(resolved);

    const isHistoric = w !== null && w.ownerId !== task.ownerId;
    setHistoryNote(
      isHistoric
        ? `Bu sanada vazifa boshqa xodimda bo'lgan — mas'ul shu bo'yicha tanlandi. Joriy mas'ul boshqa.`
        : null,
    );
  }

  function applyTask(value: string) {
    setTaskId(value);
    const task = tasks.find((t) => String(t.id) === value);
    if (!task) {
      setHistoryNote(null);
      return;
    }
    setZoneCode(task.zoneCode);
    setPriority(task.priority);
    setKind(task.kind);
    setSlaHours(String(task.slaHours ?? 24));
    setCategory(task.title.length > 60 ? `${task.title.slice(0, 60)}…` : task.title);
    applyOwnerFor(task, reportDate);
  }

  function applyDate(value: string) {
    setReportDate(value);
    applyOwnerFor(
      tasks.find((t) => String(t.id) === taskId),
      value,
    );
  }

  const closed = status === 'CLOSED';

  return (
    <form action={action} className="space-y-5">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="taskDefId">
            Vazifa katalogidan tanlash (tavsiya etiladi)
          </label>
          <select
            id="taskDefId"
            name="taskDefId"
            className="field"
            value={taskId}
            onChange={(e) => applyTask(e.target.value)}
          >
            <option value="">— katalogsiz, qo'lda to'ldiraman —</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.no}. [{t.zoneCode}] {t.title}
              </option>
            ))}
          </select>
          <p className="mt-1 text-micro text-muted">
            Tanlansa — zona, mas'ul, SLA, ustuvorlik va ish turi avtomatik to'ldiriladi.
          </p>
        </div>

        <div>
          <label className="field-label" htmlFor="date">
            Hisobot sanasi
          </label>
          <input
            id="date"
            name="date"
            type="date"
            className="field"
            value={reportDate}
            onChange={(e) => applyDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="receivedAt">
            Qabul qilingan vaqt
          </label>
          <input
            id="receivedAt"
            name="receivedAt"
            type="datetime-local"
            className="field"
            defaultValue={now}
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="channel">
            Kanal / manba
          </label>
          <input
            id="channel"
            name="channel"
            className="field"
            list="channel-list"
            defaultValue="Telegram"
            required
          />
          <datalist id="channel-list">
            {CHANNELS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="field-label" htmlFor="zoneCode">
            Zona
          </label>
          <select
            id="zoneCode"
            name="zoneCode"
            className="field"
            value={zoneCode}
            onChange={(e) => setZoneCode(e.target.value)}
          >
            <option value="A">A — Ombor va yuk</option>
            <option value="B">B — Yuk oqimi va status</option>
            <option value="C">C — Tashqi murojaat va mijoz</option>
            <option value="D">D — Boshqaruv va tahlil</option>
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="ownerId">
            Mas'ul
          </label>
          <select
            id="ownerId"
            name="ownerId"
            className="field"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            required
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.shortName}
              </option>
            ))}
          </select>
          {historyNote ? <p className="mt-1 text-micro font-medium text-warn">{historyNote}</p> : null}
        </div>

        <div>
          <label className="field-label" htmlFor="category">
            Vazifa turi
          </label>
          <input
            id="category"
            name="category"
            className="field"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="masalan: Mijoz murojaati"
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="objectName">
            Ob'ekt (filial / RS / ombor)
          </label>
          <input id="objectName" name="objectName" className="field" placeholder="masalan: Chilonzor filiali" />
        </div>

        <div>
          <label className="field-label" htmlFor="externalRef">
            Trek raqami / tashqi ID
          </label>
          <input id="externalRef" name="externalRef" className="field" placeholder="masalan: 78559075351587" />
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="description">
            Muammo tavsifi
          </label>
          <textarea id="description" name="description" className="field min-h-[76px]" required />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="field-label" htmlFor="priority">
            Ustuvorlik
          </label>
          <select
            id="priority"
            name="priority"
            className="field"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {PRIORITIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="kind">
            Ish turi
          </label>
          <select id="kind" name="kind" className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="REACTIVE">Reaktiv</option>
            <option value="PROACTIVE">Proaktiv</option>
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="slaHours">
            SLA (soat)
          </label>
          <input
            id="slaHours"
            name="slaHours"
            type="number"
            min={1}
            max={720}
            className="field"
            value={slaHours}
            onChange={(e) => setSlaHours(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="status">
            Holat
          </label>
          <select
            id="status"
            name="status"
            className="field"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="OPEN">Ochiq</option>
            <option value="IN_PROGRESS">Ishlanmoqda</option>
            <option value="ESCALATED">Eskalatsiya</option>
            <option value="CLOSED">Yopilgan</option>
          </select>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="field-label" htmlFor="firstResponseAt">
            Birinchi javob vaqti
          </label>
          <input id="firstResponseAt" name="firstResponseAt" type="datetime-local" className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="escalatedAt">
            Eskalatsiya vaqti
          </label>
          <input id="escalatedAt" name="escalatedAt" type="datetime-local" className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="closedAt">
            Yopilgan vaqti
          </label>
          <input
            id="closedAt"
            name="closedAt"
            type="datetime-local"
            className="field"
            required={closed}
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="spentHours">
            Sarflangan vaqt (soat)
          </label>
          <input
            id="spentHours"
            name="spentHours"
            type="number"
            step="0.01"
            min={0}
            className="field"
            placeholder="masalan: 2.42"
          />
          <p className="mt-1 text-micro text-muted">
            Xronometraj — vaqt normasi va shtat hisobi shu ustundan chiqadi.
          </p>
        </div>

        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2.5 text-body">
            <input type="checkbox" name="isRepeat" className="h-4 w-4 accent-[var(--brand)]" />
            Takroriy muammo (shu masala avval ham bo'lgan)
          </label>
        </div>

        <div>
          <label className="field-label" htmlFor="rootCause">
            Sabab (root cause){closed ? ' — majburiy' : ''}
          </label>
          <textarea
            id="rootCause"
            name="rootCause"
            className="field min-h-[64px]"
            placeholder="Nima uchun bu holat yuz berdi?"
            required={closed}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="actionTaken">
            Ko'rilgan chora
          </label>
          <textarea id="actionTaken" name="actionTaken" className="field min-h-[64px]" />
        </div>
      </fieldset>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-meta font-medium text-bad">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rounded-lg bg-ok/10 px-3 py-2 text-meta font-medium text-ok">
          {state.ok} — KPI ko'rsatkichlari qayta hisoblandi.
        </p>
      ) : null}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Saqlanmoqda…' : 'Reyestrga qo‘shish'}
        </button>
        <button type="reset" className="btn-ghost">
          Tozalash
        </button>
      </div>
    </form>
  );
}
