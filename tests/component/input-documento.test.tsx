import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InputDocumento } from '@/components/clientes/input-documento';

function tipoDocumentoHidden(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[name="tipo_documento"]') as HTMLInputElement;
}

describe('InputDocumento — combobox de tipo de documento + dígitos', () => {
  it('muestra el tipo V por defecto y el input de dígitos', () => {
    const { container } = render(<InputDocumento />);

    const trigger = screen.getByRole('button', { name: 'V' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger.querySelector('svg')).toBeInTheDocument();

    expect(tipoDocumentoHidden(container).value).toBe('V');

    const digits = screen.getByLabelText('Cédula');
    expect(digits).toHaveAttribute('inputMode', 'numeric');
    expect(digits).toHaveAttribute('pattern', '[0-9]{6,12}');
    expect(screen.getByText('Cédula: entre 6 y 8 dígitos')).toBeInTheDocument();
  });

  it('abre la lista al hacer click y muestra cada tipo', async () => {
    const user = userEvent.setup();
    render(<InputDocumento />);

    await user.click(screen.getByRole('button', { name: 'V' }));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'V · Venezolano' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'E · Extranjero' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'J · Jurídico' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'G · Gobierno' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'P · Pasaporte' })).toBeInTheDocument();
  });

  it('seleccionar J actualiza el hidden tipo_documento y el texto de ayuda', async () => {
    const user = userEvent.setup();
    const { container } = render(<InputDocumento />);

    await user.click(screen.getByRole('button', { name: 'V' }));
    await user.click(screen.getByRole('option', { name: 'J · Jurídico' }));

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(tipoDocumentoHidden(container).value).toBe('J');
    expect(screen.getByRole('button', { name: 'J' })).toBeInTheDocument();
    expect(screen.getByText('RIF: entre 8 y 10 dígitos')).toBeInTheDocument();
  });

  it('el input de dígitos acepta valores numéricos', async () => {
    const user = userEvent.setup();
    render(<InputDocumento />);

    const digits = screen.getByLabelText('Cédula');
    await user.type(digits, '123456789');
    expect(digits).toHaveValue('123456789');
  });

  it('cierra con Escape', async () => {
    const user = userEvent.setup();
    render(<InputDocumento />);

    await user.click(screen.getByRole('button', { name: 'V' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});