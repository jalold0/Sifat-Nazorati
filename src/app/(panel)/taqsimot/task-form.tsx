'use client';

import { useActionState, useState } from 'react';

import { FREQUENCIES, KIND_OPTIONS, PRIORITY_OPTIONS, ZONE_OPTIONS } from '@/domain/task';

import { createTaskAction, updateTaskAction, type ReassignState } from './actions';

export interface UserOption {
  id: string;
  shortName: string;
}

export interface TaskFormValues {
  title: string;
  source: string;
  zoneCode: string;
  frequency: string;
  slaHours: number | null;
  priority: string;
  kind: string;
}

const EMPTY: TaskFormValues = {
  title: '',
  source: '',
  zoneCode: 'C',
  frequency: 'Kunlik',
  slaHours: 24,
  priority: 'MEDIUM',
  kind: 'REACTIVE',
};

const SOURCES = [
  'CRM',
  'Ombor / CRM',
  'Ichki tizim',
  'Telegram',
  'Davlat portali',
  'Rasmiy xat',
  'Call center',
  'Filiallar',
  'Hamkor',
  'Checklist',
  'Joyida',
  'Analitika',
  'IT',
  'Moliya',
  'Sotuv',
  'Rahbariyat',
  'HR',
];

/**
 * Vazifa maydonlari shakli — qo'shish va tahrirlash uchun bir xil.
 *
 * Mas'ul/zaxira faqat YARATISHDA tanlanadi. Tahrirlashda ular ko'rinmaydi:
 * almashtirish "Qayta biriktirish" orqali, sanasi va sababi bilan bajariladi —
 * shunda o'tgan davr hisoboti buzilmaydi.
 */
export function TaskForm({
  mode,
  taskNo,
  initial,
  users,
  defaultOwnerId,
  onDone,
}: {
  mode: 'create' | 'edit';
  taskNo?: number;
  initial?: TaskFormValues;
  users?: UserOption[];
  defaultOwnerId?: string;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState<ReassignState, FormData>(
    mode === 'create' ? createTaskAction : updateTaskAction,
    {},
  );

  const start = initial ?? EMPTY;
  const [priority, setPriority] = useState(start.priority);
  const [slaHours, setSlaHours] = useState(start.slaHours === null ? '' : String(start.slaHours));
  const [ownerId, setOwnerId] = useState(defaultOwnerId ?? users?.[0]?.id ?? '');
  const [backupId, setBackupId] = useState('');

  // Kritik ustuvorlikda SLA majburiy — usiz kechikishni o'lchab bo'lmaydi
  const slaRequired = priority === 'CRITICAL';

  return (
    <form action={action} className="space-y-4">
      {mode === 'edit' && taskNo !== undefined ? <input type="hidden" name="taskNo" value={taskNo} /> : null}

      <div>
        <label className="field-label" htmlFor={`title-${mode}`}>
          Vazifa nomi
        </label>
        <input
          id={`title-${mode}`}
          name="title"
          className="field"
          defaultValue={start.title}
          placeholder="masalan: Kunlik yuk nazorati (CRM) — butun tarmoq kesimida"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="field-label" htmlFor={`zone-${mode}`}>
            Zona
          </label>
          <select id={`zone-${mode}`} name="zoneCode" className="field" defaultValue={start.zoneCode}>
            {ZONE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor={`source-${mode}`}>
            Manba / kanal
          </label>
          <input
            id={`source-${mode}`}
            name="source"
            className="field"
            list={`sources-${mode}`}
            defaultValue={start.source}
            required
          />
          <datalist id={`sources-${mode}`}>
            {SOURCES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="field-label" htmlFor={`freq-${mode}`}>
            Davriylik
          </label>
          <select id={`freq-${mode}`} name="frequency" className="field" defaultValue={start.frequency}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor={`kind-${mode}`}>
            Ish turi
          </label>
          <select id={`kind-${mode}`} name="kind" className="field" defaultValue={start.kind}>
            {KIND_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor={`priority-${mode}`}>
            Ustuvorlik
          </label>
          <select
            id={`priority-${mode}`}
            name="priority"
            className="field"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {PRIORITY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor={`sla-${mode}`}>
            SLA (soat){slaRequired ? ' — majburiy' : ''}
          </label>
          <input
            id={`sla-${mode}`}
            name="slaHours"
            type="number"
            min={1}
            max={720}
            step={1}
            className="field"
            value={slaHours}
            onChange={(e) => setSlaHours(e.target.value)}
            placeholder={slaRequired ? 'majburiy' : 'bo‘sh — SLA yo‘q'}
            required={slaRequired}
          />
          <p className="mt-1 text-micro text-muted">
            {slaRequired
              ? 'Kritik ishda muddat belgilanishi shart.'
              : 'Proaktiv rejali ishlarda bo‘sh qoldirilishi mumkin.'}
          </p>
        </div>

        {mode === 'create' && users ? (
          <>
            <div>
              <label className="field-label" htmlFor="new-task-owner">
                Mas&apos;ul xodim
              </label>
              <select
                id="new-task-owner"
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
            </div>
            <div>
              <label className="field-label" htmlFor="new-task-backup">
                Zaxira xodim
              </label>
              <select
                id="new-task-backup"
                name="backupId"
                className="field"
                value={backupId}
                onChange={(e) => setBackupId(e.target.value)}
              >
                <option value="">— zaxirasiz —</option>
                {users
                  .filter((u) => u.id !== ownerId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.shortName}
                    </option>
                  ))}
              </select>
            </div>
          </>
        ) : null}
      </div>

      {mode === 'edit' ? (
        <p className="text-micro text-muted">
          Mas&apos;ul va zaxira bu yerda o&apos;zgarmaydi — ular &laquo;Boshqa xodimga biriktirish&raquo; orqali,
          sanasi va sababi bilan almashtiriladi. Shunda o&apos;tgan davr hisoboti buzilmaydi.
        </p>
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

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Saqlanmoqda…' : mode === 'create' ? 'Vazifani qo‘shish' : 'O‘zgarishni saqlash'}
        </button>
        {onDone ? (
          <button type="button" className="btn-ghost" onClick={onDone}>
            Yopish
          </button>
        ) : null}
      </div>
    </form>
  );
}

/** /taqsimot sahifasidagi "Yangi vazifa" bloki — bosilganda shakl ochiladi. */
export function CreateTaskPanel({ users, defaultOwnerId }: { users: UserOption[]; defaultOwnerId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        Yangi vazifa qo&apos;shish
      </button>
    );
  }

  return (
    <TaskForm
      mode="create"
      users={users}
      defaultOwnerId={defaultOwnerId}
      onDone={() => setOpen(false)}
    />
  );
}

/** Vazifa kartochkasidagi tahrirlash bloki. */
export function EditTaskPanel({ taskNo, initial }: { taskNo: number; initial: TaskFormValues }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
        Vazifani tahrirlash
      </button>
    );
  }

  return <TaskForm mode="edit" taskNo={taskNo} initial={initial} onDone={() => setOpen(false)} />;
}
