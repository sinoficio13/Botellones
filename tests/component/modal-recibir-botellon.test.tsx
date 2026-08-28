import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModalRecibirBotellon } from '@/components/operaciones/modal-recibir-botellon';

const getBotellonByCodigoMock = vi.hoisted(() => vi.fn());
const getClienteMock = vi.hoisted(() => vi.fn());
const registrarOperacionMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db/botellones', () => ({
  getBotellonByCodigo: getBotellonByCodigoMock,
}));
vi.mock('@/lib/db/clientes', () => ({
  getCliente: getClienteMock,
}));
vi.mock('@/lib/db/cargas', () => ({
  registrarOperacion: registrarOperacionMock,
}));

const MANUAL_LABEL = '¿Sin cámara? Ingresá el código manualmente';
// estado 'entregado' → valid source for the default `recibir` operation.
const BOT1 = { id: 'b1', codigo: 'BOT-00001', cliente_id: 'c1', estado: 'entregado' };

beforeEach(() => {
  getBotellonByCodigoMock.mockReset();
  getClienteMock.mockReset();
  registrarOperacionMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ModalRecibirBotellon', () => {
  it('renders the title, the 3-operation selector and the manual code input', () => {
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Recibir botellón' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recibir botellón' })).toBeInTheDocument();

    // Segmented operation selector, default Recibir.
    expect(screen.getByRole('button', { name: 'Recibir' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Recargar' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: 'Listo' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    // Manual entry input + submit button.
    expect(screen.getByLabelText(MANUAL_LABEL)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar a la sesión' })).toBeInTheDocument();
  });

  it('shows "Botellón no encontrado" for an unknown code and does not accumulate it', async () => {
    getBotellonByCodigoMock.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(MANUAL_LABEL), 'BOT-99999');
    await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-99999');
    expect(screen.getByText('Botellón no encontrado')).toBeInTheDocument();
    expect(screen.getByText('Aún no se agregaron botellones.')).toBeInTheDocument();
  });

  it('adds a valid code to the session (with client name) and enables confirm', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT1);
    getClienteMock.mockResolvedValue({ id: 'c1', nombre: 'Juan Pérez' });
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    const confirm = screen.getByRole('button', { name: 'Confirmar carga' });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(MANUAL_LABEL), 'BOT-00001');
    await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-00001');
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('BOT-00001')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(confirm).toBeEnabled();
  });

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});