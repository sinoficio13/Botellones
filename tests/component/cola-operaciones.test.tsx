import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ColaOperaciones } from '@/components/operaciones/cola-operaciones';
import type { ColaBotellon } from '@/lib/db/botellones';

const { getColaOperacionesMock, rpcMock, pushMock } = vi.hoisted(() => ({
  getColaOperacionesMock: vi.fn(),
  rpcMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('@/lib/db/botellones', () => ({ getColaOperaciones: getColaOperacionesMock }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc: rpcMock }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));
// The real ScannerModal owns the camera lifecycle (useQrScanner) which cannot
// run in jsdom — the shell test only proves the shell OPENS/CLOSES it.
vi.mock('@/components/scanner/scanner-modal', () => ({
  ScannerModal: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Escanear código QR">
      <button type="button" onClick={onClose}>
        Cerrar
      </button>
    </div>
  ),
}));

/** Fixture row: edad derivada del reloj real (igual que los tests de grupo-card). */
function hace(horas: number): string {
  return new Date(Date.now() - horas * 3_600_000).toISOString();
}

function botellon(i: number, over: Partial<ColaBotellon> = {}): ColaBotellon {
  return {
    id: `b-${i}`,
    codigo: `BOT-00${i}`,
    estado: 'recibido',
    cliente_id: `cliente-${i % 2 === 0 ? 'a' : 'b'}`,
    estado_desde: hace(3),
    clientes: { nombre: 'María González', cedula: '12345678', telefono_1: null, whatsapp: null },
    ...over,
  } as ColaBotellon;
}

/** Rows for the usual fixture: 2 groups in recibido (a,b) + 1 group in recarga. */
function filasTipicas(): ColaBotellon[] {
  return [
    botellon(1, { estado: 'recibido' }),
    botellon(2, { estado: 'recibido' }),
    botellon(3, { estado: 'recarga' }),
  ];
}

async function montar(filas: ColaBotellon[]) {
  getColaOperacionesMock.mockResolvedValue(filas);
  render(<ColaOperaciones />);
  // Load settled: skeleton replaced by real content (cards or empties).
  await waitFor(() => {
    expect(getColaOperacionesMock).toHaveBeenCalledTimes(1);
  });
  await waitFor(() => {
    expect(screen.queryAllByTestId('grupo-card').length).toBeGreaterThan(0);
  });
  return screen.getByTestId('cola-movil');
}

describe('ColaOperaciones — REQ-COS-21 (Slice E shell)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the skeleton shimmer while loading and never a spinner (REQ-21 S3)', async () => {
    let resolver!: (filas: ColaBotellon[]) => void;
    getColaOperacionesMock.mockReturnValue(new Promise<ColaBotellon[]>((r) => (resolver = r)));
    const { container } = render(<ColaOperaciones />);

    // Skeleton placeholders are present (mobile + tablet lists) while loading…
    expect(container.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(0);
    // …and there is no spinner (REQ-COS-13: skeleton shimmer, never a spinner).
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('grupo-card')).toHaveLength(0);

    resolver(filasTipicas());
    await waitFor(() => expect(screen.queryAllByTestId('grupo-card').length).toBeGreaterThan(0));
  });

  it('shows the per-tab empty copy for a tab with no groups and switches tabs (REQ-21)', async () => {
    // Only recarga has a group → the default recibido tab shows its own empty.
    await montar([botellon(3, { estado: 'recarga' })]);
    const movil = screen.getByTestId('cola-movil');

    expect(within(movil).getByRole('heading', { name: 'Nada esperando lavado' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'En recarga 1' }));
    await waitFor(() =>
      expect(within(movil).getByRole('button', { name: '→ Pasar 1 a Listo' })).toBeInTheDocument()
    );
  });

  it('shows the first-use empty state with Escanear + Cargar manual on a fully empty queue (REQ-21 S2)', async () => {
    getColaOperacionesMock.mockResolvedValue([]);
    render(<ColaOperaciones />);

    await waitFor(() => expect(screen.getByText('La cola está vacía')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '📷 Escanear' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cargar manual' })).toBeInTheDocument();
    // No tabs in the first-use state.
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('opens the ScannerModal from the first-use empty state and closes it (REQ-21 S2)', async () => {
    getColaOperacionesMock.mockResolvedValue([]);
    render(<ColaOperaciones />);
    await waitFor(() => expect(screen.getByRole('button', { name: '📷 Escanear' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '📷 Escanear' }));
    expect(screen.getByRole('dialog', { name: 'Escanear código QR' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('navigates to /recargas/carga from [Cargar manual] (REQ-21 S2)', async () => {
    getColaOperacionesMock.mockResolvedValue([]);
    render(<ColaOperaciones />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cargar manual' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Cargar manual' }));
    expect(pushMock).toHaveBeenCalledWith('/recargas/carga');
  });

  it('renders the tablet 2-col sections grid WITHOUT tabs (REQ-21 S1, D9)', async () => {
    await montar(filasTipicas());

    // 4 sections per estado, each with a sticky header.
    for (const nombre of ['Recibido', 'En recarga', 'Listo', 'En delivery']) {
      const seccion = screen.getByRole('region', { name: nombre });
      const header = seccion.querySelector('h2');
      expect(header).not.toBeNull();
      expect(header!.className).toContain('sticky');
      expect(header!.className).toContain('top-0');
    }

    // The grid container carries the CSS-only breakpoint (design D9): hidden on
    // mobile, 2 columns from md (768px) — jsdom cannot apply media queries, so
    // the classes are the observable of the CSS-only tablet layout.
    const grid = screen.getByRole('region', { name: 'Recibido' }).parentElement!;
    expect(grid.className).toContain('hidden');
    expect(grid.className).toContain('md:grid-cols-2');

    // Tabs exist but are mobile-only (md:hidden wrapper) and never inside the grid.
    const tablist = screen.getByRole('tablist');
    expect(tablist.parentElement!.className).toContain('md:hidden');
    expect(within(grid).queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('wires the card action to mover (DESTINO_ACCION) and mounts the ToastHost (REQ-19)', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await montar([botellon(1, { estado: 'recibido' })]);

    const movil = screen.getByTestId('cola-movil');
    fireEvent.click(within(movil).getByRole('button', { name: '→ Pasar 1 a En recarga' }));

    // The shell mounted ToastHost (toast store is module-level; without the host
    // nothing renders) and wired onAccion → mover with the forward machine.
    expect(screen.getByText('1 botellón a En recarga')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith('mover_botellones', {
      p_ids: ['b-1'],
      p_estado: 'recarga',
    });
  });

  it('shows a fetch-error empty state (distinct from empty) and recovers via Reintentar (R4-004)', async () => {
    getColaOperacionesMock.mockRejectedValueOnce(new Error('network down'));
    getColaOperacionesMock.mockResolvedValueOnce(filasTipicas());
    render(<ColaOperaciones />);

    await waitFor(() => expect(screen.getByText('No se pudo cargar la cola')).toBeInTheDocument());
    // Distinct from the first-use empty: retry action, no scanner/carga buttons.
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '📷 Escanear' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.queryAllByTestId('grupo-card').length).toBeGreaterThan(0));
    expect(getColaOperacionesMock).toHaveBeenCalledTimes(2);
  });
});