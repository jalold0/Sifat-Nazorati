'use client';

import { useActionState, useMemo, useState } from 'react';

import { computeCapacity } from '@/domain/capacity';
import { hours, number, percent } from '@/lib/format';

import { saveScenarioAction, type CapacityState } from './actions';

export interface ZoneRow {
  zoneCode: string;
  name: string;
  flowSharePercent: string;
  minutesPerCase: string;
}

export interface ScenarioDefaults {
  id?: number;
  name: string;
  period: string;
  monthlyVolume: string;
  workingDays: string;
  hoursPerDay: string;
  specialists: string;
  utilisationPercent: string;
  proactiveSharePercent: string;
  note: string;
  zones: ZoneRow[];
}

/**
 * Quvvat kalkulyatori.
 * Har bir o'zgarish darhol qayta hisoblanadi (bir xil domen funksiyasi bilan),
 * shuning uchun rahbariyat bilan suhbatda raqamni jonli ko'rsatish mumkin.
 */
export function ScenarioForm({
  defaults,
  measured,
}: {
  defaults: ScenarioDefaults;
  measured: { minutes: Record<string, number>; shares: Record<string, number>; coverage: number } | null;
}) {
  const [state, action, pending] = useActionState<CapacityState, FormData>(saveScenarioAction, {});
  const [form, setForm] = useState(defaults);

  const set = <K extends keyof ScenarioDefaults>(key: K, value: ScenarioDefaults[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setZone = (code: string, key: 'flowSharePercent' | 'minutesPerCase', value: string) =>
    setForm((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => (z.zoneCode === code ? { ...z, [key]: value } : z)),
    }));

  function applyMeasured() {
    if (!measured) return;
    setForm((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => ({
        ...z,
        minutesPerCase: measured.minutes[z.zoneCode] ? String(measured.minutes[z.zoneCode]) : z.minutesPerCase,
        flowSharePercent: measured.shares[z.zoneCode]
          ? String(Math.round(measured.shares[z.zoneCode]! * 1000) / 10)
          : z.flowSharePercent,
      })),
    }));
  }

  const result = useMemo(() => {
    const norms = form.zones
      .filter((z) => Number(z.flowSharePercent) > 0)
      .map((z) => ({
        zoneCode: z.zoneCode,
        flowShare: Number(z.flowSharePercent) / 100,
        minutesPerCase: Number(z.minutesPerCase) || 0,
      }));

    if (norms.length === 0) return null;

    return computeCapacity(
      {
        monthlyVolume: Number(form.monthlyVolume) || 0,
        workingDays: Number(form.workingDays) || 1,
        hoursPerDay: Number(form.hoursPerDay) || 8,
        specialists: Number(form.specialists) || 1,
        utilisation: Number(form.utilisationPercent) / 100 || 0.85,
        proactiveShare: Number(form.proactiveSharePercent) / 100 || 0,
      },
      norms,
    );
  }, [form]);

  const overloaded = result !== null && result.loadFactor > 1;

  return (
    <form action={action} className="space-y-6">
      {form.id ? <input type="hidden" name="id" value={form.id} /> : null}

      {/* ── Kirish parametrlari ───────────────────────────────────────────── */}
      <div>
        <p className="eyebrow mb-2">1. Kirish parametrlari</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Sxema nomi" name="name" value={form.name} onChange={(v) => set('name', v)} />
          <Field label="Davr (YYYY-MM)" name="period" value={form.period} onChange={(v) => set('period', v)} />
          <Field
            label="Oylik jami oqim (ta)"
            name="monthlyVolume"
            type="number"
            value={form.monthlyVolume}
            onChange={(v) => set('monthlyVolume', v)}
          />
          <Field
            label="Ish kunlari"
            name="workingDays"
            type="number"
            value={form.workingDays}
            onChange={(v) => set('workingDays', v)}
          />
          <Field
            label="Kunlik ish vaqti (soat)"
            name="hoursPerDay"
            type="number"
            step="0.5"
            value={form.hoursPerDay}
            onChange={(v) => set('hoursPerDay', v)}
          />
          <Field
            label="Mutaxassislar soni"
            name="specialists"
            type="number"
            step="0.5"
            value={form.specialists}
            onChange={(v) => set('specialists', v)}
          />
          <Field
            label="Foydali vaqt (%)"
            name="utilisation"
            type="number"
            value={form.utilisationPercent}
            onChange={(v) => set('utilisationPercent', v)}
            hint="Yig'ilish, tanaffus, ta'til chegirmasi"
            transformName
          />
          <Field
            label="Proaktiv ish ulushi (%)"
            name="proactiveShare"
            type="number"
            value={form.proactiveSharePercent}
            onChange={(v) => set('proactiveSharePercent', v)}
            hint="Himoyalangan vaqt — reaktiv ishga berilmaydi"
            transformName
          />
        </div>
      </div>

      {/* ── Zona normalari ────────────────────────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-end justify-between gap-3">
          <p className="eyebrow">2. Zonalar bo'yicha yuklama</p>
          {measured ? (
            <button type="button" className="btn-ghost !py-1.5 !text-[12px]" onClick={applyMeasured}>
              Reyestrdan o'lchangan normani qo'llash
            </button>
          ) : null}
        </div>

        {measured ? (
          <p className="mb-2 text-[11.5px] text-muted">
            Reyestrda vaqt qayd etilgan murojaatlar ulushi: {percent(measured.coverage, 0)}.
            {measured.coverage < 0.8
              ? ' 80% dan past — norma hali ishonchsiz, xronometrajni davom ettiring.'
              : ' Norma ishonchli deb qabul qilinishi mumkin.'}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">Zona</th>
                <th className="th w-[150px]">Oqim ulushi (%)</th>
                <th className="th w-[170px]">1 murojaat normasi (daq)</th>
                <th className="th text-right">Oylik murojaat</th>
                <th className="th text-right">Kerakli soat</th>
              </tr>
            </thead>
            <tbody>
              {form.zones.map((z) => {
                const computed = result?.zones.find((r) => r.zoneCode === z.zoneCode);
                return (
                  <tr key={z.zoneCode}>
                    <td className="td font-medium">
                      {z.zoneCode} — {z.name}
                    </td>
                    <td className="td">
                      <input
                        name={`flow-${z.zoneCode}`}
                        type="number"
                        step="0.1"
                        className="field !py-1.5 !text-[12.5px]"
                        value={z.flowSharePercent}
                        onChange={(e) => setZone(z.zoneCode, 'flowSharePercent', e.target.value)}
                      />
                    </td>
                    <td className="td">
                      <input
                        name={`min-${z.zoneCode}`}
                        type="number"
                        step="0.1"
                        className="field !py-1.5 !text-[12.5px]"
                        value={z.minutesPerCase}
                        onChange={(e) => setZone(z.zoneCode, 'minutesPerCase', e.target.value)}
                      />
                    </td>
                    <td className="td tnum text-right">{number(computed?.monthlyCases ?? 0, 0)}</td>
                    <td className="td tnum text-right font-semibold">{hours(computed?.requiredHours ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {result?.flowShareWarning ? (
          <p className="mt-2 text-[12px] font-medium text-bad">
            Zona ulushlari yig'indisi 100% emas — natija noto'g'ri bo'ladi.
          </p>
        ) : null}
      </div>

      {/* ── Natija ────────────────────────────────────────────────────────── */}
      {result ? (
        <div>
          <p className="eyebrow mb-2">3. Natija — resurs yetadimi?</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Mavjud foydali vaqt" value={hours(result.usefulHours, 0)} hint={`Nominal ${hours(result.nominalHours, 0)}`} />
            <Metric
              label="Proaktiv ishga himoyalangan"
              value={hours(result.proactiveHours, 0)}
              hint="Sifat nazoratining asosiy vazifasi"
            />
            <Metric label="Reaktiv ishga qoladi" value={hours(result.reactiveAvailableHours, 0)} />
            <Metric label="Reaktiv ish uchun kerak" value={hours(result.reactiveRequiredHours, 0)} tone="accent" />
            <Metric
              label="Taqchillik / ortiqcha"
              value={hours(result.balanceHours, 0)}
              tone={result.balanceHours < 0 ? 'bad' : 'ok'}
              hint={result.balanceHours < 0 ? 'Manfiy — resurs yetishmayapti' : 'Resurs yetarli'}
            />
            <Metric
              label="Yuklama darajasi"
              value={percent(result.loadFactor, 0)}
              tone={overloaded ? 'bad' : 'ok'}
              hint={overloaded ? '100% dan yuqori — xodimlar ortiqcha yuklangan' : ''}
            />
            <Metric label="Kerakli xodim (FTE)" value={number(result.requiredFte, 2)} tone={overloaded ? 'bad' : 'neutral'} />
            <Metric
              label="Qo'shimcha shtat ehtiyoji"
              value={number(result.extraStaffNeeded, 2)}
              tone={result.extraStaffNeeded > 0 ? 'bad' : 'ok'}
              hint="Yoki shu qadar ishni avtomatlashtirish"
            />
          </div>
        </div>
      ) : null}

      <div>
        <label className="field-label" htmlFor="note">
          Izoh
        </label>
        <input
          id="note"
          name="note"
          className="field"
          value={form.note}
          onChange={(e) => set('note', e.target.value)}
          placeholder="Masalan: iyul xronometraji asosida"
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-[12.5px] font-medium text-bad">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rounded-lg bg-ok/10 px-3 py-2 text-[12.5px] font-medium text-ok">
          {state.ok}
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Saqlanmoqda…' : 'Sxemani saqlash'}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  step,
  hint,
  transformName,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
  hint?: string;
  /** Foizda ko'rsatiladi, serverga 0..1 sifatida yuboriladi */
  transformName?: boolean;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        type={type}
        step={step}
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {/* Serverga yuboriladigan haqiqiy qiymat */}
      <input type="hidden" name={name} value={transformName ? String(Number(value) / 100) : value} />
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'ok' | 'bad' | 'accent';
}) {
  const cls = { neutral: 'text-ink', ok: 'text-ok', bad: 'text-bad', accent: 'text-accent' }[tone];
  return (
    <div className="rounded-xl border border-line bg-raised p-3.5">
      <p className="text-[12px] text-ink2">{label}</p>
      <p className={`tnum mt-1 text-[20px] font-semibold leading-none ${cls}`}>{value}</p>
      {hint ? <p className="mt-1.5 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}
