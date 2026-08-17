import { getBotellon } from '@/lib/db/botellones';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getConfiguracion } from '@/lib/db/configuracion';
import { LabelPreview } from './label-preview';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const botellon = await getBotellon(id);
  return { title: `Etiqueta ${botellon?.codigo ?? ''}` };
}

export default async function ImprimirPage({ params }: Props) {
  const { id } = await params;
  const botellon = await getBotellon(id);
  if (!botellon) notFound();

  const config = await getConfiguracion();
  const logoUrl = config.logo_url ?? undefined;

  return (
    <div className="print-page">
      <style>{`
        @page { size: A4; margin: 8mm; }
        @media print {
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        * { box-sizing: border-box; }
        .print-page { font-family: system-ui, sans-serif; }
        .grid { display: grid; place-items: center; height: 100vh; }
        .label {
          width: 70mm;
          border: 1px dashed #999; border-radius: 6px; padding: 4mm;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; page-break-inside: avoid;
        }
        .label .codigo { font-family: monospace; font-size: 14px; font-weight: 600; margin-top: 2mm; }
        .label .cliente { font-size: 11px; color: #555; margin-top: 1mm; }
        .toolbar { display: flex; gap: 1.5rem; align-items: center; justify-content: center; padding: 1rem; text-align: center; flex-wrap: wrap; }
        .size-selector { display: flex; gap: 0.5rem; align-items: center; font-size: 14px; }
        .size-btn { padding: 0.3rem 0.8rem; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; background: #fff; color: #111; font-size: 13px; }
        .size-btn.active { background: #111; color: #fff; border-color: #111; }
        .no-print { text-align: center; padding: 1rem; }
        @media print { .no-print { display: none; } }
      `}</style>

      <LabelPreview
        codigo={botellon.codigo}
        logoUrl={logoUrl}
        clienteNombre={botellon.clientes?.nombre ?? null}
      />
    </div>
  );
}
