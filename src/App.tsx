import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, History, Search, Trash2, Upload, X } from 'lucide-react';
import type { Invoice, Product } from './types';
import { InvoiceForm } from './components/InvoiceForm';
import { InvoicePreview } from './components/InvoicePreview';
import { ProductManager } from './components/ProductManager';
import { ReceiptCard } from './components/ReceiptCard';
import {
  HISTORY_KEY,
  PRODUCTS_KEY,
  STORAGE_KEY,
  buildInvoiceNumber,
  calculateTotals,
  loadFromStorage,
  saveToStorage,
  todayISO,
  uniqCode,
} from './utils/helpers';

export const DEFAULT_BUSINESS_NAME = 'E.O.D (Electro On Drip)';

const emptyCustomer = () => ({ name: '', address: '', phone: '' });

const createEmptyInvoice = (): Invoice => ({
  business: {
    name: DEFAULT_BUSINESS_NAME,
    address: '',
    phone: '',
    email: '',
    logo: undefined,
  },
  customer: emptyCustomer(),
  shipTo: emptyCustomer(),
  meta: {
    number: '',
    date: todayISO(),
    uniq: uniqCode(),
    poNumber: '',
    currency: 'IDR',
    /** Sales tax dihapus — total hanya subtotal - diskon. */
    taxRate: 0,
    discount: 0,
    notes: '',
  },
  items: [],
});

/** Normalisasi draft lama: buang dueDate, boleh kosong, sinkron snapshot katalog. */
const normalize = (stored: Invoice, products: Product[] = []): Invoice => {
  const rawItems = Array.isArray(stored.items) ? stored.items : [];
  const items = rawItems
    .filter((it) => it && (it.productId || it.name))
    .map((it) => {
      const p = products.find((x) => x.id === (it as { productId?: string }).productId);
      return {
        ...it,
        productId: (it as { productId?: string }).productId ?? `legacy-${it.id}`,
        name: p?.name ?? it.name,
        price: p?.price ?? it.price,
        image: p?.image ?? it.image,
      };
    });
  const { dueDate: _drop, ...meta } = (stored.meta ?? {}) as Invoice['meta'] & { dueDate?: string };
  void _drop;
  return {
    ...stored,
    business: {
      ...stored.business,
      name:
        !stored.business?.name?.trim() || stored.business.name === 'E.O.D (Electro On Design)'
          ? DEFAULT_BUSINESS_NAME
          : stored.business.name,
    },
    customer: { ...emptyCustomer(), ...(stored.customer ?? {}) },
    shipTo: { ...emptyCustomer(), ...((stored as Partial<Invoice>).shipTo ?? {}) },
    meta: {
      // Komponen kode unik nota; kode lama (mis. INV/…) dibuang.
      number: '',
      uniq: (meta as { uniq?: string }).uniq || uniqCode(),
      date: meta.date || todayISO(),
      poNumber: (meta as { poNumber?: string }).poNumber ?? '',
      currency: meta.currency || 'IDR',
      taxRate: Number(meta.taxRate) || 0,
      discount: Number(meta.discount) || 0,
      notes: meta.notes ?? '',
    },
    items,
  };
};

interface HistoryEntry {
  id: string;
  savedAt: number;
  invoice: Invoice;
  /** Jepretan gambar struk (jpeg dataURL) saat export. */
  snapshot?: string;
}

/** Simpan riwayat; bila penyimpanan penuh, ulangi tanpa gambar. */
const persistHistory = (next: HistoryEntry[]): void => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    try {
      const slim = next.map(({ snapshot: _drop, ...rest }) => {
        void _drop;
        return rest;
      });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(slim));
    } catch {
      /* storage unavailable */
    }
  }
};

export default function App() {
  const [products, setProducts] = useState<Product[]>(() =>
    loadFromStorage<Product[]>(PRODUCTS_KEY, []),
  );
  const [invoice, setInvoice] = useState<Invoice>(() =>
    normalize(
      loadFromStorage<Invoice>(STORAGE_KEY, createEmptyInvoice()),
      loadFromStorage<Product[]>(PRODUCTS_KEY, []),
    ),
  );
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    loadFromStorage<HistoryEntry[]>(HISTORY_KEY, []),
  );
  const [historyQuery, setHistoryQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const snapshotRef = useRef<HTMLDivElement>(null);

  /** TOTAL = akumulasi seluruh nota yang sudah dibuat (riwayat). */
  const historyTotal = useMemo(
    () => history.reduce((sum, entry) => sum + calculateTotals(entry.invoice).total, 0),
    [history],
  );

  useEffect(() => {
    saveToStorage(STORAGE_KEY, invoice);
  }, [invoice]);

  useEffect(() => {
    saveToStorage(PRODUCTS_KEY, products);
  }, [products]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const updateInvoice = useCallback(
    (updater: (prev: Invoice) => Invoice) => setInvoice((prev) => updater(prev)),
    [],
  );

  const updateProducts = useCallback(
    (updater: (prev: Product[]) => Product[]) => setProducts((prev) => updater(prev)),
    [],
  );

  /**
   * EXPORT = 3 output sekaligus:
   * 1) kode receipt diacak baru, lalu unduh PDF,
   * 2) nota tersimpan otomatis ke riwayat (localStorage, bisa dicari),
   * 3) jepretan gambar struk tersimpan di entri riwayat.
   */
  const handleExport = useCallback(async () => {
    if (invoice.items.length === 0) {
      showToast('Pilih dulu barang dari katalog.');
      return;
    }
    if (!invoice.customer.name.trim()) {
      showToast('Isi dulu nama pembeli di BILL TO.');
      return;
    }
    // Nomor yang tercetak = nomor yang ditampilkan di form (satu sumber, sistem).
    const freshNumber = buildInvoiceNumber(
      invoice.customer.name,
      invoice.meta.uniq || uniqCode(),
    );
    const stamped: Invoice = {
      ...invoice,
      meta: { ...invoice.meta, number: freshNumber, date: todayISO() },
    };
    setInvoice(stamped);
    // Tunggu panggung jepretan me-render data terbaru
    await new Promise((r) => setTimeout(r, 120));

    let snapshot: string | undefined;
    try {
      const { default: html2canvas } = await import('html2canvas');
      if (snapshotRef.current) {
        const canvas = await html2canvas(snapshotRef.current, {
          backgroundColor: '#ffffff',
          scale: 0.8,
        });
        snapshot = canvas.toDataURL('image/jpeg', 0.72);
      }
    } catch {
      snapshot = undefined;
    }

    const { downloadPDF } = await import('./utils/pdf');
    downloadPDF(stamped);

    const entry: HistoryEntry = {
      id: Math.random().toString(36).slice(2, 9),
      savedAt: Date.now(),
      invoice: JSON.parse(JSON.stringify(stamped)) as Invoice,
      snapshot,
    };
    const next = [entry, ...history].slice(0, 20);
    setHistory(next);
    persistHistory(next);
    showToast(`Export ${freshNumber}: PDF + riwayat tersimpan.`);
  }, [history, invoice, showToast]);

  const loadEntry = useCallback(
    (entry: HistoryEntry) => {
      setInvoice(normalize(entry.invoice, products));
      setSelectedId(null);
      showToast('Nota dimuat dari riwayat.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [products, showToast],
  );

  const downloadEntry = useCallback(async (entry: HistoryEntry) => {
    const { downloadPDF } = await import('./utils/pdf');
    downloadPDF(entry.invoice);
  }, []);

  const deleteEntry = useCallback(
    (id: string) => {
      const next = history.filter((h) => h.id !== id);
      setHistory(next);
      persistHistory(next);
      if (selectedId === id) setSelectedId(null);
    },
    [history, selectedId],
  );

  const filteredHistory = history.filter((entry) => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return true;
    const hay = `${entry.invoice.meta.number} ${entry.invoice.customer.name} ${entry.invoice.shipTo?.name} ${entry.invoice.items.map((i) => i.name).join(' ')}`.toLowerCase();
    return hay.includes(q);
  });

  return (
    <div className="page">
      <span className="corner corner--tl" aria-hidden="true" />
      <span className="corner corner--tr" aria-hidden="true" />
      <span className="corner corner--bl" aria-hidden="true" />
      <span className="corner corner--br" aria-hidden="true" />
      <header className="brand">
        <h1>
          E.O.D
          <span>Receipt</span>
        </h1>
        <div className="brand__lines" aria-hidden="true">
          <span />
          <i />
          <span />
        </div>
        <div className="brand__tools">
          <span className="brand__total">Total: {historyTotal.toLocaleString('id-ID')}</span>
        </div>
      </header>

      <ProductManager
        products={products}
        onChange={updateProducts}
        currency={invoice.meta.currency}
      />

      <main className="sheet">
        <InvoiceForm
          invoice={invoice}
          products={products}
          onChange={updateInvoice}
          onExport={handleExport}
        />
      </main>

      <section className="history-strip">
        <h2>
          <History size={15} /> Riwayat ({filteredHistory.length}/{history.length})
        </h2>
        <label className="history-search">
          <Search size={14} />
          <input
            placeholder="cari nomor / nama / barang…"
            value={historyQuery}
            onChange={(e) => setHistoryQuery(e.target.value)}
          />
        </label>
        {filteredHistory.length === 0 ? (
          <p className="history-empty">
            {history.length === 0
              ? 'Belum ada riwayat. Setiap menekan EXPORT, nota otomatis tersimpan di sini + PDF terunduh.'
              : 'Tidak ketemu. Coba kata kunci lain.'}
          </p>
        ) : (
          <ul>
            {filteredHistory.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => setSelectedId(entry.id)} title="Lihat gambar struk">
                  <strong>{entry.invoice.meta.number || 'Tanpa nomor'}</strong>
                  <span>
                    {entry.invoice.customer.name || entry.invoice.shipTo?.name || 'Tanpa pelanggan'} ·{' '}
                    {new Date(entry.savedAt).toLocaleString('id-ID')}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Hapus riwayat"
                  onClick={() => deleteEntry(entry.id)}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="print-only">
        <InvoicePreview invoice={invoice} />
      </div>

      {/* Panggung jepretan: di luar layar, selalu mengikuti nota aktif */}
      <div className="snapshot-stage" aria-hidden="true">
        <div ref={snapshotRef}>
          <ReceiptCard invoice={invoice} />
        </div>
      </div>

      {/* Kartu arsip: gambar struk dari riwayat yang ditekan */}
      {(() => {
        const entry = history.find((h) => h.id === selectedId);
        if (!entry) return null;
        return (
          <div className="modal-backdrop" onClick={() => setSelectedId(null)}>
            <div
              className="modal-card modal-card--wide record-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={`Arsip ${entry.invoice.meta.number}`}
            >
              <div className="modal-card__head">
                <h3>{entry.invoice.meta.number || 'Tanpa nomor'}</h3>
                <button type="button" className="modal-x" onClick={() => setSelectedId(null)} aria-label="Tutup">
                  <X size={16} />
                </button>
              </div>
              <p className="record-meta">
                {entry.invoice.customer.name || 'Tanpa pelanggan'} ·{' '}
                {new Date(entry.savedAt).toLocaleString('id-ID')}
              </p>
              <div className="record-shot">
                {entry.snapshot ? (
                  <img src={entry.snapshot} alt={`Struk ${entry.invoice.meta.number}`} />
                ) : (
                  <ReceiptCard invoice={entry.invoice} />
                )}
              </div>
              <div className="modal-card__actions record-actions">
                <button type="button" className="modal-btn modal-btn--ghost" onClick={() => void downloadEntry(entry)}>
                  <Download size={15} /> PDF
                </button>
                <button type="button" className="modal-btn modal-btn--ok" onClick={() => loadEntry(entry)}>
                  <Upload size={15} /> Muat ke form
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <footer className="foot">
        <p>E.O.D — Electro On Drip · Nota &amp; Receipt</p>
      </footer>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
