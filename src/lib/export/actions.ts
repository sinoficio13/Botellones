'use server';

import { pdf } from '@react-pdf/renderer';
import { getBusinessInfo } from '@/lib/export/helpers';
import { getClientes, getCliente, type ClienteListRow } from '@/lib/db/clientes';
import {
  getRecargasPorDia,
  getTopClientes,
  getBotellonesPorEstado,
} from '@/lib/db/analytics';
import { getPremios } from '@/lib/db/premios';
import { getBotellones } from '@/lib/db/botellones';
import { getContadores, getRecargasCliente } from '@/lib/db/recargas';
import { getDireccion } from '@/lib/db/direcciones';
import { ClientesPdf } from '@/lib/export/pdf/clientes-pdf';
import { RecargasPdf } from '@/lib/export/pdf/recargas-pdf';
import { BotellonesPdf } from '@/lib/export/pdf/botellones-pdf';
import { FidelidadPdf } from '@/lib/export/pdf/fidelidad-pdf';
import { ClienteFichaPdf } from '@/lib/export/pdf/cliente-ficha-pdf';
import {
  generateClientesExcel,
  generateRecargasExcel,
  generateBotellonesExcel,
} from '@/lib/export/excel/generators';
import type { ExportResult } from '@/lib/export/types';

// ── Helpers ──

function dateFilename(prefix: string, ext: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${prefix}_${y}${m}${d}.${ext}`;
}

async function pdfToBase64(document: React.ReactElement): Promise<string> {
  const instance = pdf(document);
  const buffer = await instance.toBuffer();
  return buffer.toString('base64');
}

// ── PDF exports ──

export async function exportClientesPDF(): Promise<ExportResult> {
  const info = await getBusinessInfo();
  const { clientes } = await getClientes(1, 100);

  const base64 = await pdfToBase64(
    <ClientesPdf clientes={clientes} info={info} />
  );

  return { base64, filename: dateFilename('clientes', 'pdf') };
}

export async function exportRecargasPDF(): Promise<ExportResult> {
  const info = await getBusinessInfo();
  const [recargasPorDia, topClientes, contadores] = await Promise.all([
    getRecargasPorDia(30),
    getTopClientes(20),
    getContadores(),
  ]);

  const base64 = await pdfToBase64(
    <RecargasPdf
      recargasPorDia={recargasPorDia}
      topClientes={topClientes}
      contadores={contadores}
      info={info}
    />
  );

  return { base64, filename: dateFilename('recargas', 'pdf') };
}

export async function exportBotellonesPDF(): Promise<ExportResult> {
  const info = await getBusinessInfo();
  const [botellonesResult, estados] = await Promise.all([
    getBotellones(1, 100),
    getBotellonesPorEstado(),
  ]);

  const base64 = await pdfToBase64(
    <BotellonesPdf
      botellones={botellonesResult.botellones as any[]}
      estados={estados}
      info={info}
    />
  );

  return { base64, filename: dateFilename('botellones', 'pdf') };
}

export async function exportFidelidadPDF(): Promise<ExportResult> {
  const info = await getBusinessInfo();
  const [pendientes, entregados] = await Promise.all([
    getPremios('pendiente', 1),
    getPremios('entregado', 1),
  ]);

  const base64 = await pdfToBase64(
    <FidelidadPdf
      pendientes={pendientes.premios}
      entregados={entregados.premios}
      info={info}
    />
  );

  return { base64, filename: dateFilename('fidelidad', 'pdf') };
}

export async function exportClienteFichaPDF(
  clienteId: string
): Promise<ExportResult> {
  const info = await getBusinessInfo();
  const cliente = await getCliente(clienteId);

  if (!cliente) {
    throw new Error('Cliente no encontrado');
  }

  const [{ recargas }, premios, direccion] = await Promise.all([
    getRecargasCliente(clienteId),
    import('@/lib/db/premios').then((m) => m.getPremiosByCliente(clienteId)),
    getDireccion(clienteId),
  ]);

  const recargaItems = (recargas || []).slice(0, 50).map((r: any) => ({
    fecha: r.fecha,
    hora: r.hora,
    botellon_codigo: r.botellones?.codigo ?? undefined,
  }));

  const base64 = await pdfToBase64(
    <ClienteFichaPdf
      cliente={cliente}
      recargas={recargaItems}
      premios={premios}
      direccion={direccion}
      info={info}
    />
  );

  const safeName = cliente.nombre.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  return { base64, filename: dateFilename(`ficha_${safeName}`, 'pdf') };
}

// ── Excel exports ──

export async function exportClientesExcel(): Promise<ExportResult> {
  const { clientes } = await getClientes(1, 200);

  // Type assertion needed because getClientes returns ClienteListRow[]
  const base64 = generateClientesExcel(clientes as ClienteListRow[]);

  return { base64, filename: dateFilename('clientes', 'xlsx') };
}

export async function exportRecargasExcel(): Promise<ExportResult> {
  const topClientes = await getTopClientes(20);

  const base64 = generateRecargasExcel(topClientes);

  return { base64, filename: dateFilename('recargas_top20', 'xlsx') };
}

export async function exportBotellonesExcel(): Promise<ExportResult> {
  const { botellones } = await getBotellones(1, 200);

  const base64 = generateBotellonesExcel(botellones as any[]);

  return { base64, filename: dateFilename('botellones', 'xlsx') };
}
