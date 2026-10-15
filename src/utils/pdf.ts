import jsPDF from 'jspdf';
import type { Invoice } from '../types';
import { calculateTotals } from './helpers';

const BLUE: [number, number, number] = [0, 0, 0];
const BLACK: [number, number, number] = [0, 0, 0];

const money = (n: number): string =>
  (Number(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** ISO (YYYY-MM-DD) -> DD/MM/YYYY seperti contoh. */
export const fmtDMY = (iso: string): string => {
  if (!iso) return '-';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (x: number): string => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** Jatuh tempo = tanggal nota + 15 hari (sesuai Terms). */
export const dueDMY = (iso: string): string => {
  const base = iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso) : new Date();
  if (Number.isNaN(base.getTime())) return '-';
  base.setDate(base.getDate() + 15);
  const p = (x: number): string => String(x).padStart(2, '0');
  return `${p(base.getDate())}/${p(base.getMonth() + 1)}/${base.getFullYear()}`;
};

/**
 * PDF nota mengikuti template contoh (bar biru, BILL/SHIP TO,
 * Receipt Total, tabel QTY|DESCRIPTION|UNIT PRICE|AMOUNT, terms).
 * Semua teks diambil dari data web.
 */
export const downloadPDF = (invoice: Invoice): void => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 15;
  const R = pageW - M;
  const contentW = pageW - M * 2;
  const currencySymbol = (invoice.meta.currency || '').toUpperCase() === 'IDR' ? 'Rp' : '$';

  // ---- Bar biru atas ----
  doc.setFillColor(...BLUE);
  doc.rect(M, 12, contentW, 9, 'F');

  let y = 32;

  // ---- Kop bisnis ----
  const biz = invoice.business?.name || 'E.O.D';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...BLACK);
  doc.text(biz, M, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const bizLines = [invoice.business?.address, invoice.business?.phone, invoice.business?.email].filter(
    (x): x is string => Boolean(x && x.trim()),
  );
  bizLines.forEach((line) => {
    doc.text(line, M, y);
    y += 5.5;
  });
  y += 8;

  // ---- BILL TO / SHIP TO / META ----
  const colShip = M + 62;
  const colMeta = M + 122;
  const topY = y;

  const party = (x: number, title: string, c: { name?: string; address?: string; phone?: string }) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(title, x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(c.name?.trim() || '-', x, y + 6);
    doc.text(c.address?.trim() || '-', x, y + 12);
    doc.text(c.phone?.trim() || '-', x, y + 18);
  };
  party(M, 'BILL TO', invoice.customer ?? { name: '', address: '', phone: '' });
  party(colShip, 'SHIP TO', invoice.shipTo ?? { name: '', address: '', phone: '' });

  const metaRows: [string, string][] = [
    ['RECEIPT #', invoice.meta.number || '-'],
    ['RECEIPT DATE', fmtDMY(invoice.meta.date)],
    ['DUE DATE', dueDMY(invoice.meta.date)],
  ];
  metaRows.forEach(([label, value], i) => {
    const ry = y + i * 6.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(label, colMeta, ry);
    doc.setFont('helvetica', 'normal');
    doc.text(value, R, ry, { align: 'right' });
  });

  y = topY + 26;

  // ---- Garis pemisah ----
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.6);
  doc.line(M, y, R, y);
  y += 11;

  // ---- Receipt Total ----
  const totals = calculateTotals(invoice);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Receipt Total', M, y);
  doc.text(`${currencySymbol}${money(totals.total)}`, R, y, { align: 'right' });
  y += 9;
  doc.setLineWidth(0.6);
  doc.line(M, y, R, y);
  y += 10;

  // ---- Tabel barang ----
  const colQty = M;
  const colDesc = M + 20;
  const colUnit = R - 52;
  const colAmt = R;
  const rowStep = 7;

  const tableHead = (yy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('QTY', colQty, yy);
    doc.text('DESCRIPTION', colDesc, yy);
    doc.text('UNIT PRICE', colUnit, yy, { align: 'right' });
    doc.text('AMOUNT', colAmt, yy, { align: 'right' });
  };
  tableHead(y);
  y += rowStep;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  invoice.items.forEach((item) => {
    if (y > pageH - 70) {
      doc.addPage();
      y = 20;
      tableHead(y);
      y += rowStep;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
    }
    const qty = Number(item.qty) || 0;
    const price = Number(item.price) || 0;
    doc.text(String(qty), colQty, y);
    doc.text(item.name || '-', colDesc, y);
    doc.text(money(price), colUnit, y, { align: 'right' });
    doc.text(money(qty * price), colAmt, y, { align: 'right' });
    y += rowStep;
  });

  y += 4;

  // ---- Subtotal + pajak ----
  const labelX = R - 48;
  const sumRow = (label: string, value: string) => {
    if (y > pageH - 55) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.text(label, labelX, y, { align: 'right' });
    doc.text(value, colAmt, y, { align: 'right' });
    y += 6.5;
  };
  sumRow('Subtotal', money(totals.subtotal));
  if (totals.discount > 0) sumRow('Discount', `- ${money(totals.discount)}`);
  if (totals.tax > 0) sumRow(`Sales Tax ${Number(invoice.meta.taxRate) || 0}%`, money(totals.tax));

  // ---- Tanda tangan (nama pembeli, gaya tulis) ----
  y += 2;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(20);
  doc.text(invoice.customer?.name?.trim() || '', colAmt, y, { align: 'right' });
  y += 14;

  // ---- Terms & Conditions ----
  if (y > pageH - 55) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('TERMS & CONDITIONS', M, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.text('Payment is due within 15 days', M, y);
  y += 6.5;
  doc.text(`Please make checks payable to: ${biz}`, M, y);
  y += 6.5;
  if (invoice.meta.notes?.trim()) {
    const wrapped = doc.splitTextToSize(`Note: ${invoice.meta.notes.trim()}`, contentW) as string[];
    doc.text(wrapped, M, y);
  }

  // ---- Bar biru bawah ----
  doc.setFillColor(...BLUE);
  doc.rect(M, pageH - 20, contentW, 9, 'F');

  const safeName = (invoice.meta.number || 'receipt').replace(/[\\/:*?"<>|]/g, '-');
  doc.save(`${safeName}.pdf`);
};
