'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { registrarOperacion, type CargaState } from '@/lib/db/cargas';
import { getCliente } from '@/lib/db/clientes';
import { OPERACIONES, type Estado, type OperacionId } from '@/lib/utils/estados';

/** A botellon accumulated in the transient batch session (terminal + modal). */
export type ItemSesion = {
  id: string;
  codigo: string;
  /** Current estado read from the DB at scan/entry time. */
  estado: string;
  cliente: string | null;
  clienteNombre?: string;
  /** Per-row destination; null = not actionable in this flow (manage in dashboard). */
  destino: OperacionId | null;
};

/** Format a Date as YYYY-MM-DD in local time (for the record's fecha). */
function formatFecha(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format a Date as HH:MM in local time (for the record's hora). */
function formatHora(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

/**
 * Prefilled destination for a bottle given its CURRENT estado (the operator
 * never picks a global operation anymore):
 *   entregado → recibir, recibido → recargar, recarga → listo
 *   ('listo' is the default of the recarga-row chooser; 'delivery' is an option)
 *   listo / delivery / unknown → null (no destination in this flow).
 */
function prefillDestino(estado: string | null): OperacionId | null {
  switch (estado) {
    case 'entregado':
      return 'recibir';
    case 'recibido':
      return 'recargar';
    case 'recarga':
      return 'listo';
    default:
      return null;
  }
}

/**
 * Valid destination choices for a bottle's current estado, derived from the
 * OPERACIONES sources (e.g. 'recarga' → ['listo','delivery'], 'entregado' →
 * ['recibir'], 'recibido' → ['recargar'], others → []). Key order follows the
 * OPERACIONES declaration, so the recarga default ('listo') comes first.
 */
export function destinosPosibles(estado: string): OperacionId[] {
  const ops = Object.keys(OPERACIONES) as OperacionId[];
  return ops.filter((op) => OPERACIONES[op].sources.includes(estado as Estado));
}

/**
 * useSesionCarga — single source of truth for the batch session, consumed by
 * BOTH the /recargas/carga terminal and the "Recibir botellón" modal.
 *
 * - `agregar` dedupes via a ref Set (a repeated code flashes the existing row
 *   instead of double-adding), resolves the client display name via getCliente
 *   when a cliente_id is present, and pre-fills `destino` from the bottle's
 *   current estado.
 * - `confirmar` groups the session rows by their OWN `destino` (rows with
 *   destino null are skipped) and calls `registrarOperacion` ONCE PER GROUP
 *   with a fresh fecha/hora computed at submit time, returning the aggregated
 *   CargaState[] so callers can render per-row outcomes.
 * - `limpiar` resets the session for the next batch ("Listo" in the result view).
 */
export function useSesionCarga() {
  const [items, setItems] = useState<ItemSesion[]>([]);
  // Id of the session row currently showing the transient duplicate flash.
  const [flashId, setFlashId] = useState<string | null>(null);
  // Authoritative in-session dedupe set, updated synchronously in agregar so a
  // repeated code can never double-count even across stale closures.
  const scannedIdsRef = useRef<Set<string>>(new Set());
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashDuplicado = useCallback((id: string) => {
    setFlashId(id);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => setFlashId(null), 700);
  }, []);

  const agregar = useCallback(
    async (botellon: {
      id: string;
      codigo: string;
      cliente_id: string | null;
      estado: string | null;
    }): Promise<boolean> => {
      if (scannedIdsRef.current.has(botellon.id)) {
        flashDuplicado(botellon.id);
        return false;
      }
      scannedIdsRef.current.add(botellon.id);

      // `getBotellonByCodigo` is public-safe and carries no client PII, so the
      // batch UIs resolve the owner name themselves for display.
      const cliente = botellon.cliente_id ? await getCliente(botellon.cliente_id) : null;

      setItems((prev) => [
        ...prev,
        {
          id: botellon.id,
          codigo: botellon.codigo,
          estado: botellon.estado ?? '',
          cliente: botellon.cliente_id,
          clienteNombre: cliente?.nombre ?? undefined,
          destino: prefillDestino(botellon.estado),
        },
      ]);
      return true;
    },
    [flashDuplicado]
  );

  const setDestino = useCallback((id: string, destino: OperacionId | null) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, destino } : it)));
  }, []);

  const quitar = useCallback((id: string) => {
    // A removed bottle leaves the session: allow re-adding it later.
    scannedIdsRef.current.delete(id);
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const limpiar = useCallback(() => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    scannedIdsRef.current.clear();
    setFlashId(null);
    setItems([]);
  }, []);

  const confirmar = useCallback(async (): Promise<CargaState[]> => {
    // Group the session by each row's OWN destination; rows without a
    // destination (listo/delivery stock, "Gestionar en el dashboard") are
    // skipped and never sent.
    const grupos = new Map<OperacionId, ItemSesion[]>();
    for (const it of items) {
      if (it.destino === null) continue;
      const filas = grupos.get(it.destino) ?? [];
      filas.push(it);
      grupos.set(it.destino, filas);
    }
    const ahora = new Date();
    const fecha = formatFecha(ahora);
    const hora = formatHora(ahora);
    const results: CargaState[] = [];
    for (const [operacion, filas] of grupos) {
      results.push(
        await registrarOperacion({
          botellonIds: filas.map((f) => f.id),
          operacion,
          fecha,
          hora,
        })
      );
    }
    return results;
  }, [items]);

  // Clear the pending flash timeout on unmount.
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  return { items, flashId, agregar, setDestino, quitar, limpiar, confirmar };
}