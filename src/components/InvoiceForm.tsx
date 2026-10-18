import { useState } from 'react';
import { Minus, Plus, Search, Trash2, X } from 'lucide-react';
import type { Invoice, Product } from '../types';
import { buildInvoiceNumber, formatCurrency, fmtDMY } from '../utils/helpers';

interface FormProps {
  invoice: Invoice;
  products: Product[];
  onChange: (updater: (prev: Invoice) => Invoice) => void;
  onExport: () => void;
}

/**
 * Form receipt tanpa tabel manual QTY/DESC/PRICE/AMOUNT.
 * Barang hanya bisa masuk dari katalog lewat card picker (CTA + / qty).
 */
export const InvoiceForm = ({ invoice, products, onChange, onExport }: FormProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const updateCustomer = (patch: Partial<Invoice['customer']>) =>
    onChange((prev) => ({ ...prev, customer: { ...prev.customer, ...patch } }));

  const updateMeta = (patch: Partial<Invoice['meta']>) =>
    onChange((prev) => ({ ...prev, meta: { ...prev.meta, ...patch } }));

  const addFromCatalog = (p: Product) =>
    onChange((prev) => {
      const existing = prev.items.find((it) => it.productId === p.id);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.productId === p.id ? { ...it, qty: (Number(it.qty) || 0) + 1, name: p.name, price: p.price, image: p.image } : it,
          ),
        };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          { id: `${p.id}-${Date.now()}`, productId: p.id, image: p.image, name: p.name, qty: 1, price: p.price },
        ],
      };
    });

  const stepQty = (productId: string, delta: number) =>
    onChange((prev) => ({
      ...prev,
      items: prev.items
        .map((it) => (it.productId === productId ? { ...it, qty: Math.max(0, (Number(it.qty) || 0) + delta) } : it))
        .filter((it) => it.qty > 0),
    }));

  const removeItem = (productId: string) =>
    onChange((prev) => ({ ...prev, items: prev.items.filter((it) => it.productId !== productId) }));

  const subtotal = invoice.items.reduce(
    (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0),
    0,
  );
  const currency = invoice.meta.currency || 'IDR';
  const filtered = products.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <section className="receipt-form" aria-label="Form receipt">
      <h2 className="receipt-form__title">form receipt</h2>

      <div className="receipt-form__top">
        <div className="receipt-party">
          <h3>BILL TO</h3>
          <input
            className="receipt-line-input receipt-line-input--strong"
            placeholder="input nama pembeli"
            value={invoice.customer.name}
            onChange={(e) => updateCustomer({ name: e.target.value })}
          />
          <input
            className="receipt-line-input"
            placeholder="input alamat pembeli"
            value={invoice.customer.address}
            onChange={(e) => updateCustomer({ address: e.target.value })}
          />
          <input
            className="receipt-line-input"
            placeholder="input no hape pembeli"
            value={invoice.customer.phone}
            onChange={(e) => updateCustomer({ phone: e.target.value })}
          />
        </div>

        <div className="receipt-meta">
          <div className="receipt-meta__row">
            <span>RECEIPT NO</span>
            <input
              value={buildInvoiceNumber(invoice.customer.name, invoice.meta.uniq || '')}
              readOnly
              title="Nomor ini yang akan tercetak di PDF"
            />
          </div>
          <div className="receipt-meta__row">
            <span>RECEIPT DATE</span>
            <input
              value={fmtDMY(invoice.meta.date)}
              readOnly
              title="Tanggal otomatis oleh sistem saat export"
              placeholder="otomatis saat export"
            />
          </div>
        </div>
      </div>

      <hr className="receipt-rule" />

      <div className="receipt-total">
        <span>Receipt Total</span>
        <strong>
          <span className="receipt-total__cur">Rp</span>
          {subtotal.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
        </strong>
      </div>

      <hr className="receipt-rule" />

      {/* Daftar barang — hanya dari katalog */}
      <div className="picked">
        <div className="picked__head">
          <h3>Barang dibeli</h3>
        </div>

        {invoice.items.length === 0 ? (
          <button type="button" className="picked__empty" onClick={() => setPickerOpen(true)}>
            <Plus size={20} strokeWidth={2.5} />
            <strong>Pilih barang dari katalog</strong>
            <span>Barang hanya bisa dimasukkan dari katalog yang sudah diinput — klik untuk memilih.</span>
          </button>
        ) : (
          <>
          <ul className="picked__list">
            {invoice.items.map((item) => {
              const product = products.find((p) => p.id === item.productId);
              const amount = (Number(item.qty) || 0) * (Number(item.price) || 0);
              return (
                <li key={item.productId} className="picked__card">
                  <div className="picked__img">
                    {item.image || product?.image ? (
                      <img src={item.image ?? product?.image} alt={item.name} />
                    ) : (
                      <span className="cross" aria-hidden="true" />
                    )}
                  </div>
                  <div className="picked__info">
                    <strong>{item.name}</strong>
                    <span>{formatCurrency(item.price, currency)} / pcs</span>
                  </div>
                  <div className="qty-step" aria-label={`Qty ${item.name}`}>
                    <button type="button" onClick={() => stepQty(item.productId, -1)} aria-label="Kurangi">
                      <Minus size={14} strokeWidth={3} />
                    </button>
                    <span>{item.qty}</span>
                    <button type="button" onClick={() => stepQty(item.productId, 1)} aria-label="Tambah">
                      <Plus size={14} strokeWidth={3} />
                    </button>
                  </div>
                  <strong className="picked__amount">{amount.toLocaleString('id-ID')}</strong>
                  <button type="button" className="receipt-del" onClick={() => removeItem(item.productId)} title="Hapus">
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="picked__more" onClick={() => setPickerOpen(true)}>
            + tambah barang lain dari katalog
          </button>
          </>
        )}
      </div>

      {pickerOpen ? (
        <div className="modal-backdrop" onClick={() => setPickerOpen(false)}>
          <div className="modal-card modal-card--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Pilih barang">
            <div className="modal-card__head">
              <h3>Pilih dari katalog</h3>
              <button type="button" className="modal-x" onClick={() => setPickerOpen(false)} aria-label="Tutup">
                <X size={16} />
              </button>
            </div>
            <label className="modal-search">
              <Search size={14} />
              <input
                autoFocus
                placeholder="cari barang…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {products.length === 0 ? (
              <p className="modal-empty">Katalog masih kosong. Tutup ini lalu tekan + tambah barang di strip KATALOG dulu.</p>
            ) : filtered.length === 0 ? (
              <p className="modal-empty">Tidak ketemu. Coba kata kunci lain.</p>
            ) : (
              <ul className="pick-list">
                {filtered.map((p) => (
                  <li key={p.id}>
                    <span className="pick-img">{p.image ? <img src={p.image} alt={p.name} /> : <span className="cross" aria-hidden="true" />}</span>
                    <span className="pick-meta">
                      <strong>{p.name}</strong>
                      <em>{formatCurrency(p.price, currency)}</em>
                    </span>
                    <button
                      type="button"
                      className="pick-add"
                      onClick={() => {
                        addFromCatalog(p);
                        setPickerOpen(false);
                      }}
                      title={`Masukkan ${p.name} (qty +1)`}
                    >
                      <Plus size={16} strokeWidth={3} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <div className="receipt-bottom">
        <div className="receipt-extra">
          <label>
            Pajak (%)
            <input
              type="number"
              min={0}
              value={invoice.meta.taxRate}
              onChange={(e) => updateMeta({ taxRate: Number(e.target.value) })}
            />
          </label>
          <label>
            Diskon
            <input
              type="number"
              min={0}
              value={invoice.meta.discount}
              onChange={(e) => updateMeta({ discount: Number(e.target.value) })}
            />
          </label>
          <label>
            Currency
            <input value={currency} onChange={(e) => updateMeta({ currency: e.target.value.toUpperCase() })} />
          </label>
          <label className="receipt-extra__notes">
            Catatan
            <input
              placeholder="terima kasih…"
              value={invoice.meta.notes}
              onChange={(e) => updateMeta({ notes: e.target.value })}
            />
          </label>
        </div>
        <div className="receipt-subtotal">
          <span>Subtotal</span>
          <strong>{subtotal.toLocaleString('id-ID', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      <div className="receipt-export">
        <button type="button" className="export-btn" onClick={onExport}>
          EXPORT
        </button>
      </div>
    </section>
  );
};
