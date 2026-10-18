export interface LineItem {
  id: string;
  /** Wajib dari katalog — tidak ada input manual dari form receipt. */
  productId: string;
  /** Snapshot gambar produk saat dimasukkan ke nota. */
  image?: string;
  name: string;
  qty: number;
  price: number;
}

/** Barang dagangan di katalog (master data). */
export interface Product {
  id: string;
  name: string;
  price: number;
  /** Foto barang (dataURL). Opsional. */
  image?: string;
}

export interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
}

export interface CustomerInfo {
  name: string;
  address: string;
  phone: string;
}

export interface InvoiceMeta {
  number: string;
  date: string;
  /** Komponen kode unik untuk nomor nota (RCP/TANGGAL/NAMA/<kode unik>). */
  uniq?: string;
  /** Nomor Purchase Order, cth. 2312/2019. */
  poNumber: string;
  currency: string;
  taxRate: number;
  discount: number;
  notes: string;
}

export interface Invoice {
  business: BusinessInfo;
  customer: CustomerInfo;
  /** SHIP TO — tujuan pengiriman, terpisah dari BILL TO. */
  shipTo: CustomerInfo;
  meta: InvoiceMeta;
  items: LineItem[];
}
