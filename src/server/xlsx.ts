/**
 * Excel eksporti uchun umumiy yordamchilar.
 *
 * Maqsad — chiqarilgan fayl darhol ishlatishga tayyor bo'lishi: sarlavha qotib
 * turadi, ustunlar kengligi mos, filtr yoqilgan, raqamlar to'g'ri formatda.
 * Rahbariyat va HR faylni hech narsa sozlamasdan ochib o'qiy olishi kerak.
 */

import 'server-only';

import ExcelJS from 'exceljs';

/** Hujjat uslubi — CRM dagi ranglar bilan bir xil (ko'k urg'u, neytral fon). */
const INK = 'FF0B0B0B';
const MUTED = 'FF8B8983';
const BRAND = 'FF2A78D6';
const HEADER_FILL = 'FFF0EFEA';
const TOTAL_FILL = 'FFFAFAF8';
const BORDER = 'FFE0DFD8';

export interface ColumnSpec {
  header: string;
  /** Ustun kengligi (belgi hisobida) */
  width: number;
  /** Raqamli ustun — o'ngga tekislanadi va tabular formatda ko'rsatiladi */
  numeric?: boolean;
  /** Excel raqam formati, masalan '0.0%' yoki '#,##0' */
  format?: string;
  /** Matn uzun bo'lsa qatorga o'ralsin */
  wrap?: boolean;
}

export function createWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'iPOST OTK — Sifat nazorati KPI tizimi';
  wb.created = new Date();
  return wb;
}

/**
 * Varaq yaratadi: sarlavha bloki (nom + izoh), ustun sarlavhalari, keyin ma'lumot.
 * Qaytadi — ma'lumot birinchi qatorining raqami.
 */
export function addSheet(
  wb: ExcelJS.Workbook,
  options: {
    name: string;
    title: string;
    note?: string;
    columns: ColumnSpec[];
  },
): { sheet: ExcelJS.Worksheet; headerRow: number } {
  const sheet = wb.addWorksheet(options.name, {
    views: [{ state: 'frozen', ySplit: options.note ? 4 : 3 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  sheet.columns = options.columns.map((c) => ({ width: c.width }));

  // Sarlavha
  const titleRow = sheet.addRow([options.title]);
  titleRow.font = { bold: true, size: 13, color: { argb: INK } };
  titleRow.height = 20;
  sheet.mergeCells(titleRow.number, 1, titleRow.number, options.columns.length);

  if (options.note) {
    const noteRow = sheet.addRow([options.note]);
    noteRow.font = { size: 9.5, color: { argb: MUTED } };
    noteRow.alignment = { wrapText: true, vertical: 'top' };
    sheet.mergeCells(noteRow.number, 1, noteRow.number, options.columns.length);
  }

  sheet.addRow([]); // bo'sh ajratuvchi qator

  // Ustun sarlavhalari
  const header = sheet.addRow(options.columns.map((c) => c.header));
  header.height = 22;
  header.eachCell((cell, i) => {
    const col = options.columns[i - 1]!;
    cell.font = { bold: true, size: 9.5, color: { argb: INK } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: col.numeric ? 'right' : 'left', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: BORDER } } };
  });

  // Filtr — foydalanuvchi o'zi kesib ko'rishi uchun
  sheet.autoFilter = {
    from: { row: header.number, column: 1 },
    to: { row: header.number, column: options.columns.length },
  };

  return { sheet, headerRow: header.number };
}

/** Ma'lumot qatorlarini qo'shadi va ustun spetsifikatsiyasiga qarab formatlaydi. */
export function addRows(
  sheet: ExcelJS.Worksheet,
  columns: ColumnSpec[],
  rows: ReadonlyArray<ReadonlyArray<string | number | Date | null>>,
): void {
  for (const values of rows) {
    const row = sheet.addRow([...values]);
    row.eachCell({ includeEmpty: true }, (cell, i) => {
      const col = columns[i - 1];
      if (!col) return;
      cell.font = { size: 10, color: { argb: INK } };
      cell.alignment = {
        vertical: 'top',
        horizontal: col.numeric ? 'right' : 'left',
        wrapText: col.wrap ?? false,
      };
      if (col.format && typeof cell.value === 'number') cell.numFmt = col.format;
      cell.border = { bottom: { style: 'hair', color: { argb: BORDER } } };
    });
  }
}

/** Yakuniy (JAMI) qator — kulrang fon va qalin shrift. */
export function addTotalRow(
  sheet: ExcelJS.Worksheet,
  columns: ColumnSpec[],
  values: ReadonlyArray<string | number | null>,
): void {
  const row = sheet.addRow([...values]);
  row.eachCell({ includeEmpty: true }, (cell, i) => {
    const col = columns[i - 1];
    cell.font = { bold: true, size: 10, color: { argb: INK } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };
    cell.alignment = { horizontal: col?.numeric ? 'right' : 'left', vertical: 'middle' };
    if (col?.format && typeof cell.value === 'number') cell.numFmt = col.format;
    cell.border = { top: { style: 'thin', color: { argb: BORDER } } };
  });
}

/** Varaq oxiriga izoh yoki qoida matnini qo'shadi. */
export function addFootnote(sheet: ExcelJS.Worksheet, columnCount: number, lines: string[]): void {
  sheet.addRow([]);
  for (const line of lines) {
    const row = sheet.addRow([line]);
    row.font = { size: 9, color: { argb: line.startsWith('QOIDA') || line.startsWith('DIQQAT') ? BRAND : MUTED } };
    row.alignment = { wrapText: true, vertical: 'top' };
    sheet.mergeCells(row.number, 1, row.number, columnCount);
  }
}

/** Fayl nomi: iPOST_OTK_Ish_taqsimoti_2026-08-12.xlsx */
export function exportFileName(base: string, date = new Date()): string {
  const stamp = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tashkent',
  }).format(date);
  return `iPOST_OTK_${base}_${stamp}.xlsx`;
}

/** Yuklab olish uchun HTTP javobi. */
export async function workbookResponse(wb: ExcelJS.Workbook, fileName: string): Promise<Response> {
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String((buffer as ArrayBuffer).byteLength),
      'Cache-Control': 'no-store',
    },
  });
}
