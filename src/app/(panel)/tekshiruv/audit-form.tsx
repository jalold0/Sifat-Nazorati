'use client';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import type { DeptDto, StaffDto } from '@/modules/bolimlar/domain';
import type { TaskDto } from '@/server/qc';

import { saveAuditAction, updateAuditAction } from './actions';
import { ShiftRoster, StaffCard, toCell, type CellDraft } from './staff-inputs';

import { type Answer, defaultDue, derivedAnswer, scoreAnswers, type StaffBlock, type StaffCell, validateAudit } from '@/modules/auditlar/domain';
import { isStaffKind } from '@/modules/bolimlar/domain';
import { type Channel, CHANNELS, isChannel, isListKind, LIST_HINT, LIST_LABEL, LIST_ORDER, type ListKind, listOf } from '@/shared/lists';

interface TaskDraft {
  what: string;
  owner: string;
  due: string;
}
interface NoteDraft {
  text: string;
  ref: string;
}
interface Draft {
  subject: string;
  answers: Record<string, Answer>;
  notes: Record<string, NoteDraft>;
  tasks: Record<string, TaskDraft>;
  /** Smenadagi hodimlar (id). Bo'lmasa — bo'limning hamma faol hodimi. */
  people?: string[];
  /** { nuqtaId: { hodimId: yacheyka } } */
  staff: Record<string, Record<string, CellDraft>>;
  /** Muloqot bahosi: baholanayotgan operator va kanal */
  staffId?: string;
  channel?: Channel;
}

const EMPTY: Draft = { subject: '', answers: {}, notes: {}, tasks: {}, staff: {} };
const LAST_LIST = 'qc:lastList';

/** Saqlangan hodim blokini qoralamaga aylantiradi (tuzatish uchun). */
function draftStaff(block: StaffBlock | null): Pick<Draft, 'people' | 'staff'> {
  if (!block) return { staff: {} };
  const staff: Draft['staff'] = {};
  for (const [cp, cells] of Object.entries(block.results)) {
    staff[cp] = Object.fromEntries(
      Object.entries(cells).map(([pid, c]) => [
        pid,
        'v' in c
          ? { v: c.v === 'na' ? undefined : c.v, reason: c.reason }
          : { ok: String(c.ok), bad: String(c.bad), reason: c.reason },
      ]),
    );
  }
  return { people: block.people.map((p) => p.id), staff };
}
const LAST_DEPT = 'qc:lastDept';
/** Qoralama kaliti: bo'lim + cheklist (kunlik smena uchun eski kalit saqlangan). */
const draftKey = (deptId: string, list: ListKind = 'shift') => (list === 'shift' ? `qc:draft:${deptId}` : `qc:draft:${deptId}:${list}`);

/** localStorage ishlamasa (yopiq rejim, bloklangan) jim o'tkazib yuboriladi. */
const store = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* jim */
    }
  },
  del(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* jim */
    }
  },
};

export interface EditInitial {
  id: string;
  deptId: string;
  date: string;
  subject: string;
  answers: Record<string, Answer>;
  notes: Record<string, NoteDraft>;
  tasks: TaskDto[];
  staff: StaffBlock | null;
  list: ListKind;
  staffId: string | null;
  channel: string | null;
}

type Props =
  | { mode: 'create'; departments: DeptDto[]; today: string; lists: ListKind[] }
  | { mode: 'edit'; departments: DeptDto[]; today: string; initial: EditInitial };

const ANSWER_BTN: Array<{ value: Answer; label: string; on: string }> = [
  { value: 'yes', label: 'Ha', on: 'bg-ok text-white border-ok' },
  { value: 'no', label: 'Yo‘q', on: 'bg-bad text-white border-bad' },
  { value: 'na', label: 'Tegishli emas', on: 'bg-ink2 text-plane border-ink2' },
];

export function AuditForm(props: Props) {
  const { departments, today } = props;
  const router = useRouter();
  const edit = props.mode === 'edit' ? props.initial : null;

  const allowedLists = props.mode === 'create' ? props.lists : [edit!.list];

  const [deptId, setDeptId] = useState<string>(edit?.deptId ?? departments[0]?.id ?? '');
  const [list, setList] = useState<ListKind>(edit?.list ?? allowedLists[0] ?? 'shift');
  const [draft, setDraft] = useState<Draft>(() =>
    edit
      ? {
          subject: edit.subject,
          answers: edit.answers,
          notes: edit.notes,
          tasks: Object.fromEntries(
            edit.tasks.map((t) => [t.cp, { what: t.what, owner: t.owner, due: t.due }] as const).reverse(),
          ),
          ...draftStaff(edit.staff),
          staffId: edit.staffId ?? undefined,
          channel: isChannel(edit.channel) ? edit.channel : undefined,
        }
      : EMPTY,
  );
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ready = useRef(false);

  const dept = useMemo(() => departments.find((d) => d.id === deptId), [departments, deptId]);
  /** Shu bo'limda nuqtasi bor va kiritishga ruxsat etilgan cheklistlar. */
  const deptLists = useMemo(
    () => LIST_ORDER.filter((l) => allowedLists.includes(l) && dept?.checkpoints.some((c) => c.active && listOf(c.list) === l)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dept, allowedLists.join()],
  );
  const active = useMemo(
    () => dept?.checkpoints.filter((c) => c.active && listOf(c.list) === list) ?? [],
    [dept, list],
  );
  const isInteraction = list === 'interaction';
  const hasStaffCp = active.some((c) => isStaffKind(c.kind));

  // Tanlanadigan hodimlar: faollari; tuzatishda tekshiruvda bo'lgan (keyin yashirilgan) hodimlar ham
  const roster = useMemo<StaffDto[]>(() => {
    const all = dept?.staff ?? [];
    const keep = new Set(edit?.staff?.people.map((p) => p.id) ?? []);
    return all.filter((s) => s.active || keep.has(s.id));
  }, [dept, edit]);
  const presentIds = useMemo(() => {
    const ids = new Set(roster.map((s) => s.id));
    return (draft.people ?? roster.filter((s) => s.active).map((s) => s.id)).filter((id) => ids.has(id));
  }, [draft.people, roster]);
  const presentPeople = useMemo(() => roster.filter((s) => presentIds.includes(s.id)), [roster, presentIds]);

  /** Hodimli nuqtalar: to'ldirilgan yacheykalar (faqat smenadagilar). */
  const staffBlock = useMemo<StaffBlock | null>(() => {
    const results: StaffBlock['results'] = {};
    for (const c of active) {
      if (!isStaffKind(c.kind) || draft.answers[c.id] === 'na') continue;
      const cells: Record<string, StaffCell> = {};
      for (const p of presentPeople) {
        const cell = toCell(c.kind, draft.staff[c.id]?.[p.id]);
        if (cell) cells[p.id] = cell;
      }
      if (Object.keys(cells).length > 0) results[c.id] = cells;
    }
    return Object.keys(results).length > 0 ? { people: presentPeople.map((p) => ({ id: p.id, name: p.name })), results } : null;
  }, [active, draft.answers, draft.staff, presentPeople]);

  /** Bo'limda kiritsa bo'ladigan cheklist: so'ralgani bo'lsa o'sha, bo'lmasa birinchisi. */
  function listFor(id: string, want: ListKind | null): ListKind {
    const d = departments.find((x) => x.id === id);
    const avail = LIST_ORDER.filter((l) => allowedLists.includes(l) && d?.checkpoints.some((c) => c.active && listOf(c.list) === l));
    return want && avail.includes(want) ? want : (avail[0] ?? allowedLists[0] ?? 'shift');
  }

  function loadDraft(id: string, l: ListKind) {
    const saved = store.get(draftKey(id, l));
    try {
      setDraft(saved ? { ...EMPTY, ...(JSON.parse(saved) as Draft) } : EMPTY);
    } catch {
      setDraft(EMPTY); // buzuq qoralama e'tiborga olinmaydi
    }
  }

  // Oxirgi tanlangan bo'lim, cheklist va qoralamani tiklash (faqat yangi tekshiruvda)
  useEffect(() => {
    if (edit) return;
    const last = store.get(LAST_DEPT);
    const id = last && departments.some((d) => d.id === last) ? last : (departments[0]?.id ?? '');
    const lastList = store.get(LAST_LIST);
    const l = listFor(id, isListKind(lastList) ? lastList : null);
    setDeptId(id);
    setList(l);
    loadDraft(id, l);
    ready.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Qoralama: to'ldirilmagan shakl brauzerda saqlanadi
  useEffect(() => {
    if (edit || !ready.current || !deptId) return;
    // Hodim natijalari, smena tarkibi yoki operator tanlangan bo'lsa ham — qoralama saqlanadi
    const hasData =
      Object.keys(draft.answers).length > 0 ||
      draft.subject !== '' ||
      draft.people !== undefined ||
      draft.staffId !== undefined ||
      Object.values(draft.staff).some((cells) => Object.keys(cells).length > 0);
    if (hasData) store.set(draftKey(deptId, list), JSON.stringify(draft));
    else store.del(draftKey(deptId, list));
  }, [draft, deptId, list, edit]);

  function pickDept(id: string) {
    if (edit || id === deptId) return;
    const l = listFor(id, list);
    setDeptId(id);
    setList(l);
    store.set(LAST_DEPT, id);
    setError(null);
    setDone(null);
    loadDraft(id, l);
  }

  function pickList(l: ListKind) {
    if (edit || l === list) return;
    setList(l);
    store.set(LAST_LIST, l);
    setError(null);
    setDone(null);
    loadDraft(deptId, l);
  }

  function setAnswer(cpId: string, value: Answer) {
    setDone(null);
    setDraft((d) => {
      const next: Draft = { ...d, answers: { ...d.answers, [cpId]: value } };
      if (value === 'no') {
        next.notes = { ...d.notes, [cpId]: d.notes[cpId] ?? { text: '', ref: '' } };
        next.tasks = { ...d.tasks, [cpId]: d.tasks[cpId] ?? { what: '', owner: '', due: defaultDue(today) } };
      }
      return next;
    });
  }

  function setCell(cpId: string, personId: string, patch: Partial<CellDraft>) {
    setDone(null);
    setDraft((d) => ({
      ...d,
      staff: { ...d.staff, [cpId]: { ...d.staff[cpId], [personId]: { ...d.staff[cpId]?.[personId], ...patch } } },
    }));
  }

  function setAllYes(cpId: string) {
    setDone(null);
    setDraft((d) => {
      const cells = { ...d.staff[cpId] };
      for (const p of presentPeople) if (!cells[p.id]?.v) cells[p.id] = { ...cells[p.id], v: 'yes' };
      return { ...d, staff: { ...d.staff, [cpId]: cells } };
    });
  }

  function setNa(cpId: string, na: boolean) {
    setDone(null);
    setDraft((d) => {
      const answers = { ...d.answers };
      if (na) answers[cpId] = 'na';
      else delete answers[cpId];
      return { ...d, answers };
    });
  }

  /** Nuqta javobi: oddiy nuqtada — tanlangani; hodimlida — natijalardan hosil (to'liq bo'lsa). */
  const effective = useMemo(() => {
    const out: Record<string, Answer> = {};
    for (const c of active) {
      const a = draft.answers[c.id];
      if (!isStaffKind(c.kind)) {
        if (a) out[c.id] = a;
        continue;
      }
      if (a === 'na') {
        out[c.id] = 'na';
        continue;
      }
      const cells = staffBlock?.results[c.id];
      if (cells && presentPeople.length > 0 && Object.keys(cells).length === presentPeople.length) out[c.id] = derivedAnswer(cells);
    }
    return out;
  }, [active, draft.answers, staffBlock, presentPeople]);

  const answered = Object.keys(effective).length;
  const live = useMemo(() => scoreAnswers(effective, active, null, staffBlock).pct, [effective, active, staffBlock]);

  function buildBody() {
    const answers: Record<string, Answer> = {};
    const notes: Record<string, NoteDraft> = {};
    const tasks: Array<TaskDraft & { cp: string }> = [];
    for (const c of active) {
      if (isStaffKind(c.kind)) {
        // Hodimli nuqta javobini server natijalardan hosil qiladi; faqat «Tegishli emas» yuboriladi
        if (draft.answers[c.id] === 'na') answers[c.id] = 'na';
        continue;
      }
      const a = draft.answers[c.id];
      if (!a) continue;
      answers[c.id] = a;
      if (a === 'no') {
        notes[c.id] = draft.notes[c.id] ?? { text: '', ref: '' };
        // Muloqot bahosida topshiriq yo'q — operatorga murabbiylik hisobotda ko'rinadi
        if (!isInteraction) {
          const t = draft.tasks[c.id] ?? { what: '', owner: '', due: defaultDue(today) };
          tasks.push({ cp: c.id, ...t });
        }
      }
    }
    const staff = hasStaffCp
      ? {
          people: presentIds,
          results: Object.fromEntries(
            active
              .filter((c) => isStaffKind(c.kind) && draft.answers[c.id] !== 'na')
              .map((c) => [
                c.id,
                Object.fromEntries(
                  presentIds.flatMap((pid) => {
                    const cell = toCell(c.kind, draft.staff[c.id]?.[pid]);
                    return cell ? [[pid, cell]] : [];
                  }),
                ),
              ]),
          ),
        }
      : undefined;
    return {
      dept: deptId,
      date: edit?.date ?? today,
      subject: draft.subject,
      answers,
      notes,
      tasks,
      staff,
      list,
      ...(isInteraction ? { staffId: draft.staffId ?? '', channel: draft.channel ?? '' } : {}),
    };
  }

  function submit() {
    setError(null);
    setDone(null);
    if (!dept) return;
    const body = buildBody();
    // Brauzerda oldindan tekshirish — xatoni darhol ko'rsatadi (asl tekshiruv serverda)
    const check = validateAudit(body, dept.checkpoints, {
      today,
      allowPast: !!edit,
      requireComplete: !edit,
      roster: roster.map((s) => ({ id: s.id, name: s.name })),
      list,
    });
    if (!check.ok) {
      setError(check.error);
      return;
    }
    startTransition(async () => {
      try {
        const r = edit ? await updateAuditAction(edit.id, body) : await saveAuditAction(body);
        setOffline(false);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        if (edit) {
          router.push(`/tarix/${edit.id}`);
          return;
        }
        store.del(draftKey(deptId, list));
        // Muloqot bahosida keyingi muloqot uchun kanal saqlanadi (odatda bir kanalni ketma-ket baholaydi)
        setDraft(isInteraction ? { ...EMPTY, channel: draft.channel } : EMPTY);
        const who = isInteraction ? `, ${roster.find((s) => s.id === draft.staffId)?.name ?? ''}` : '';
        setDone(
          `Saqlandi: ${dept.name} · ${LIST_LABEL[list]}${who}${live === null ? '' : `, ball ${Math.round(live)}%`}. Keyingisini kiritishingiz mumkin.`,
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        // Tarmoq uzilgan: shakl ochiq qoladi, hech narsa yo'qolmaydi
        setOffline(true);
      }
    });
  }

  if (!dept) return null;

  return (
    <div className="pb-24">
      {offline ? (
        <p role="alert" className="mb-4 rounded-lg bg-bad/10 px-3 py-3 text-body font-semibold text-bad">
          Aloqa yo‘q, saqlanmadi. Shakl ochiq turibdi — aloqa tiklangach «Saqlash» ni qayta bosing.
        </p>
      ) : null}
      {done ? (
        <p role="status" className="mb-4 rounded-lg bg-ok/10 px-3 py-3 text-body font-semibold text-ok">
          {done}
        </p>
      ) : null}

      {/* Bo'lim */}
      <section aria-labelledby="dept-h">
        <h2 id="dept-h" className="field-label">
          Bo‘lim
        </h2>
        {edit ? (
          <p className="text-title">{dept.name}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {departments.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => pickDept(d.id)}
                aria-pressed={d.id === deptId}
                className={clsx(
                  'min-h-[48px] rounded-lg border px-3 py-2 text-left text-meta font-semibold leading-tight transition',
                  d.id === deptId ? 'border-ink bg-ink text-plane' : 'border-line bg-surface text-ink hover:bg-raised',
                )}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-meta text-muted">
          Sana: <span className="tnum font-semibold text-ink">{edit?.date ?? today}</span>
          {edit ? null : ' (bugun)'}
        </p>
      </section>

      {/* Cheklist */}
      <section aria-labelledby="list-h" className="mt-4">
        <h2 id="list-h" className="field-label">
          Cheklist
        </h2>
        {deptLists.length === 0 && !edit ? (
          <p className="text-meta text-ink2">Bu bo‘limda siz kirita oladigan cheklist yo‘q.</p>
        ) : (
          <>
            <div role="tablist" aria-label="Cheklist" className="flex flex-wrap gap-1.5">
              {(edit ? [list] : deptLists).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  aria-selected={l === list}
                  onClick={() => pickList(l)}
                  className={clsx(
                    'min-h-[44px] rounded-lg border px-3.5 text-meta font-semibold transition',
                    l === list ? 'border-ink bg-ink text-plane' : 'border-line bg-surface text-ink2 hover:bg-raised',
                  )}
                >
                  {LIST_LABEL[l]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-micro text-muted">{LIST_HINT[list]}</p>
          </>
        )}
      </section>

      {isInteraction ? (
        <section className="card mt-4 grid gap-3 p-3.5 sm:grid-cols-2" aria-label="Kim va qaysi muloqot">
          <label className="text-meta sm:col-span-2">
            <span className="mb-1 block font-semibold text-ink">Operator</span>
            <select
              className="field min-h-[44px]"
              value={draft.staffId ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, staffId: e.target.value || undefined }))}
            >
              <option value="">Operatorni tanlang</option>
              {roster
                .filter((s) => s.active || s.id === draft.staffId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.role ? ` — ${s.role}` : ''}
                  </option>
                ))}
            </select>
          </label>
          <div className="text-meta">
            <span className="mb-1 block font-semibold text-ink">Kanal</span>
            <div role="radiogroup" aria-label="Kanal" className="grid grid-cols-3 gap-1.5">
              {(Object.keys(CHANNELS) as Channel[]).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  role="radio"
                  aria-checked={draft.channel === ch}
                  onClick={() => setDraft((d) => ({ ...d, channel: ch }))}
                  className={clsx(
                    'min-h-[44px] rounded-lg border px-2 text-meta font-semibold transition',
                    draft.channel === ch ? 'border-ink bg-ink text-plane' : 'border-line bg-surface text-ink hover:bg-raised',
                  )}
                >
                  {CHANNELS[ch]}
                </button>
              ))}
            </div>
          </div>
          <label className="text-meta">
            <span className="mb-1 block font-semibold text-ink">{draft.channel === 'phone' || !draft.channel ? 'Qo‘ng‘iroq raqami / ID' : 'Yozishma raqami / havola'}</span>
            <input
              className="field min-h-[44px]"
              placeholder="Qayta tinglash yoki topish uchun"
              value={draft.subject}
              maxLength={200}
              onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            />
          </label>
        </section>
      ) : (
        <div className="mt-4">
          <label className="field-label" htmlFor="subject">
            {list === 'weekly' ? 'Hafta / izoh (ixtiyoriy)' : 'Smena / izoh (ixtiyoriy)'}
          </label>
          <input
            id="subject"
            className="field min-h-[44px]"
            placeholder={list === 'weekly' ? 'Masalan: 45-hafta' : 'Masalan: kechki smena'}
            value={draft.subject}
            maxLength={200}
            onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
          />
        </div>
      )}

      {hasStaffCp ? (
        <ShiftRoster staff={roster} present={presentIds} onChange={(ids) => setDraft((d) => ({ ...d, people: ids }))} />
      ) : null}

      {/* Nuqtalar */}
      <ol className="mt-5 space-y-3">
        {active.map((c, i) => {
          if (isStaffKind(c.kind)) {
            return (
              <StaffCard
                key={c.id}
                index={i + 1}
                cp={c}
                people={presentPeople}
                cells={draft.staff[c.id] ?? {}}
                na={draft.answers[c.id] === 'na'}
                onCell={(pid, patch) => setCell(c.id, pid, patch)}
                onAll={() => setAllYes(c.id)}
                onNa={(na) => setNa(c.id, na)}
              />
            );
          }
          const a = draft.answers[c.id];
          const note = draft.notes[c.id] ?? { text: '', ref: '' };
          const task = draft.tasks[c.id] ?? { what: '', owner: '', due: defaultDue(today) };
          return (
            <li key={c.id} className={clsx('card p-3.5', a === 'no' && 'border-bad/50')}>
              <div className="flex items-start gap-2">
                <span className="tnum mt-0.5 text-meta font-semibold text-muted">{i + 1}.</span>
                <p className="min-w-0 flex-1 text-body font-medium">{c.text}</p>
                {c.critical ? (
                  <span className="shrink-0 rounded-md bg-bad px-2 py-0.5 text-micro font-semibold text-white">
                    Jiddiy
                  </span>
                ) : null}
              </div>

              <div role="group" aria-label={c.text} className="mt-3 grid grid-cols-3 gap-2">
                {ANSWER_BTN.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    aria-pressed={a === b.value}
                    onClick={() => setAnswer(c.id, b.value)}
                    className={clsx(
                      'min-h-[48px] rounded-lg border px-1.5 text-meta font-semibold leading-tight transition',
                      a === b.value ? b.on : 'border-line bg-surface text-ink hover:bg-raised',
                    )}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              {a === 'no' ? (
                <div className="mt-3 space-y-3 rounded-tile bg-bad/5 p-3">
                  <div>
                    <label className="field-label" htmlFor={`note-${c.id}`}>
                      Izoh (majburiy)
                    </label>
                    <textarea
                      id={`note-${c.id}`}
                      className="field min-h-[72px]"
                      placeholder="Nima topildi?"
                      value={note.text}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, notes: { ...d.notes, [c.id]: { ...note, text: e.target.value } } }))
                      }
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`ref-${c.id}`}>
                      Dalil raqami (ixtiyoriy)
                    </label>
                    <input
                      id={`ref-${c.id}`}
                      className="field min-h-[44px]"
                      placeholder={isInteraction ? 'Audio vaqti (masalan 02:15) yoki xabar' : 'Murojaat raqami, audio vaqti'}
                      value={note.ref}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, notes: { ...d.notes, [c.id]: { ...note, ref: e.target.value } } }))
                      }
                    />
                  </div>
                  {isInteraction ? null : (
                  <fieldset className="space-y-3 border-t border-bad/20 pt-3">
                    <legend className="field-label">Topshiriq</legend>
                    <div>
                      <label className="field-label" htmlFor={`what-${c.id}`}>
                        Nima qilinishi kerak
                      </label>
                      <input
                        id={`what-${c.id}`}
                        className="field min-h-[44px]"
                        value={task.what}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, tasks: { ...d.tasks, [c.id]: { ...task, what: e.target.value } } }))
                        }
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="field-label" htmlFor={`owner-${c.id}`}>
                          Mas‘ul
                        </label>
                        <input
                          id={`owner-${c.id}`}
                          className="field min-h-[44px]"
                          value={task.owner}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              tasks: { ...d.tasks, [c.id]: { ...task, owner: e.target.value } },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`due-${c.id}`}>
                          Muddat
                        </label>
                        <input
                          id={`due-${c.id}`}
                          type="date"
                          className="field min-h-[44px]"
                          value={task.due}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, tasks: { ...d.tasks, [c.id]: { ...task, due: e.target.value } } }))
                          }
                        />
                      </div>
                    </div>
                  </fieldset>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Pastki panel (ixcham): chapda holat, o'ngda Saqlash */}
      <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-[1100px] px-4 py-2">
          {error ? (
            <p role="alert" className="mb-2 rounded-lg bg-bad/10 px-3 py-2 text-meta font-medium text-bad">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <p className="tnum text-meta text-ink2">
              <span className="font-semibold text-ink">
                {answered} / {active.length}
              </span>{' '}
              nuqta
              <span className="mx-2 text-line" aria-hidden>
                |
              </span>
              Ball <span className="font-semibold text-ink">{live === null ? '—' : `${Math.round(live)}%`}</span>
            </p>
            <button type="button" className="btn-primary min-h-[44px] px-6 text-meta" disabled={pending} onClick={submit}>
              {pending ? 'Saqlanmoqda…' : edit ? 'Tuzatishni saqlash' : 'Tekshiruvni saqlash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
