/**
 * CSV — Excel to'g'ri ochishi uchun: UTF-8 BOM, ajratgich «;» (o'zbek/rus mintaqasidagi Excel shuni kutadi),
 * CRLF qator oxiri, maydonlar tirnoqlanadi va formulaga o'xshash boshlanish (=, +, -, @) zararsizlantiriladi.
 */

export const CSV_BOM = '﻿';

function cell(value: string | number | boolean | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Excel formulasi sifatida ishga tushmasligi uchun (CSV injection)
  if (/^[=+\-@\t\r]/.test(s) && typeof value === 'string') s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  return CSV_BOM + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}
