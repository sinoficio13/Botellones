'use client';

import { useState } from 'react';
import { QrCodeInline } from '@/app/(dashboard)/botellones/[id]/qr-code';
import { PrintButton } from './print-button';

// Print size reference: 96 CSS px = 25.4 mm (1 inch)
const QR_SIZES = [
  { label: '30 mm', px: 113 },
  { label: '37 mm', px: 140 },
  { label: '45 mm', px: 170 },
];

interface Props {
  codigo: string;
  logoUrl?: string;
  clienteNombre?: string | null;
}

export function LabelPreview({ codigo, logoUrl, clienteNombre }: Props) {
  const [sizePx, setSizePx] = useState(140);

  return (
    <>
      <div className="no-print toolbar">
        <PrintButton />
        <div className="size-selector" role="group" aria-label="Tamaño del código QR">
          <span>Tamaño del QR:</span>
          {QR_SIZES.map((s) => (
            <button
              key={s.px}
              type="button"
              onClick={() => setSizePx(s.px)}
              className={s.px === sizePx ? 'size-btn active' : 'size-btn'}
              aria-pressed={s.px === sizePx}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid">
        <div className="label">
          <QrCodeInline codigo={codigo} size={sizePx} logoUrl={logoUrl} />
          <p className="codigo">{codigo}</p>
          {clienteNombre && <p className="cliente">{clienteNombre}</p>}
        </div>
      </div>
    </>
  );
}
