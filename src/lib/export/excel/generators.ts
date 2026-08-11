'use server';

import * as XLSX from 'xlsx';
import type { ClienteListRow } from '@/lib/db/clientes';
import type { TopCliente } from '@/lib/db/analytics';

function toBase64(workbook: XLSX.WorkBook): string {
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
}

function autoFitColumns(ws: XLSX.WorkSheet, headers: string[]) {
  const colWidths = headers.map((h) => ({ wch: Math.max(h.length + 4, 12) }));
  ws['!cols'] = colWidths;
}

/**
 * Generates an XLSX workbook of clients with auto-filter and column widths.
 * Returns the workbook as a base64 string.
 */
export function generateClientesExcel(clientes: ClienteListRow[]): string {
  const rows = clientes.map((c) => ({
    Código: c.codigo,
    Nombre: c.nombre,
    Teléfono: c.telefono_1 ?? '',
    Tipo: c.tipo_cliente ?? '',
    'Total Recargas': c.total_recargas,
    'Última Recarga': c.ultima_recarga ?? '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  const headers = ['Código', 'Nombre', 'Teléfono', 'Tipo', 'Total Recargas', 'Última Recarga'];
  autoFitColumns(ws, headers);
  ws['!autofilter'] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(ws['!ref']!)) };

  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  return toBase64(wb);
}

/**
 * Generates an XLSX workbook of the top 20 clients by recargas.
 */
export function generateRecargasExcel(topClientes: TopCliente[]): string {
  const rows = topClientes.map((c, i) => ({
    Posición: i + 1,
    Cliente: c.nombre,
    'Total Recargas': c.total_recargas,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  const headers = ['Posición', 'Cliente', 'Total Recargas'];
  autoFitColumns(ws, headers);
  ws['!autofilter'] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(ws['!ref']!)) };

  XLSX.utils.book_append_sheet(wb, ws, 'Recargas');
  return toBase64(wb);
}

type BotellonExcelRow = {
  id: string;
  codigo: string;
  estado: string;
  cliente_id: string | null;
  fecha_creacion: string | null;
  clientes?: { nombre: string } | null;
};

/**
 * Generates an XLSX workbook of botellones.
 */
export function generateBotellonesExcel(botellones: BotellonExcelRow[]): string {
  const rows = botellones.map((b) => ({
    Código: b.codigo,
    Estado: b.estado,
    Cliente: b.clientes?.nombre ?? '—',
    'Fecha Creación': b.fecha_creacion?.slice(0, 10) ?? '—',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  const headers = ['Código', 'Estado', 'Cliente', 'Fecha Creación'];
  autoFitColumns(ws, headers);
  ws['!autofilter'] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(ws['!ref']!)) };

  XLSX.utils.book_append_sheet(wb, ws, 'Botellones');
  return toBase64(wb);
}
