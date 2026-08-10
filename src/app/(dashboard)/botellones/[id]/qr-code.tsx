'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useState, useEffect } from 'react';

interface Props {
  codigo: string;
  size?: number;
}

export function QrCodeDisplay({ codigo, size = 180 }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ width: size, height: size }} />;
  }

  const url = `${window.location.origin}/b/${codigo}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <QRCodeSVG value={url} size={size} level="M" />
      <button
        onClick={() => {
          const svg = document.querySelector('.qr-svg');
          if (!svg) return;
          const clone = svg.cloneNode(true) as SVGElement;
          const data = new XMLSerializer().serializeToString(clone);
          const blob = new Blob([data], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `QR-${codigo}.svg`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        Descargar SVG
      </button>
    </div>
  );
}

/** Inline version for print labels */
export function QrCodeInline({ codigo, size = 100 }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ width: size, height: size }} />;
  }

  const url = `${window.location.origin}/b/${codigo}`;
  return (
    <div className="qr-svg">
      <QRCodeSVG value={url} size={size} level="M" />
    </div>
  );
}
