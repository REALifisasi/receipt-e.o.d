import { useRef, useState } from 'react';
import { ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Product } from '../types';
import { formatCurrency, uid } from '../utils/helpers';

interface ProductManagerProps {
  products: Product[];
  onChange: (updater: (prev: Product[]) => Product[]) => void;
  currency: string;
}

const EMPTY_DRAFT = { id: '', name: '', price: 0, image: '' };

/** Resolusi post feed IG: 1080x1350 (rasio 4:5). */
const IG_W = 1080;
const IG_H = 1350;

/** Baca file gambar jadi dataURL lalu samakan ke resolusi post feed IG (crop tengah), apapun file yang diupload. */
const readImageFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = IG_W;
        canvas.height = IG_H;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Crop tengah (object-fit: cover) agar rasio apapun penuh 4:5.
          const scale = Math.max(IG_W / img.width, IG_H / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, IG_W, IG_H);
          ctx.drawImage(img, (IG_W - w) / 2, (IG_H - h) / 2, w, h);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => resolve(String(reader.result ?? ''));
      img.src = String(reader.result ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * Strip KATALOG: tile "+" membuka popup card (gambar, nama, harga).
 * Tile produk hanya display master data — TIDAK menambah ke nota.
 * Barang masuk nota hanya lewat kartu picker di form receipt.
 */
export const ProductManager = ({ products, onChange, currency }: ProductManagerProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const fileRef = useRef<HTMLInputElement>(null);

  const openAdd = () => {
    setDraft(EMPTY_DRAFT);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setDraft({ id: p.id, name: p.name, price: p.price, image: p.image ?? '' });
    setModalOpen(true);
  };

  const close = () => {
    setModalOpen(false);
    setDraft(EMPTY_DRAFT);
  };

  const save = () => {
    const clean = draft.name.trim();
    if (!clean) return;
    if (draft.id) {
      const id = draft.id;
      onChange((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, name: clean, price: Number(draft.price) || 0, image: draft.image || undefined } : p,
        ),
      );
    } else {
      onChange((prev) => [
        ...prev,
        { id: uid(), name: clean, price: Number(draft.price) || 0, image: draft.image || undefined },
      ]);
    }
    close();
  };

  const removeProduct = (id: string) => {
    if (!window.confirm('Hapus barang ini dari katalog?')) return;
    onChange((prev) => prev.filter((p) => p.id !== id));
  };

  const pickFile = async (file?: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      setDraft((d) => ({ ...d, image: dataUrl }));
    } catch {
      /* abaikan */
    }
  };

  return (
    <section className="katalog" aria-label="Katalog barang">
      <h2 className="katalog__title">KATALOG</h2>

      <div className="katalog__row">
        <div className="katalog-tile katalog-tile--add">
          <button type="button" className="katalog-tile__box" onClick={openAdd} title="Tambah barang">
            <Plus size={22} strokeWidth={2.5} />
            <span className="katalog-tile__caption">tambah barang</span>
          </button>
        </div>

        {products.map((p) => (
          <div className="katalog-tile" key={p.id}>
            <div
              className="katalog-tile__box katalog-tile__box--img katalog-tile__box--static"
              title={p.name}
            >
              {p.image ? (
                <img src={p.image} alt={p.name} className="katalog-tile__img" />
              ) : (
                <span className="cross" aria-hidden="true" />
              )}
            </div>
            <p className="katalog-tile__caption katalog-tile__caption--meta">
              {p.name} · {formatCurrency(p.price, currency)}
            </p>
            <div className="katalog-tile__tools">
              <button type="button" className="tool-btn" title="Ubah" onClick={() => openEdit(p)}>
                <Pencil size={12} />
              </button>
              <button type="button" className="tool-btn tool-btn--danger" title="Hapus" onClick={() => removeProduct(p.id)}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}

        {products.length === 0 ? (
          <p className="katalog__hint">Klik + untuk menambah barang pertama (gambar, nama, harga). Barang dimasukkan ke nota lewat kartu picker di form receipt.</p>
        ) : null}
      </div>

      {modalOpen ? (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Tambah barang">
            <div className="modal-card__head">
              <h3>{draft.id ? 'Ubah barang' : 'Tambah barang'}</h3>
              <button type="button" className="modal-x" onClick={close} aria-label="Tutup">
                <X size={16} />
              </button>
            </div>

            <button
              type="button"
              className="modal-img"
              onClick={() => fileRef.current?.click()}
              title="Upload gambar barang"
            >
              {draft.image ? (
                <img src={draft.image} alt="Pratinjau barang" />
              ) : (
                <span>
                  <ImagePlus size={22} />
                  <em>input gambar</em>
                </span>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void pickFile(e.target.files?.[0])}
            />

            <label className="modal-field">
              <span>nama barang</span>
              <input
                autoFocus
                placeholder="cth. Kabel USB-C"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') close();
                }}
              />
            </label>
            <label className="modal-field">
              <span>harga</span>
              <input
                type="number"
                min={0}
                placeholder="cth. 50000"
                value={draft.price || ''}
                onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') close();
                }}
              />
            </label>

            <div className="modal-card__actions">
              <button type="button" className="modal-btn modal-btn--ghost" onClick={close}>
                Batal
              </button>
              <button type="button" className="modal-btn modal-btn--ok" onClick={save} disabled={!draft.name.trim()}>
                Simpan barang
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
