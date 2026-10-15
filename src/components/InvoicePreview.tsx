import { forwardRef } from 'react';
import type { Invoice } from '../types';
import { calculateTotals, formatCurrency, formatReceiptDate } from '../utils/helpers';
import { Barcode } from './Barcode';

interface PreviewProps {
  invoice: Invoice;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Kertas nota gaya struk thermal (ala Receiptify). */
export const InvoicePreview = forwardRef<HTMLDivElement, PreviewProps>(
  ({ invoice }, ref) => {
    const totals = calculateTotals(invoice);
    const currency = invoice.meta.currency;
    const itemCount = invoice.items.reduce(
      (sum, it) => sum + (Number(it.qty) || 0),
      0,
    );
    const brand = invoice.business.name || 'E.O.D';
    const contact = invoice.business.phone || invoice.business.email || '';

    return (
      <div className="preview-wrap preview-wrap--receipt">
        <div className="receipt" ref={ref} id="invoice-paper">
          <div className="receipt__brand">
            <h1>{brand}</h1>
            <p className="receipt__sub">Nota Pembelian</p>
          </div>

          <div className="receipt__sep" />

          <div className="receipt__order">
            <div>
              NOTA {invoice.meta.number || '-'} UNTUK{' '}
              {invoice.customer.name || '-'}
            </div>
            <div>{formatReceiptDate(invoice.meta.date)}</div>
          </div>

          <div className="receipt__sep" />

          <div className="receipt__cols">
            <span>QTY</span>
            <span>ITEM</span>
            <span className="receipt__amt">AMT</span>
          </div>

          <div className="receipt__sep" />

          <div className="receipt__items">
            {invoice.items.map((item) => (
              <div className="receipt__row" key={item.id}>
                <span>{pad2(Number(item.qty) || 0)}</span>
                <span>{item.name || '-'}</span>
                <span className="receipt__amt">
                  {formatCurrency(
                    (Number(item.qty) || 0) * (Number(item.price) || 0),
                    currency,
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="receipt__sep" />

          <div className="receipt__lines">
            <div className="receipt__line">
              <span>ITEM COUNT:</span>
              <span>{itemCount}</span>
            </div>
            {totals.discount > 0 ? (
              <div className="receipt__line">
                <span>DISKON:</span>
                <span>- {formatCurrency(totals.discount, currency)}</span>
              </div>
            ) : null}
            {totals.tax > 0 ? (
              <div className="receipt__line">
                <span>PAJAK ({invoice.meta.taxRate || 0}%):</span>
                <span>{formatCurrency(totals.tax, currency)}</span>
              </div>
            ) : null}
            <div className="receipt__line receipt__line--grand">
              <span>TOTAL:</span>
              <span>{formatCurrency(totals.total, currency)}</span>
            </div>
          </div>

          <div className="receipt__sep" />

          <div className="receipt__foot">
            <div>PELANGGAN: {invoice.customer.name || '-'}</div>
            <div>NOTA: {invoice.meta.number || '-'}</div>
            {invoice.meta.notes ? <div>CATATAN: {invoice.meta.notes}</div> : null}
          </div>

          <p className="receipt__thanks">TERIMA KASIH ATAS KUNJUNGAN ANDA!</p>

          <Barcode seed={`${invoice.meta.number}-${totals.total}`} />
          <p className="receipt__site">{contact || brand.toLowerCase()}</p>
        </div>
      </div>
    );
  },
);

InvoicePreview.displayName = 'InvoicePreview';
