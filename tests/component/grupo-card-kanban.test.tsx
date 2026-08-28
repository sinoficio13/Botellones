import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { GrupoCardKanban } from '@/components/operaciones/grupo-card-kanban';
import type { GrupoCola, EstadoOperativo } from '@/hooks/useColaOperaciones';
import type { ColaBotellon } from '@/lib/db/botellones';

/** Fixture row: edad derivada del reloj real (el card usa el reloj del cliente, R1-001). */
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

describe('GrupoCardKanban — REQ-COS-23', () => {
  it('renders the client name with mono cédula and a dash when NULL', () => {
    render(<GrupoCardKanban grupo={grupo([botellon(1)])} estado="recibido" onAccion={vi.fn()} />);

    expect(screen.getByText('María González')).toBeInTheDocument();
    expect(screen.getByText('12345678')).toHaveClass('font-mono');

    const sinCedula = grupo([
      botellon(2, { clientes: { nombre: 'María González', cedula: null, telefono_1: null, whatsapp: null } }),
    ]);
    render(<GrupoCardKanban grupo={sinCedula} estado="recibido" onAccion={vi.fn()} />);
    expect(screen.getByText('—')).toHaveClass('font-mono');
  });

  it('renders 6 code chips (all pressed by default) with a +2 expansion for 8', () => {
    const botellones = Array.from({ length: 8 }, (_, i) => botellon(i + 1));
    render(<GrupoCardKanban grupo={grupo(botellones)} estado="recibido" onAccion={vi.fn()} />);

    const chips = screen.getAllByRole('button', { name: /^BOT-00/ });
    expect(chips).toHaveLength(6);
    for (const chip of chips) expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'BOT-007' })).not.toBeInTheDocument();
    // Expansion control (mirrors GrupoCard): +2 button, not a static suffix.
    expect(screen.getByRole('button', { name: 'Mostrar 2 botellones más' })).toHaveTextContent('+2');
  });

  it.each<[EstadoOperativo, string]>([
    ['recibido', '→ Pasar a En recarga'],
    ['recarga', '→ Pasar a Listo'],
    ['listo', '→ Pasar a En delivery'],
    ['delivery', '✓ Entregar a María'],
  ])('uses the per-estado whole-group action copy for %s', (estado, copia) => {
    render(<GrupoCardKanban grupo={grupo([botellon(1), botellon(2)])} estado={estado} onAccion={vi.fn()} />);
    expect(screen.getByRole('button', { name: copia })).toBeInTheDocument();
  });

  it('calls onAccion with ALL group ids on a ≥44px whole-group action (REQ-23)', () => {
    const onAccion = vi.fn();
    render(<GrupoCardKanban grupo={grupo([botellon(1), botellon(2), botellon(3)])} estado="recibido" onAccion={onAccion} />);

    const accion = screen.getByRole('button', { name: '→ Pasar a En recarga' });
    expect(accion).toHaveClass('min-h-11');
    fireEvent.click(accion);
    expect(onAccion).toHaveBeenCalledWith(['b-1', 'b-2', 'b-3']);
  });

  it('disables the whole-group action while an action is in flight (enAccion)', () => {
    render(<GrupoCardKanban grupo={grupo([botellon(1)])} estado="recibido" enAccion onAccion={vi.fn()} />);
    expect(screen.getByRole('button', { name: '→ Pasar a En recarga' })).toBeDisabled();
  });

  // ── per-bottle selection (mirrors GrupoCard: subset moves only the marked) ──

  it('deselecting one chip of a 2-bottle group flips the forward label to the counted subset and moves only the selection', () => {
    const onAccion = vi.fn();
    render(<GrupoCardKanban grupo={grupo([botellon(1), botellon(2)])} estado="recibido" onAccion={onAccion} />);

    // Default all-selected → whole-group copy.
    expect(screen.getByRole('button', { name: '→ Pasar a En recarga' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'BOT-002' }));
    expect(screen.getByRole('button', { name: '→ Pasar 1 a En recarga' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '→ Pasar 1 a En recarga' }));
    expect(onAccion).toHaveBeenCalledWith(['b-1']);
  });

  it('deselecting ALL chips disables the action and shows "Elegí al menos un botellón"', () => {
    const onAccion = vi.fn();
    render(<GrupoCardKanban grupo={grupo([botellon(1), botellon(2)])} estado="recibido" onAccion={onAccion} />);

    fireEvent.click(screen.getByRole('button', { name: 'BOT-001' }));
    fireEvent.click(screen.getByRole('button', { name: 'BOT-002' }));

    const accion = screen.getByRole('button', { name: 'Elegí al menos un botellón' });
    expect(accion).toBeDisabled();
    fireEvent.click(accion);
    expect(onAccion).not.toHaveBeenCalled();
  });

  it('listo card: deselecting one chip flips Entregar to the counted subset and onEntregar receives only the selection', () => {
    const onEntregar = vi.fn();
    render(<GrupoCardKanban grupo={grupo([botellon(1), botellon(2)])} estado="listo" onAccion={vi.fn()} onEntregar={onEntregar} />);

    // Default all-selected → whole-group Entregar copy.
    expect(screen.getByRole('button', { name: '✓ Entregar a María' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'BOT-002' }));
    expect(screen.getByRole('button', { name: '✓ Entregar 1 a María' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '✓ Entregar 1 a María' }));
    expect(onEntregar).toHaveBeenCalledWith(['b-1']);
  });

  it('shows amber urgency text for 6–24h and ▲ AlertTriangle + amber tint for >24h (REQ-23 S3)', async () => {
    const diezHoras = grupo([botellon(1, { estado_desde: hace(10) })], hace(10));
    const { container: diez, unmount: unmountDiez } = render(
      <GrupoCardKanban grupo={diezHoras} estado="recibido" onAccion={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText('10h')).toBeInTheDocument());
    expect(screen.getByText('10h')).toHaveClass('text-urgencia-texto');
    expect(diez.querySelector('[data-testid="grupo-card-kanban"]')).not.toHaveClass('bg-urgencia/7');
    unmountDiez();

    const treintaHoras = grupo([botellon(2, { estado_desde: hace(30) })], hace(30));
    const { container: treinta, unmount: unmountTreinta } = render(
      <GrupoCardKanban grupo={treintaHoras} estado="recibido" onAccion={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText('1d')).toBeInTheDocument());
    expect(treinta.querySelector('[data-testid="grupo-card-kanban"]')).toHaveClass('bg-urgencia/7');
    expect(treinta.querySelector('svg.lucide-triangle-alert')).not.toBeNull();
    unmountTreinta();
  });

  // ── 1.2b blocks (trim → PR-B 2.1 if PR-A would exceed 400 lines) ──

  it('renders a server-safe age in SSR output — client-only clock, no critica leak (carried R1-001)', () => {
    const grupo30h = grupo([botellon(1, { estado_desde: hace(30) })], hace(30));

    // Server render (no effects): the real clock must NOT leak into the HTML
    // or hydration would mismatch. Server-safe = '0m' / no critica markers.
    const html = renderToString(<GrupoCardKanban grupo={grupo30h} estado="recibido" onAccion={vi.fn()} />);
    expect(html).toContain('0m');
    expect(html).not.toContain('bg-urgencia/7');
    expect(html).not.toContain('triangle-alert');
  });

  it('expands the hidden chips when the +N button is tapped and removes it after (mirrors GrupoCard)', () => {
    const botellones = Array.from({ length: 8 }, (_, i) => botellon(i + 1));
    render(<GrupoCardKanban grupo={grupo(botellones)} estado="recibido" onAccion={vi.fn()} />);

    expect(screen.getAllByRole('button', { name: /^BOT-00/ })).toHaveLength(6);
    const expandir = screen.getByRole('button', { name: 'Mostrar 2 botellones más' });
    expect(expandir).toHaveTextContent('+2');

    fireEvent.click(expandir);
    expect(screen.getAllByRole('button', { name: /^BOT-00/ })).toHaveLength(8);
    expect(screen.queryByRole('button', { name: 'Mostrar 2 botellones más' })).not.toBeInTheDocument();
  });

  it('marks the WhatsApp target aria-disabled + opacity-40 without a phone, but the tap still fires onWhatsApp (D7, REQ-23 S4)', () => {
    const onWhatsApp = vi.fn();
    const { unmount: unmountSin } = render(
      <GrupoCardKanban grupo={grupo([botellon(1)])} estado="recibido" onAccion={vi.fn()} onWhatsApp={onWhatsApp} />
    );
    const sinTelefono = screen.getByRole('button', { name: 'WhatsApp de María González' });
    // D7: aria-disabled (NOT the disabled attr) so the click always fires and
    // the shell handler decides (toast vs sheet) — a disabled button would
    // swallow the click and the no-phone toast could never fire.
    expect(sinTelefono).toHaveAttribute('aria-disabled', 'true');
    expect(sinTelefono).not.toBeDisabled();
    expect(sinTelefono).toHaveClass('opacity-40');

    fireEvent.click(sinTelefono);
    expect(onWhatsApp).toHaveBeenCalledTimes(1);
    unmountSin();

    const conTelefono = grupo([
      botellon(2, { clientes: { nombre: 'María González', cedula: '12345678', telefono_1: '1144445555', whatsapp: '1144445555' } }),
    ]);
    render(<GrupoCardKanban grupo={conTelefono} estado="recibido" onAccion={vi.fn()} onWhatsApp={onWhatsApp} />);
    const conTel = screen.getByRole('button', { name: 'WhatsApp de María González' });
    expect(conTel).not.toHaveAttribute('aria-disabled');
    expect(conTel).not.toHaveClass('opacity-40');

    fireEvent.click(conTel);
    expect(onWhatsApp).toHaveBeenCalledTimes(2);
  });

  it('turns the name span into a button that fires onAbrirFicha (REQ-COS-29, MOD-18/23 wiring)', () => {
    const onAbrirFicha = vi.fn();
    render(<GrupoCardKanban grupo={grupo([botellon(1)])} estado="recibido" onAccion={vi.fn()} onAbrirFicha={onAbrirFicha} />);

    // The name block becomes a real button target (ficha, REQ-COS-29).
    const nombre = screen.getByRole('button', { name: 'María González' });
    expect(nombre).toHaveClass('min-h-11');

    fireEvent.click(nombre);
    expect(onAbrirFicha).toHaveBeenCalledTimes(1);
  });
});
