/**
 * Quvvat hisobi — bo'lim real yuklamaga bardosh bera oladimi?
 * Manba: 'Quvvat hisobi' varag'i. Shtat masalasini raqam bilan asoslash uchun.
 *
 * Nominal vaqt   = ish kunlari × kunlik soat × mutaxassislar soni
 * Foydali vaqt   = nominal × foydali koeffitsient (yig'ilish, tanaffus, ta'til chegirmasi)
 * Proaktiv vaqt  = foydali × proaktiv ulushi  ← himoyalangan, reaktiv ishga berilmaydi
 * Reaktiv mavjud = foydali − proaktiv
 * Reaktiv kerak  = Σ (oqim × zona ulushi × norma daqiqa / 60)
 */

export interface CapacityInputs {
  monthlyVolume: number;
  workingDays: number;
  hoursPerDay: number;
  specialists: number;
  /** 0..1 — foydali vaqt koeffitsienti (0.85) */
  utilisation: number;
  /** 0..1 — proaktiv ishga ajratiladigan ulush (0.20) */
  proactiveShare: number;
}

export interface ZoneNorm {
  zoneCode: string;
  /** 0..1 — umumiy oqimning ulushi */
  flowShare: number;
  /** 1 murojaatga sarflanadigan real vaqt (xronometraj natijasi) */
  minutesPerCase: number;
}

export interface ZoneLoad extends ZoneNorm {
  monthlyCases: number;
  requiredHours: number;
}

export interface CapacityResult {
  inputs: CapacityInputs;
  zones: ZoneLoad[];
  nominalHours: number;
  usefulHours: number;
  proactiveHours: number;
  reactiveAvailableHours: number;
  reactiveRequiredHours: number;
  /** Manfiy — resurs yetishmayapti */
  balanceHours: number;
  /** 1.0 dan yuqori — xodimlar ortiqcha yuklangan */
  loadFactor: number;
  /** Proaktiv vaqtni saqlagan holda oqimni qoplash uchun kerakli xodim soni */
  requiredFte: number;
  extraStaffNeeded: number;
  /** Oqim ulushlari yig'indisi 1 emasligini bildiradi — kirish ma'lumoti xato */
  flowShareWarning: boolean;
}

export function computeCapacity(inputs: CapacityInputs, norms: ZoneNorm[]): CapacityResult {
  const zones: ZoneLoad[] = norms.map((n) => {
    const monthlyCases = inputs.monthlyVolume * n.flowShare;
    return {
      ...n,
      monthlyCases: r2(monthlyCases),
      requiredHours: r2((monthlyCases * n.minutesPerCase) / 60),
    };
  });

  const nominalHours = inputs.workingDays * inputs.hoursPerDay * inputs.specialists;
  const usefulHours = nominalHours * inputs.utilisation;
  const proactiveHours = usefulHours * inputs.proactiveShare;
  const reactiveAvailableHours = usefulHours - proactiveHours;
  const reactiveRequiredHours = zones.reduce((sum, z) => sum + z.requiredHours, 0);

  const loadFactor = reactiveAvailableHours > 0 ? reactiveRequiredHours / reactiveAvailableHours : 0;
  const flowShareTotal = norms.reduce((sum, n) => sum + n.flowShare, 0);

  return {
    inputs,
    zones,
    nominalHours: r2(nominalHours),
    usefulHours: r2(usefulHours),
    proactiveHours: r2(proactiveHours),
    reactiveAvailableHours: r2(reactiveAvailableHours),
    reactiveRequiredHours: r2(reactiveRequiredHours),
    balanceHours: r2(reactiveAvailableHours - reactiveRequiredHours),
    loadFactor: r4(loadFactor),
    requiredFte: r2(inputs.specialists * loadFactor),
    extraStaffNeeded: r2(inputs.specialists * loadFactor - inputs.specialists),
    flowShareWarning: Math.abs(flowShareTotal - 1) > 0.001,
  };
}

/**
 * Reyestrdagi haqiqiy vaqt asosida zona normasini qayta hisoblash (xronometraj).
 * Joriy etish rejasining 3-bandi: usiz na shtat so'rashga, na KPI'ga asos yo'q.
 */
export function deriveNormFromRegistry(
  rows: ReadonlyArray<{ zoneCode: string; spentHours: number | null }>,
  totalVolume: number,
): ZoneNorm[] {
  const byZone = new Map<string, { cases: number; hours: number }>();
  for (const row of rows) {
    const bucket = byZone.get(row.zoneCode) ?? { cases: 0, hours: 0 };
    bucket.cases += 1;
    bucket.hours += row.spentHours ?? 0;
    byZone.set(row.zoneCode, bucket);
  }

  const measured = [...byZone.values()].reduce((s, b) => s + b.cases, 0);
  const base = totalVolume > 0 ? totalVolume : measured;

  return [...byZone.entries()]
    .map(([zoneCode, b]) => ({
      zoneCode,
      flowShare: base > 0 ? r4(b.cases / base) : 0,
      minutesPerCase: b.cases > 0 ? r2((b.hours * 60) / b.cases) : 0,
    }))
    .sort((a, b) => a.zoneCode.localeCompare(b.zoneCode));
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
