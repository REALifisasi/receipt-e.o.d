import type { Invoice, LineItem, Product } from '../types';

export const uid = (): string =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

/** Baris nota selalu dari katalog — tidak ada ketik manual. */
export const createItem = (product: Product, qty = 1): LineItem => ({
  id: uid(),
  productId: product.id,
  image: product.image,
  name: product.name,
  qty,
  price: product.price,
});

export const formatCurrency = (value: number, currency = 'IDR'): string => {
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'IDR' ? 0 : 2,
      maximumFractionDigits: currency === 'IDR' ? 0 : 2,
    }).format(safe);
  } catch {
    return `${currency} ${safe.toLocaleString('id-ID')}`;
  }
};

export interface Totals {
  subtotal: number;
  discount: number;
  total: number;
}

/** Tanpa pajak/sales tax — total = subtotal - diskon. */
export const calculateTotals = (invoice: Invoice): Totals => {
  const subtotal = invoice.items.reduce(
    (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0),
    0,
  );
  const discount = Number(invoice.meta.discount) || 0;
  const total = Math.max(subtotal - discount, 0);
  return { subtotal, discount, total };
};

export const formatDate = (iso: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

/** Tanggal gaya struk thermal, mis. "SELASA, 13 OKTOBER 2026". */
export const formatReceiptDate = (iso: string): string => {
  if (!iso) return '-';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso.toUpperCase();
  return d
    .toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    .toUpperCase();
};

/**
 * Kode receipt: RCP/<tanggal dibuat>/<nama customer>/<kode unik>.
 * Mis. RCP/18102026/IBNU-AKBAR/K3X9. Nama di-uppercase, spasi jadi strip.
 */
const slugCustomer = (name: string): string =>
  name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'CUSTOMER';

/** ISO (YYYY-MM-DD) -> DD/MM/YYYY. */
export const fmtDMY = (iso: string): string => {
  if (!iso) return '-';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (x: number): string => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** Kode unik 4 karakter untuk nomor nota, dibuat sekali per nota. */
export const uniqCode = (): string => Math.random().toString(36).slice(2, 6).toUpperCase();

/**
 * Kode receipt yang akan tercetak: RCP/<hari ini>/<nama customer>/<kode unik>.
 * Mis. RCP/18102026/IBNU-AKBAR/K3X9. Nama di-uppercase, spasi jadi strip.
 * Satu sumber untuk pratinjau form & file PDF agar nomor yang terlihat
 * persis sama dengan nomor yang tercetak.
 */
export const buildInvoiceNumber = (customerName: string, uniq: string): string => {
  const now = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  const ddmmyyyy = `${p(now.getDate())}${p(now.getMonth() + 1)}${now.getFullYear()}`;
  return `RCP/${ddmmyyyy}/${slugCustomer(customerName)}/${(uniq || uniqCode()).toUpperCase()}`;
};

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const addDaysISO = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const STORAGE_KEY = 'nota-app:invoice';
export const HISTORY_KEY = 'nota-app:history';
export const PRODUCTS_KEY = 'nota-app:products';

/** Brand dikunci — tidak bisa diubah dari UI. */
export const BRAND_NAME = 'E.O.D';
export const BRAND_TAGLINE = 'ELECTRO ON DRIP';

export const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const saveToStorage = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};
