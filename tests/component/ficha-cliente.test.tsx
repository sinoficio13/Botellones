import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FichaCliente } from '@/components/operaciones/ficha-cliente';
import type { BotellonesClienteResult } from '@/lib/db/botellones';

const { getBotellonesClienteMock, pushMock } = vi.hoisted(() => ({
  getBotellonesClienteMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('@/lib/db/botellones', () => ({ getBotellonesCliente: getBotellonesClienteMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

/** Fixture: client with bottles in recibido AND entregado (spec scenario). */
function hace(horas: number): string {
  return new Date(Date.now() - horas * 3_600_000).toISOString();
}

function datosFicha(): BotellonesClienteResult {
  return {
    cliente: {
      id: 'cliente-1',
      nombre: 'Gimnasio Ríos',
      cedula: '12345678',
      telefono_1: '1144445555',
      whatsapp: '1144445555',
    },
    direccion: { calle: 'Av. Siempre Viva', ciudad: 'Caracas', estado: 'Miranda', referencia: null },
    botellones: [
      { id: 'b-1', codigo: 'BOT-001', estado: 'recibido', estado_desde: hace(3) },
      { id: 'b-2', codigo: 'BOT-002', estado: 'entregado', estado_desde: hace(30) },
    ],
  };
}

function montar(over: Partial<Parameters<typeof FichaCliente>[0]> = {}) {
  getBotellonesClienteMock.mockResolvedValue(datosFicha());
  const onClose = vi.fn();
  const onWhatsApp = vi.fn();
  render(
    <FichaCliente
      clienteId="cliente-1"
      onClose={onClose}
      onWhatsApp={onWhatsApp}
      {...over}
    />
  );
  return { onClose, onWhatsApp };
}

describe('FichaCliente — REQ-COS-29', () => {
  it('shows nombre (SheetTitle), mono cédula, the joined dirección and the ficha data', async () => {
    montar();

    expect(await screen.findByText('Gimnasio Ríos')).toBeInTheDocument();
    const cedula = screen.getByText('12345678');
    expect(cedula).toHaveClass('font-mono');
    // Dirección = join of the direcciones(*) row fields (spec: "dirección (join)").
    expect(screen.getByText('Av. Siempre Viva, Caracas, Miranda')).toBeInTheDocument();
  });

  it('renders "Sus botellones (N)" with ALL estados incl. entregado, each with badge + age', async () => {
    montar();

    await screen.findByText('Gimnasio Ríos');
    expect(screen.getByText('Sus botellones (2)')).toBeInTheDocument();

    // Both bottles present — including the entregado one (spec scenario).
    const filaRecibido = screen.getByText('BOT-001').closest('li')!;
    const filaEntregado = screen.getByText('BOT-002').closest('li')!;
    expect(within(filaRecibido).getByText('Recibido')).toBeInTheDocument();
    expect(within(filaEntregado).getByText('Entregado')).toBeInTheDocument();
    // Per-estado badge color token present (ESTADO_COLORS), not a hex.
    expect(filaRecibido.querySelector('span[class*="bg-"]')).not.toBeNull();
    expect(filaEntregado.querySelector('span[class*="bg-"]')).not.toBeNull();
    // Age via formatAntiguedad (client clock after mount).
    await waitFor(() => expect(screen.getByText('1d')).toBeInTheDocument());
  });

  it('WhatsApp action fires onWhatsApp (shell swaps to the REQ-COS-28 sheet, D8)', async () => {
    const { onWhatsApp } = montar();
    await screen.findByText('Gimnasio Ríos');

    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(onWhatsApp).toHaveBeenCalledTimes(1);
  });

  it('Llamar is a tel: link with the client phone (anchor, not a button)', async () => {
    montar();
    await screen.findByText('Gimnasio Ríos');

    const llamar = screen.getByRole('link', { name: 'Llamar' });
    expect(llamar).toHaveAttribute('href', 'tel:1144445555');
    expect(llamar.tagName).toBe('A');
  });

  it('Ficha navigates to /clientes/[id] via router.push', async () => {
    montar();
    await screen.findByText('Gimnasio Ríos');

    fireEvent.click(screen.getByRole('button', { name: 'Ficha' }));
    expect(pushMock).toHaveBeenCalledWith('/clientes/cliente-1');
  });

  it('Cerrar closes the sheet', async () => {
    const { onClose } = montar();
    await screen.findByText('Gimnasio Ríos');

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape (base-ui Dialog onOpenChange → onClose) and shows a dash for NULL cédula', async () => {
    getBotellonesClienteMock.mockResolvedValue({
      cliente: { id: 'cliente-1', nombre: 'Gimnasio Ríos', cedula: null, telefono_1: null, whatsapp: null },
      direccion: null,
      botellones: [],
    });
    const onClose = vi.fn();
    render(<FichaCliente clienteId="cliente-1" onClose={onClose} onWhatsApp={vi.fn()} />);
    await screen.findByText('Gimnasio Ríos');

    // NULL cédula → mono dash (REQ-COS-18 "—" convention).
    const guion = screen.getByText('—');
    expect(guion).toHaveClass('font-mono');

    // Escape → the Sheet's onOpenChange(false) fires → shell closes.
    const user = userEvent.setup();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});