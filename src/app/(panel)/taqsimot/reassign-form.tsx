'use client';

import { useActionState, useState } from 'react';

import { reassignAction, type ReassignState } from './actions';

export interface UserOption {
  id: string;
  shortName: string;
}

/**
 * Vazifani qayta biriktirish shakli.
 *
 * Foydalanuvchiga aniq aytiladi: o'zgartirishgacha bajarilgan ish eski xodim
 * hisobida qoladi, yangi xodimning sanog'i kuchga kirish sanasidan boshlanadi.
 */
export function ReassignForm({
  taskNo,
  currentOwnerId,
  currentOwnerName,
  currentBackupId,
  users,
  today,
}: {
  taskNo: number;
  currentOwnerId: string;
  currentOwnerName: string;
  currentBackupId: string | null;
  users: UserOption[];
  today: string;
}) {
  const [state, action, pending] = useActionState<ReassignState, FormData>(reassignAction, {});
  const [ownerId, setOwnerId] = useState(currentOwnerId);
  const [backupId, setBackupId] = useState(currentBackupId ?? '');

  const changed = ownerId !== currentOwnerId || backupId !== (currentBackupId ?? '');
  const newOwnerName = users.find((u) => u.id === ownerId)?.shortName ?? '—';

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="taskNo" value={taskNo} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="field-label" htmlFor={`owner-${taskNo}`}>
            Mas'ul xodim
          </label>
          <select
            id={`owner-${taskNo}`}
            name="newOwnerId"
            className="field"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            required
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.shortName}
                {u.id === currentOwnerId ? ' (joriy)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor={`backup-${taskNo}`}>
            Zaxira xodim
          </label>
          <select
            id={`backup-${taskNo}`}
            name="newBackupId"
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
                  {u.id === currentBackupId ? ' (joriy)' : ''}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor={`from-${taskNo}`}>
            Qaysi sanadan kuchga kiradi
          </label>
          <input
            id={`from-${taskNo}`}
            name="effectiveFrom"
            type="date"
            className="field"
            defaultValue={today}
            max={today}
            required
          />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor={`reason-${taskNo}`}>
          Sabab — majburiy
        </label>
        <input
          id={`reason-${taskNo}`}
          name="reason"
          className="field"
          placeholder="masalan: yuklama muvozanati; xodim ta'tilga chiqdi; zona qayta taqsimlandi"
          required
        />
      </div>

      {changed ? (
        <div className="tile px-3.5 py-3">
          <p className="text-meta text-ink2">
            <b className="text-ink">Nima bo'ladi:</b> shu sanagacha qayd etilgan murojaatlar{' '}
            <b className="text-ink">{currentOwnerName}</b> hisobida qoladi — uning o'tgan davr KPI si va hisoboti
            o'zgarmaydi. Shu sanadan keyingi murojaatlar <b className="text-ink">{newOwnerName}</b> hisobiga tushadi,
            sanog'i noldan boshlanadi.
          </p>
          <p className="mt-1.5 text-micro text-muted">
            Ochiq turgan murojaatlar ko'chirilmaydi — ular allaqachon aniq xodimga biriktirilgan. Kerak bo'lsa
            reyestrda alohida o'zgartiriladi.
          </p>
        </div>
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

      <button type="submit" className="btn-primary" disabled={pending || !changed}>
        {pending ? 'Saqlanmoqda…' : 'Qayta biriktirish'}
      </button>
    </form>
  );
}
