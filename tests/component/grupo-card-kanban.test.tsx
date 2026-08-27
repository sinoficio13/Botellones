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

  it('renders 6 codes on one ·-line with a static +2 suffix for 8 and no chips', () => {
    const botellones = Array.from({ length: 8 }, (_, i) => botellon(i + 1));
    render(<GrupoCardKanban grupo={grupo(botellones)} estado="recibido" onAccion={vi.fn()} />);

    expect(
      screen.getByText('BOT-001 · BOT-002 · BOT-003 · BOT-004 · BOT-005 · BOT-006')
    ).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.queryByText('BOT-007')).not.toBeInTheDocument();
    // No chips on desktop (REQ-23: single ·-line of codes, no chip selection).
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /^BOT-/ })).not.toBeInTheDocument();
  });

  it.each<[EstadoOperativo, string]>([
    ['recibido', '→ Pasar 2 a En recarga'],
    ['recarga', '→ Pasar 2 a Listo'],
    ['listo', '→ Pasar 2 a En delivery'],
    ['delivery', '✓ Entregar 2 a María'],
  ])('uses the per-estado whole-group action copy for %s', (estado, copia) => {
    render(<GrupoCardKanban grupo={grupo([botellon(1), botellon(2)])} estado={estado} onAccion={vi.fn()} />);
    expect(screen.getByRole('button', { name: copia })).toBeInTheDocument();
  });

  it('calls onAccion with ALL group ids on a ≥44px whole-group action (REQ-23)', () => {
    const onAccion = vi.fn();
    render(<GrupoCardKanban grupo={grupo([botellon(1), botellon(2), botellon(3)])} estado="recibido" onAccion={onAccion} />);

    const accion = screen.getByRole('button', { name: '→ Pasar 3 a En recarga' });
    expect(accion).toHaveClass('min-h-11');
    fireEvent.click(accion);
    expect(onAccion).toHaveBeenCalledWith(['b-1', 'b-2', 'b-3']);
  });

  it('disables the whole-group action while an action is in flight (enAccion)', () => {
    render(<GrupoCardKanban grupo={grupo([botellon(1)])} estado="recibido" enAccion onAccion={vi.fn()} />);
    expect(screen.getByRole('button', { name: '→ Pasar 1 a En recarga' })).toBeDisabled();
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

  it('keeps the +N suffix OUTSIDE the truncating codes line so it stays visible in a narrow container (carried R4-001)', () => {
    const botellones = Array.from({ length: 8 }, (_, i) => botellon(i + 1));
    const { container } = render(
      <div style={{ width: 120 }}>
        <GrupoCardKanban grupo={grupo(botellones)} estado="recibido" onAccion={vi.fn()} />
      </div>
    );

    // The +N is a separate shrink-0 span, NOT inside the truncate <p> (whose
    // overflow clips) — so it is guaranteed visible even in a 120px container.
    const codigos = [...container.querySelectorAll('p')].find((p) => p.className.includes('truncate'));
    const plusN = [...container.querySelectorAll('span')].find((s) => s.textContent === '+2');

    expect(codigos).not.toBeNull();
    expect(codigos!.textContent).toContain('BOT-001');
    expect(plusN).not.toBeNull();
    // +N lives outside the truncate element (separate span, not its child).
    expect(codigos!.contains(plusN as Node)).toBe(false);
    expect(plusN!.className).toContain('shrink-0');
    expect(screen.getByText('+2')).toBeInTheDocument();
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
});
