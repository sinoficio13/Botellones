import { getBotellon } from '@/lib/db/botellones';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { QrCodeInline } from '../qr-code';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ImprimirPage({ params }: Props) {
  const { id } = await params;
  const botellon = await getBotellon(id);
  if (!botellon) notFound();

  let negocio = 'Botellón';
  let logoUrl: string | undefined;
  if (process.env.NEXT_PUBLIC_AUTH_MODE === 'dev') {
    const cookieStore = await cookies();
    const raw = cookieStore.get('botellon_config')?.value;
    if (raw) {
      try {
        const config = JSON.parse(raw);
        negocio = config.nombre_negocio || negocio;
        logoUrl = config.logo_url;
      } catch { /* ignore */ }
    }
  }

  // Duplicate for 4 labels per A4 (2 cols × 2 rows)
  const labels = Array.from({ length: 4 });

  return (
    <html>
      <head>
        <title>Etiqueta {botellon.codigo}</title>
        <style>{`
          @page { size: A4; margin: 8mm; }
          @media print {
            body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
          }
          * { box-sizing: border-box; }
          body { font-family: system-ui, sans-serif; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 4mm; height: 100vh; }
          .label { 
            border: 1px dashed #999; border-radius: 6px; padding: 4mm;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            text-align: center; page-break-inside: avoid;
          }
          .label .codigo { font-family: monospace; font-size: 14px; font-weight: 600; margin-top: 2mm; }
          .label .cliente { font-size: 11px; color: #555; margin-top: 1mm; }
          .no-print { text-align: center; padding: 1rem; }
          @media print { .no-print { display: none; } }
        `}</style>
      </head>
      <body>
        <div className="no-print" style={{ padding: 16, textAlign: 'center' }}>
          <p>Vista previa — <button onClick={() => window.print()} style={{ cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', fontSize: 'inherit' }}>Imprimir</button></p>
        </div>
        <div className="grid">
          {labels.map((_, i) => (
            <div key={i} className="label">
              {logoUrl ? (
                <Image src={logoUrl} alt={negocio} width={120} height={24} style={{ maxWidth: 120, maxHeight: 24 }} />
              ) : (
                <p style={{ fontSize: 12, fontWeight: 600 }}>{negocio}</p>
              )}
              <QrCodeInline codigo={botellon.codigo} size={90} />
              <p className="codigo">{botellon.codigo}</p>
              {botellon.clientes?.nombre && (
                <p className="cliente">{botellon.clientes.nombre}</p>
              )}
            </div>
          ))}
        </div>
      </body>
    </html>
  );
}
