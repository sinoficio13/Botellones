'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useSyncExternalStore } from 'react';

interface Props {
  codigo: string;
  size?: number;
  logoUrl?: string | null;
}

export function QrCodeDisplay({ codigo, size = 180, logoUrl }: Props) {
  // React 19 hydration guard — no extra render, no ESLint violation
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return <div style={{ width: size, height: size }} />;
  }

  const url = `${window.location.origin}/b/${codigo}`;

  const imageSettings = logoUrl
    ? {
        src: logoUrl,
        height: size * 0.22,
        width: size * 0.22,
        excavate: true,
      }
    : undefined;

  const handleDownloadSvg = () => {
    const svg = document.querySelector('.qr-svg');
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `QR-${codigo}.svg`;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="qr-svg">
        <QRCodeSVG value={url} size={size} level="H" imageSettings={imageSettings} />
      </div>
      <button
        type="button"
        onClick={handleDownloadSvg}
        className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        Descargar SVG
      </button>
    </div>
  );
}

/** Inline version for print labels */
export function QrCodeInline({ codigo, size = 100, logoUrl }: Props) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return <div style={{ width: size, height: size }} />;
  }

  const url = `${window.location.origin}/b/${codigo}`;

  const imageSettings = logoUrl
    ? {
        src: logoUrl,
        height: size * 0.22,
        width: size * 0.22,
        excavate: true,
      }
    : undefined;

  return (
    <div className="qr-svg">
      <QRCodeSVG value={url} size={size} level="H" imageSettings={imageSettings} />
    </div>
  );
}
