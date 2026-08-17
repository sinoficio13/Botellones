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
        * { box-sizing: border-box; }
        .print-page {
          font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
          background: #f1f5f9;
          min-height: 100vh;
        }
        .grid { display: grid; place-items: center; min-height: 100vh; padding: 20px 0; }

        .label {
          width: 78mm;
          border-radius: 16px;
          overflow: hidden;
          background: #ffffff;
          border: 1.5px dashed #cbd5e1;
          box-shadow: 0 6px 24px rgba(2, 132, 199, 0.14);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          page-break-inside: avoid;
        }

        .label-top {
          width: 100%;
          padding: 13px 14px 12px;
          background: linear-gradient(135deg, #0c4a6e 0%, #0e7490 45%, #06b6d4 100%);
          color: #ffffff;
        }
        .label-name {
          margin: 0;
          font-size: 21px;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.15;
        }
        .label-slogan {
          margin: 3px 0 0;
          font-size: 11px;
          font-weight: 500;
          font-style: italic;
          color: rgba(255, 255, 255, 0.92);
        }

        .label-qr {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 7px;
          padding: 16px 12px 6px;
        }
        .label-cta {
          margin: 0;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #0e7490;
        }

        .label-whatsapp {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 2px 0 8px;
          padding: 5px 12px;
          border-radius: 999px;
          background: #f0fdf4;
          color: #15803d;
          font-size: 13px;
          font-weight: 700;
        }

        .label-code {
          margin: 0 0 11px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 10px;
          letter-spacing: 0.14em;
          color: #64748b;
          text-transform: uppercase;
        }

        .toolbar { display: flex; gap: 1.5rem; align-items: center; justify-content: center; padding: 1rem; text-align: center; flex-wrap: wrap; }
        .size-selector { display: flex; gap: 0.5rem; align-items: center; font-size: 14px; color: #334155; }
        .size-btn { padding: 0.3rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; background: #ffffff; color: #0f172a; font-size: 13px; }
        .size-btn.active { background: #0e7490; color: #ffffff; border-color: #0e7490; }
        .no-print { text-align: center; padding: 1rem; }

        @media print {
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-page { background: #ffffff; }
          .label { box-shadow: none; }
          .no-print { display: none !important; }
        }
      `}</style>

      <LabelPreview
        codigo={botellon.codigo}
        logoUrl={logoUrl}
        negocio={config.nombre_negocio}
        eslogan={config.eslogan}
        cta={config.cta_qr}
        telefono={config.telefono}
      />
    </div>
  );
}
