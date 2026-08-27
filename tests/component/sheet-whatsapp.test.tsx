import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SheetWhatsApp } from '@/components/operaciones/sheet-whatsapp';
import type { GrupoCola, EstadoOperativo } from '@/hooks/useColaOperaciones';
import type { ColaBotellon } from '@/lib/db/botellones';

/** Fixture row with a WhatsApp number (deep-link digits = 58 + raw digits). */
function hace(horas: number): string {
  return new Date(Date.now() - horas * 3_600_000).toISOString();
}

function botellon(i: number, over: Partial<ColaBotellon> = {}): ColaBotellon {
  return {
    id: `b-${i}`,
    codigo: `BOT-00${i}`,
    estado: 'listo',
    cliente_id: 'cliente-a',
    estado_desde: hace(3),
    clientes: {
      nombre: 'Gimnasio Ríos',
      cedula: '12345678',
      telefono_1: null,
      whatsapp: '1144445555',
    },
    ...over,
  } as ColaBotellon;
}

function grupo(botellones: ColaBotellon[], estadoDesde?: string): GrupoCola {
  return { cliente_id: 'cliente-a', estado_desde: estadoDesde ?? botellones[0].estado_desde, botellones };
}

describe('SheetWhatsApp — REQ-COS-28', () => {
  it('pre-loads the locked §7.3 literal for the current estado (spec scenario: listo/3/Gimnasio Ríos)', async () => {
    const onClose = vi.fn();
    render(
      <SheetWhatsApp
        grupo={grupo([botellon(1), botellon(2), botellon(3)])}
        estado="listo"
        onClose={onClose}
      />
    );

    const textarea = await screen.findByRole('textbox');
    expect(textarea).toHaveValue(
      'Hola Gimnasio, tus 3 botellones están listos. ¿Te lo llevo hoy?'
    );
  });

  it('pre-loads the recibido singular literal (triangulation: count-aware unit)', async () => {
    render(
      <SheetWhatsApp grupo={grupo([botellon(1)])} estado="recibido" onClose={vi.fn()} />
    );

    const textarea = await screen.findByRole('textbox');
    expect(textarea).toHaveValue(
      'Hola Gimnasio, recibimos tu botellón. Te aviso apenas esté listo.'
    );
  });

  it('shows the client name, mono phone and the editable note', async () => {
    render(<SheetWhatsApp grupo={grupo([botellon(1)])} estado="listo" onClose={vi.fn()} />);

    expect(await screen.findByText('Gimnasio Ríos')).toBeInTheDocument();
    const telefono = screen.getByText('1144445555');
    expect(telefono).toHaveClass('font-mono');
    expect(screen.getByText('Tocá para editar antes de enviar')).toBeInTheDocument();
  });

  it('lets the operator edit the pre-loaded message before sending', async () => {
    const user = userEvent.setup();
    render(<SheetWhatsApp grupo={grupo([botellon(1)])} estado="listo" onClose={vi.fn()} />);

    const textarea = await screen.findByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'Hola, cambié el mensaje');

    expect(textarea).toHaveValue('Hola, cambié el mensaje');
  });

  it('builds the wa.me deep link with normalized digits and the ENCODED edited message, target _blank', async () => {
    const user = userEvent.setup();
    render(<SheetWhatsApp grupo={grupo([botellon(1)])} estado="listo" onClose={vi.fn()} />);

    const textarea = await screen.findByRole('textbox');
    // Edit to a message with spaces and accents (REQ-COS-28 S2).
    await user.clear(textarea);
    await user.type(textarea, 'Hola Gimnasio, ¿todo listo para hoy?');

    const abrir = screen.getByRole('link', { name: 'Abrir WhatsApp' });
    expect(abrir).toHaveAttribute(
      'href',
      `https://wa.me/581144445555?text=${encodeURIComponent('Hola Gimnasio, ¿todo listo para hoy?')}`
    );
    expect(abrir).toHaveAttribute('target', '_blank');
    expect(abrir).toHaveAttribute('rel');
  });

  it('Cancelar closes the sheet without navigation (button, not a link)', async () => {
    const onClose = vi.fn();
    render(<SheetWhatsApp grupo={grupo([botellon(1)])} estado="listo" onClose={onClose} />);

    const cancelar = await screen.findByRole('button', { name: 'Cancelar' });
    expect(cancelar.tagName).toBe('BUTTON');
    expect(cancelar).not.toHaveAttribute('href');

    fireEvent.click(cancelar);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT auto-send or overwrite the message when the estado prop changes (REQ-COS-28 S5)', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <SheetWhatsApp grupo={grupo([botellon(1)])} estado="listo" onClose={onClose} />
    );

    const textarea = await screen.findByRole('textbox');
    expect(textarea).toHaveValue('Hola Gimnasio, tu botellón está listo. ¿Te lo llevo hoy?');

    // The active tab changes → the queue re-renders with a different estado.
    rerender(<SheetWhatsApp grupo={grupo([botellon(1)])} estado="recibido" onClose={onClose} />);

    // No send happened (onClose never fired) and the message keeps the listo copy.
    expect(onClose).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('Hola Gimnasio, tu botellón está listo. ¿Te lo llevo hoy?');
  });
});