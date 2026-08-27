import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { GrupoCard } from '@/components/operaciones/grupo-card';
import type { GrupoCola, EstadoOperativo } from '@/hooks/useColaOperaciones';
import type { ColaBotellon } from '@/lib/db/botellones';

/** Fixture row: edad derivada de Date.now() (el card usa el reloj real, D8). */
function hace(horas: number): string {
  return new Date(Date.now() - horas * 3_600_000).toISOString();
}

function botellon(i: number, over: Partial<ColaBotellon> = {}): ColaBotellon {
  return {
    id: `b-${i}`,
    codigo: `BOT-00${i}`,
    estado: 'recibido',
    cliente_id: 'cliente-a',
    estado_desde: hace(3),
    clientes: { nombre: 'María González', cedula: '12345678', telefono_1: null, whatsapp: null },
    ...over,
  } as ColaBotellon;
}

function grupo(botellones: ColaBotellon[], estadoDesde?: string): GrupoCola {
  return { cliente_id: 'cliente-a', estado_desde: estadoDesde ?? botellones[0].estado_desde, botellones };
}

describe('GrupoCard — REQ-COS-18', () => {
  it('renders the client block with name, mono cédula and the 3 targets present', () => {
    render(<GrupoCard grupo={grupo([botellon(1)])} estado="recibido" onAccion={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'María González' })).toBeInTheDocument(); // name target (ficha, fase 5)
    const cedula = screen.getByText('12345678');
    expect(cedula).toHaveClass('font-mono');
    expect(screen.getByRole('button', { name: 'WhatsApp de María González' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BOT-001' })).toBeInTheDocument(); // chip
  });

  it('renders a dash in mono font when the cédula is NULL (REQ-18 S3)', () => {
    render(
      <GrupoCard
        grupo={grupo([botellon(1, { clientes: { nombre: 'María González', cedula: null, telefono_1: null, whatsapp: null } })])}
        estado="recibido"
        onAccion={vi.fn()}
      />
    );

    const guion = screen.getByText('—');
    expect(guion).toHaveClass('font-mono');
  });

  it('marks all chips by default and flips aria-pressed individually (REQ-18 S1)', () => {
    render(<GrupoCard grupo={grupo([botellon(1), botellon(2), botellon(3)])} estado="recibido" onAccion={vi.fn()} />);

    const chips = screen.getAllByRole('button', { name: /^BOT-00/ });
    expect(chips).toHaveLength(3);
    for (const chip of chips) expect(chip).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'BOT-001' }));
    expect(screen.getByRole('button', { name: 'BOT-001' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'BOT-002' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'BOT-003' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('reflects the marked count in the action copy and calls onAccion with marked ids', () => {
    const onAccion = vi.fn();
    render(<GrupoCard grupo={grupo([botellon(1), botellon(2), botellon(3)])} estado="recibido" onAccion={onAccion} />);

    expect(screen.getByRole('button', { name: '→ Pasar 3 a En recarga' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'BOT-001' }));
    expect(screen.getByRole('button', { name: '→ Pasar 2 a En recarga' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '→ Pasar 2 a En recarga' }));
    expect(onAccion).toHaveBeenCalledWith(['b-2', 'b-3']);
  });

  it('shows 6 chips plus a +N expansion control for a group >6 and expands on tap', () => {
    const botellones = Array.from({ length: 8 }, (_, i) => botellon(i + 1));
    render(<GrupoCard grupo={grupo(botellones)} estado="recibido" onAccion={vi.fn()} />);

    expect(screen.getAllByRole('button', { name: /^BOT-00/ })).toHaveLength(6);
    const expandir = screen.getByRole('button', { name: 'Mostrar 2 botellones más' });
    expect(expandir).toHaveTextContent('+2');

    fireEvent.click(expandir);
    expect(screen.getAllByRole('button', { name: /^BOT-00/ })).toHaveLength(8);
    expect(screen.queryByRole('button', { name: 'Mostrar 2 botellones más' })).not.toBeInTheDocument();
  });

  it('disables the action with "Elegí al menos un botellón" when zero chips are marked', () => {
    render(<GrupoCard grupo={grupo([botellon(1), botellon(2)])} estado="recibido" onAccion={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'BOT-001' }));
    fireEvent.click(screen.getByRole('button', { name: 'BOT-002' }));

    const accion = screen.getByRole('button', { name: 'Elegí al menos un botellón' });
    expect(accion).toBeDisabled();
  });

  it('disables the action while an action is in flight (enAccion)', () => {
    render(<GrupoCard grupo={grupo([botellon(1)])} estado="recibido" enAccion onAccion={vi.fn()} />);

    expect(screen.getByRole('button', { name: '→ Pasar 1 a En recarga' })).toBeDisabled();
  });

  it('manages its own in-flight state: disables while an async onAccion runs, re-enables after (R2-001)', async () => {
    let resolver!: () => void;
    const onAccion = vi.fn(
      () => new Promise<void>((r) => (resolver = r))
    );
    render(<GrupoCard grupo={grupo([botellon(1), botellon(2)])} estado="recibido" onAccion={onAccion} />);

    fireEvent.click(screen.getByRole('button', { name: '→ Pasar 2 a En recarga' }));
    expect(onAccion).toHaveBeenCalledWith(['b-1', 'b-2']);
    expect(screen.getByRole('button', { name: '→ Pasar 2 a En recarga' })).toBeDisabled();

    await act(async () => {
      resolver();
    });
    expect(screen.getByRole('button', { name: '→ Pasar 2 a En recarga' })).not.toBeDisabled();
  });

  it('drops moved ids from marcados when the group membership shrinks (carried R2-001)', () => {
    const onAccion = vi.fn();
    const { rerender } = render(
      <GrupoCard grupo={grupo([botellon(1), botellon(2), botellon(3)])} estado="recibido" onAccion={onAccion} />
    );
    expect(screen.getByRole('button', { name: '→ Pasar 3 a En recarga' })).toBeInTheDocument();

    // b-2 moved away: the group rerenders with two members (subset move). The
    // stale id must leave marcados so count/copy/ids stay in sync with the DOM.
    rerender(<GrupoCard grupo={grupo([botellon(1), botellon(3)])} estado="recibido" onAccion={onAccion} />);

    expect(screen.getByRole('button', { name: '→ Pasar 2 a En recarga' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '→ Pasar 2 a En recarga' }));
    expect(onAccion).toHaveBeenCalledWith(['b-1', 'b-3']);
  });

  it('marks the WhatsApp target aria-disabled + opacity-40 without a phone, but the tap still fires onWhatsApp (D7)', () => {
    const onWhatsApp = vi.fn();
    render(<GrupoCard grupo={grupo([botellon(1)])} estado="recibido" onAccion={vi.fn()} onWhatsApp={onWhatsApp} />);

    const whatsapp = screen.getByRole('button', { name: 'WhatsApp de María González' });
    // D7: aria-disabled (NOT the disabled attr) so the click always fires and
    // the shell handler decides (toast vs sheet) — a disabled button would
    // swallow the click and the toast could never fire.
    expect(whatsapp).toHaveAttribute('aria-disabled', 'true');
    expect(whatsapp).not.toBeDisabled();
    expect(whatsapp).toHaveClass('opacity-40');

    fireEvent.click(whatsapp);
    expect(onWhatsApp).toHaveBeenCalledTimes(1);
  });

  it('fires onWhatsApp on tap when the client has a phone (target wired, REQ-COS-18 S4)', () => {
    const onWhatsApp = vi.fn();
    render(
      <GrupoCard
        grupo={grupo([botellon(1, { clientes: { nombre: 'María González', cedula: '12345678', telefono_1: '1144445555', whatsapp: '1144445555' } })])}
        estado="recibido"
        onAccion={vi.fn()}
        onWhatsApp={onWhatsApp}
      />
    );

    const whatsapp = screen.getByRole('button', { name: 'WhatsApp de María González' });
    expect(whatsapp).not.toHaveAttribute('aria-disabled');
    expect(whatsapp).not.toHaveClass('opacity-40');

    fireEvent.click(whatsapp);
    expect(onWhatsApp).toHaveBeenCalledTimes(1);
  });

  it('shows amber urgency text for 6–24h and ▲ AlertTriangle + amber 7% bg for >24h (REQ-18 S2)', async () => {
    const diezHoras = grupo([botellon(1, { estado_desde: hace(10) })], hace(10));
    const { container: diez, unmount: unmountDiez } = render(<GrupoCard grupo={diezHoras} estado="recibido" onAccion={vi.fn()} />);
    // R1-001: the real age renders after mount (clock is client-only) — wait for it.
    await waitFor(() => expect(screen.getByText('10h')).toBeInTheDocument());

    const edadDiez = screen.getByText('10h');
    expect(edadDiez).toHaveClass('text-urgencia-texto');
    expect(diez.querySelector('[data-testid="grupo-card"]')).not.toHaveClass('bg-urgencia/7');
    unmountDiez();

    const treintaHoras = grupo([botellon(2, { estado_desde: hace(30) })], hace(30));
    const { container: treinta, unmount: unmountTreinta } = render(<GrupoCard grupo={treintaHoras} estado="recibido" onAccion={vi.fn()} />);

    // 30h → age shows "1d" (design matrix: ≥24h displays rounded days); urgency stays critica.
    await waitFor(() => expect(screen.getByText('1d')).toBeInTheDocument());
    expect(treinta.querySelector('[data-testid="grupo-card"]')).toHaveClass('bg-urgencia/7');
    expect(treinta.querySelector('svg.lucide-triangle-alert')).not.toBeNull();
    unmountTreinta();

    const cincoHoras = grupo([botellon(3, { estado_desde: hace(5) })], hace(5));
    const { container: normal } = render(<GrupoCard grupo={cincoHoras} estado="recibido" onAccion={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('5h')).toBeInTheDocument());
    expect(normal.querySelector('[data-testid="grupo-card"]')).not.toHaveClass('bg-urgencia/7');
  });

  it.each<[EstadoOperativo, string]>([
    ['recibido', '→ Pasar 1 a En recarga'],
    ['recarga', '→ Pasar 1 a Listo'],
    ['listo', '→ Pasar 1 a En delivery'],
    ['delivery', '✓ Entregar 1 a María'],
  ])('uses the per-estado action copy for %s', (estado, copia) => {
    render(<GrupoCard grupo={grupo([botellon(1)])} estado={estado} onAccion={vi.fn()} />);
    expect(screen.getByRole('button', { name: copia })).toBeInTheDocument();
  });

  it('renders a server-safe urgency in SSR output — age computed client-side after mount (carried R1-001)', async () => {
    const grupo30h = grupo([botellon(1, { estado_desde: hace(30) })], hace(30));

    // Server render (no effects run): the age/urgency must NOT leak the real
    // clock into the HTML, or hydration would mismatch (server T1 vs client T2
    // crossing the 6h/24h boundary). Server-safe = no critica urgency at all.
    const html = renderToString(<GrupoCard grupo={grupo30h} estado="recibido" onAccion={vi.fn()} />);
    expect(html).not.toContain('bg-urgencia/7');
    expect(html).not.toContain('triangle-alert');

    // After mount the real age renders (30h → critica: amber 7% bg + ▲ icon).
    const { container } = render(<GrupoCard grupo={grupo30h} estado="recibido" onAccion={vi.fn()} />);
    await waitFor(() =>
      expect(container.querySelector('[data-testid="grupo-card"]')).toHaveClass('bg-urgencia/7')
    );
    expect(container.querySelector('svg.lucide-triangle-alert')).not.toBeNull();
  });

it('marks a realtime-entering card with data-entrada and omits it otherwise (REQ-COS-27 D9)', () => {
    const { rerender } = render(
      <GrupoCard grupo={grupo([botellon(1)])} estado="recibido" entrando onAccion={vi.fn()} />
    );
    expect(screen.getByTestId('grupo-card')).toHaveAttribute('data-entrada', 'true');

    rerender(<GrupoCard grupo={grupo([botellon(1)])} estado="recibido" entrando={false} onAccion={vi.fn()} />);
    expect(screen.getByTestId('grupo-card')).not.toHaveAttribute('data-entrada');
  });

  it('fires onAbrirFicha on the name target tap (REQ-COS-29, MOD-18/23 wiring)', () => {
    const onAbrirFicha = vi.fn();
    render(<GrupoCard grupo={grupo([botellon(1)])} estado="recibido" onAccion={vi.fn()} onAbrirFicha={onAbrirFicha} />);

    // The name block is a real button target (≥44px); tapping it opens the ficha.
    const nombre = screen.getByRole('button', { name: 'María González' });
    expect(nombre).toHaveClass('min-h-11');

    fireEvent.click(nombre);
    expect(onAbrirFicha).toHaveBeenCalledTimes(1);
  });

  it('re-ticks the age clock every 30s so realtime re-renders show fresh ages (D10)', async () => {
    vi.useFakeTimers();
    try {
      // estado_desde 59m30s old at T0: displayed "59m" (floor of minutes).
      // Advancing 30s crosses 60m → "1h". ONLY the 30s interval (D10) re-sets
      // `ahora` and re-renders the fresh age; a mount-only clock would stay
      // frozen at "59m" — this assertion fails without the tick.
      const base = Date.now();
      const desde = new Date(base - (59.5 * 60_000)).toISOString();
      render(<GrupoCard grupo={grupo([botellon(1, { estado_desde: desde })], desde)} estado="recibido" onAccion={vi.fn()} />);

      // Mount clock (setTimeout 0) → real age renders.
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(screen.getByText('59m')).toBeInTheDocument();

      // Advance past the 30s tick: the interval re-sets `ahora` → "1h".
      act(() => {
        vi.advanceTimersByTime(30_000);
      });
      expect(screen.getByText('1h')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});