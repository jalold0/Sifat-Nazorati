/**
 * Grafiklar — tashqi kutubxonasiz, sof SVG.
 * Ranglar CSS o'zgaruvchilaridan olinadi, shuning uchun yorug'/qorong'i rejimda ham to'g'ri ko'rinadi.
 */

import clsx from 'clsx';

import { number } from '@/lib/format';

export interface Series {
  label: string;
  value: number;
  tone?: 'brand' | 'accent' | 'ok' | 'warn' | 'bad' | 'muted';
}

const TONE: Record<NonNullable<Series['tone']>, string> = {
  brand: 'var(--brand)',
  accent: 'var(--accent)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
  muted: 'var(--muted)',
};

const color = (tone: Series['tone']) => TONE[tone ?? 'brand'];

/** Vertikal ustunlar — oylik dinamika uchun. Ixtiyoriy mos yozuvlar chizig'i. */
export function ColumnChart({
  data,
  reference,
  referenceLabel,
  valueFormat = (v) => number(v),
  height = 210,
}: {
  data: Series[];
  reference?: number;
  referenceLabel?: string;
  valueFormat?: (v: number) => string;
  height?: number;
}) {
  if (data.length === 0) return null;

  const W = 900;
  const padL = 8;
  const padR = 8;
  const padT = 26;
  const padB = 30;
  const plotH = height - padT - padB;
  const max = Math.max(...data.map((d) => d.value), reference ?? 0) * 1.12 || 1;
  const step = (W - padL - padR) / data.length;
  const barW = Math.min(step * 0.56, 64);
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="block h-auto w-full" role="img">
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={padL}
          x2={W - padR}
          y1={padT + plotH - plotH * t}
          y2={padT + plotH - plotH * t}
          stroke="var(--grid)"
          strokeWidth={1}
        />
      ))}

      {data.map((d, i) => {
        const cx = padL + step * i + step / 2;
        const barH = Math.max((d.value / max) * plotH, d.value > 0 ? 2 : 0);
        return (
          <g key={`${d.label}-${i}`}>
            <rect x={cx - barW / 2} y={padT + plotH - barH} width={barW} height={barH} rx={4} fill={color(d.tone)} />
            <text
              x={cx}
              y={padT + plotH - barH - 7}
              textAnchor="middle"
              style={{ fill: 'var(--ink)', fontSize: 12, fontWeight: 640 }}
              className="tnum"
            >
              {valueFormat(d.value)}
            </text>
            <text
              x={cx}
              y={height - 9}
              textAnchor="middle"
              style={{ fill: 'var(--muted)', fontSize: 11.5 }}
            >
              {d.label}
            </text>
          </g>
        );
      })}

      {reference !== undefined ? (
        <>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(reference)}
            y2={y(reference)}
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="7 5"
          />
          {referenceLabel ? (
            <text
              x={W - padR}
              y={y(reference) - 7}
              textAnchor="end"
              style={{ fill: 'var(--accent)', fontSize: 11.5, fontWeight: 640 }}
            >
              {referenceLabel}
            </text>
          ) : null}
        </>
      ) : null}
    </svg>
  );
}

/** Gorizontal ustunlar — xodimlar/zonalar kesimi uchun. */
export function BarList({
  data,
  valueFormat = (v) => number(v),
  max: maxOverride,
}: {
  data: Series[];
  valueFormat?: (v: number) => string;
  max?: number;
}) {
  const max = maxOverride ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-[12.5px] text-ink2">{d.label}</span>
            <span className="tnum text-[12.5px] font-semibold text-ink">{valueFormat(d.value)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-grid">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(d.value / max, 1) * 100}%`, background: color(d.tone) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * KPI bali uchun yarim doira ko'rsatkich.
 * 0..120 shkalasi, 70 (kirish chegarasi) va 100 belgilangan.
 */
export function ScoreGauge({
  score,
  threshold = 70,
  size = 168,
}: {
  score: number;
  threshold?: number;
  size?: number;
}) {
  const MAX = 120;
  const r = 62;
  const cx = 80;
  const cy = 74;
  const arc = (from: number, to: number) => {
    const a1 = Math.PI * (1 - Math.min(from, MAX) / MAX);
    const a2 = Math.PI * (1 - Math.min(to, MAX) / MAX);
    const large = 0;
    return `M ${cx + r * Math.cos(a1)} ${cy - r * Math.sin(a1)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a2)} ${cy - r * Math.sin(a2)}`;
  };

  const tone = score >= 95 ? 'var(--ok)' : score >= threshold ? 'var(--warn)' : 'var(--bad)';
  const thresholdAngle = Math.PI * (1 - threshold / MAX);

  return (
    <svg viewBox="0 0 160 96" style={{ width: size }} className="block h-auto" role="img" aria-label={`Ball ${score}`}>
      <path d={arc(0, MAX)} fill="none" stroke="var(--grid)" strokeWidth={12} strokeLinecap="round" />
      <path d={arc(0, score)} fill="none" stroke={tone} strokeWidth={12} strokeLinecap="round" />
      <line
        x1={cx + (r - 9) * Math.cos(thresholdAngle)}
        y1={cy - (r - 9) * Math.sin(thresholdAngle)}
        x2={cx + (r + 9) * Math.cos(thresholdAngle)}
        y2={cy - (r + 9) * Math.sin(thresholdAngle)}
        stroke="var(--ink)"
        strokeWidth={2}
      />
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        className="tnum"
        style={{ fill: 'var(--ink)', fontSize: 27, fontWeight: 680, letterSpacing: '-0.03em' }}
      >
        {number(score, 1)}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: 10.5 }}>
        120 balldan
      </text>
    </svg>
  );
}

/** Ikki qiymatning nisbatini ko'rsatuvchi chiziq (masalan proaktiv ↔ reaktiv). */
export function SplitBar({
  parts,
  height = 14,
}: {
  parts: Array<{ label: string; value: number; tone?: Series['tone'] }>;
  height?: number;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div>
      <div className="flex gap-[3px] overflow-hidden rounded-lg" style={{ height }}>
        {parts.map((p) => (
          <div key={p.label} style={{ flex: p.value || 0.0001, background: color(p.tone) }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5 text-[12px] text-ink2">
            <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color(p.tone) }} />
            {p.label} — <span className="tnum font-semibold">{number((p.value / total) * 100, 1)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Kichik trend chizig'i. */
export function Sparkline({
  values,
  tone = 'brand',
  width = 120,
  height = 32,
}: {
  values: number[];
  tone?: Series['tone'];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = height - 2 - ((v - min) / span) * (height - 6);
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width }} className={clsx('block h-auto')} role="img">
      <polyline points={pts.join(' ')} fill="none" stroke={color(tone)} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}
