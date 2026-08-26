import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

  it('disables the WhatsApp target with opacity-40 when the client has no phone (REQ-18 §7.3)', () => {
    render(<GrupoCard grupo={grupo([botellon(1)])} estado="recibido" onAccion={vi.fn()} />);

    const whatsapp = screen.getByRole('button', { name: 'WhatsApp de María González' });
    expect(whatsapp).toBeDisabled();
    expect(whatsapp).toHaveClass('opacity-40');
  });

  it('keeps the WhatsApp target enabled (inert tap) when the client has a phone', () => {
    render(
      <GrupoCard
        grupo={grupo([botellon(1, { clientes: { nombre: 'María González', cedula: '12345678', telefono_1: '1144445555', whatsapp: '1144445555' } })])}
        estado="recibido"
        onAccion={vi.fn()}
      />
    );

    const whatsapp = screen.getByRole('button', { name: 'WhatsApp de María González' });
    expect(whatsapp).not.toBeDisabled();
    expect(whatsapp).not.toHaveClass('opacity-40');
  });

  it('shows amber urgency text for 6–24h and ▲ AlertTriangle + amber 7% bg for >24h (REQ-18 S2)', () => {
    const diezHoras = grupo([botellon(1, { estado_desde: hace(10) })], hace(10));
    const { container: diez, unmount: unmountDiez } = render(<GrupoCard grupo={diezHoras} estado="recibido" onAccion={vi.fn()} />);

    const edadDiez = screen.getByText('10h');
    expect(edadDiez).toHaveClass('text-urgencia-texto');
    expect(diez.querySelector('[data-testid="grupo-card"]')).not.toHaveClass('bg-urgencia/7');
    unmountDiez();

    const treintaHoras = grupo([botellon(2, { estado_desde: hace(30) })], hace(30));
    const { container: treinta, unmount: unmountTreinta } = render(<GrupoCard grupo={treintaHoras} estado="recibido" onAccion={vi.fn()} />);

    // 30h → age shows "1d" (design matrix: ≥24h displays rounded days); urgency stays critica.
    expect(screen.getByText('1d')).toBeInTheDocument();
    expect(treinta.querySelector('[data-testid="grupo-card"]')).toHaveClass('bg-urgencia/7');
    expect(treinta.querySelector('svg.lucide-triangle-alert')).not.toBeNull();
    unmountTreinta();

    const cincoHoras = grupo([botellon(3, { estado_desde: hace(5) })], hace(5));
    const { container: normal } = render(<GrupoCard grupo={cincoHoras} estado="recibido" onAccion={vi.fn()} />);

    expect(screen.getByText('5h')).toBeInTheDocument();
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
});