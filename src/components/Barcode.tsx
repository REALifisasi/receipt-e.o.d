import { useMemo } from 'react';

interface BarcodeProps {
  seed: string;
}

/** Barcode dekoratif bergaya Code39, dibuat deterministik dari seed string. */
export const Barcode = ({ seed }: BarcodeProps) => {
  const bars = useMemo(() => {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    let x = h >>> 0 || 0x9e3779b9;
    const widths: number[] = [];
    for (let i = 0; i < 72; i++) {
      x ^= x << 13;
      x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5;
      x >>>= 0;
      widths.push(1 + (x % 3));
    }
    return widths;
  }, [seed]);

  return (
    <div className="barcode" aria-hidden="true">
      {bars.map((w, i) => (
        <span key={i} style={{ width: `${w}px` }} />
      ))}
    </div>
  );
};
