import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InputWhatsapp } from '@/components/clientes/input-whatsapp';

function paisHidden(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[name="pais_whatsapp"]') as HTMLInputElement;
}

describe('InputWhatsapp — combobox de país con bandera', () => {
  it('muestra la bandera y país por defecto (Venezuela +58)', () => {
    const { container } = render(<InputWhatsapp />);

    const trigger = screen.getByRole('button', { name: /Venezuela \+58/ });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger.querySelector('svg')).toBeInTheDocument();
    expect(paisHidden(container).value).toBe('58');
  });

  it('abre la lista al hacer click y muestra cada país con su código', async () => {
    const user = userEvent.setup();
    render(<InputWhatsapp />);

    await user.click(screen.getByRole('button', { name: /Venezuela \+58/ }));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Venezuela (+58)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Colombia (+57)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'España (+34)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Estados Unidos (+1)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'México (+52)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Argentina (+54)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Otro' })).toBeInTheDocument();
  });

  it('seleccionar Colombia actualiza el hidden pais_whatsapp y cierra la lista', async () => {
    const user = userEvent.setup();
    const { container } = render(<InputWhatsapp />);

    await user.click(screen.getByRole('button', { name: /Venezuela \+58/ }));
    await user.click(screen.getByRole('option', { name: 'Colombia (+57)' }));

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(paisHidden(container).value).toBe('57');
    expect(screen.getByRole('button', { name: /Colombia \+57/ })).toBeInTheDocument();
  });

  it('"Otro" revela el input de código y el tipeo actualiza el hidden', async () => {
    const user = userEvent.setup();
    const { container } = render(<InputWhatsapp />);

    await user.click(screen.getByRole('button', { name: /Venezuela \+58/ }));
    await user.click(screen.getByRole('option', { name: 'Otro' }));

    const codigoInput = screen.getByPlaceholderText('Código del país, ej: 44');
    expect(codigoInput).toBeInTheDocument();

    await user.type(codigoInput, '44');
    expect(paisHidden(container).value).toBe('44');
    expect(screen.getByRole('button', { name: /Otro \+44/ })).toBeInTheDocument();
  });

  it('cierra con Escape', async () => {
    const user = userEvent.setup();
    render(<InputWhatsapp />);

    await user.click(screen.getByRole('button', { name: /Venezuela \+58/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('cierra con un click fuera del componente', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <InputWhatsapp />
        <button>Afuera</button>
      </div>
    );

    await user.click(screen.getByRole('button', { name: /Venezuela \+58/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Afuera' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('InputWhatsapp — precarga (prefill) para edición', () => {
  it('muestra Colombia y el número precargado con paisInicial/numeroInicial', () => {
    const { container } = render(<InputWhatsapp paisInicial="57" numeroInicial="3001234567" />);

    expect(screen.getByRole('button', { name: /Colombia \+57/ })).toBeInTheDocument();
    expect(paisHidden(container).value).toBe('57');
    expect(screen.getByLabelText('WhatsApp')).toHaveValue('3001234567');
  });

  it('"Otro" precargado muestra el código de país custom (codigoOtroInicial)', () => {
    const { container } = render(
      <InputWhatsapp paisInicial="otro" numeroInicial="7123456789" codigoOtroInicial="44" />
    );

    expect(screen.getByRole('button', { name: /Otro \+44/ })).toBeInTheDocument();
    expect(paisHidden(container).value).toBe('44');
    expect(screen.getByLabelText('WhatsApp')).toHaveValue('7123456789');
    expect(screen.getByPlaceholderText('Código del país, ej: 44')).toBeInTheDocument();
  });

  it('cae a Venezuela +58 cuando el paisInicial no es válido', () => {
    const { container } = render(<InputWhatsapp paisInicial="99" />);

    expect(screen.getByRole('button', { name: /Venezuela \+58/ })).toBeInTheDocument();
    expect(paisHidden(container).value).toBe('58');
  });
});