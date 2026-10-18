import type { Invoice } from '../types';
import { buildInvoiceNumber, calculateTotals } from '../utils/helpers';

const money = (n: number): string =>
  (Number(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDMY = (iso: string): string => {
  if (!iso) return '-';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
};

const dueDMY = (iso: string): string => {
  const base = iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso) : new Date();
  if (Number.isNaN(base.getTime())) return '-';
  base.setDate(base.getDate() + 15);
  const p = (x: number): string => String(x).padStart(2, '0');
  return `${p(base.getDate())}/${p(base.getMonth() + 1)}/${base.getFullYear()}`;
};

/**
 * Kartu struk putih ala template PDF (bar biru, BILL/SHIP TO,
 * Receipt Total, tabel barang, terms). Dipakai sebagai pratinjau
 * arsip riwayat sekaligus sumber jepretan gambar saat export.
 */
export const ReceiptCard = ({ invoice }: { invoice: Invoice }) => {
  const totals = calculateTotals(invoice);
  const biz = invoice.business?.name || 'E.O.D';
  const symbol = (invoice.meta.currency || '').toUpperCase() === 'IDR' ? 'Rp' : '$';
  const bizLines = [invoice.business?.address, invoice.business?.phone, invoice.business?.email].filter(
    (x): x is string => Boolean(x && x.trim()),
  );

  const party = (title: string, c: { name?: string; address?: string; phone?: string }) => (
    <div className="rc-col">
      <b>{title}</b>
      <p>{c.name?.trim() || '-'}</p>
      <p>{c.address?.trim() || '-'}</p>
      <p>{c.phone?.trim() || '-'}</p>
    </div>
  );

  const pendingNumber =
    invoice.meta.number || buildInvoiceNumber(invoice.customer.name, invoice.meta.uniq || '');

  return (
    <div className="rc">
      <div className="rc-bar" />
      <div className="rc-biz">
        <h4>{biz}</h4>
        {bizLines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      <div className="rc-cols">
        {party('BILL TO', invoice.customer ?? { name: '', address: '', phone: '' })}
        <div className="rc-col">
          <div className="rc-mrow"><b>RECEIPT NO</b><span>{pendingNumber}</span></div>
          <div className="rc-mrow"><b>RECEIPT DATE</b><span>{fmtDMY(invoice.meta.date)}</span></div>
          <div className="rc-mrow"><b>DUE DATE</b><span>{dueDMY(invoice.meta.date)}</span></div>
        </div>
      </div>
      <hr className="rc-rule" />
      <div className="rc-total">
        <span>Receipt Total</span>
        <strong>{symbol}{money(totals.total)}</strong>
      </div>
      <hr className="rc-rule" />
      <table className="rc-table">
        <thead>
          <tr>
            <th>QTY</th>
            <th>DESCRIPTION</th>
            <th className="rc-num">UNIT PRICE</th>
            <th className="rc-num">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => {
            const qty = Number(item.qty) || 0;
            const price = Number(item.price) || 0;
            return (
              <tr key={item.productId + item.id}>
                <td>{qty}</td>
                <td>{item.name || '-'}</td>
                <td className="rc-num">{money(price)}</td>
                <td className="rc-num">{money(qty * price)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="rc-sums">
        <div><b>Subtotal</b><span>{money(totals.subtotal)}</span></div>
        {totals.discount > 0 ? <div><b>Discount</b><span>- {money(totals.discount)}</span></div> : null}
        {totals.tax > 0 ? <div><b>Sales Tax {Number(invoice.meta.taxRate) || 0}%</b><span>{money(totals.tax)}</span></div> : null}
      </div>
      <div className="rc-sign">{invoice.customer?.name?.trim() || ''}</div>
      <div className="rc-terms">
        <b>TERMS &amp; CONDITIONS</b>
        <p>Payment is due within 15 days</p>
        <p>Please make checks payable to: {biz}</p>
        {invoice.meta.notes?.trim() ? <p>Note: {invoice.meta.notes.trim()}</p> : null}
      </div>
      <div className="rc-bar" />
    </div>
  );
};
