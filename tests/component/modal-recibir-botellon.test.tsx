import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
// Each bottle's CURRENT estado drives its pre-filled destination.
const BOT_ENTREGADO = { id: 'b1', codigo: 'BOT-00001', cliente_id: 'c1', estado: 'entregado' };
const BOT_RECARGA = { id: 'b3', codigo: 'BOT-00003', cliente_id: 'c3', estado: 'recarga' };
const BOT_LISTO = { id: 'b4', codigo: 'BOT-00004', cliente_id: 'c4', estado: 'listo' };
const CLIENTLESS_RECIBIDO = {
  id: 'b5',
  codigo: 'BOT-00005',
  cliente_id: null,
  estado: 'recibido',
};

beforeEach(() => {
  getBotellonByCodigoMock.mockReset();
  getClienteMock.mockReset();
  registrarOperacionMock.mockReset();
  getClienteMock.mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

/** Type digits (the input strips non-digits itself) and submit the manual entry. */
async function agregarManual(user: ReturnType<typeof userEvent.setup>, digits: string) {
  await user.type(screen.getByLabelText(MANUAL_LABEL), digits);
  await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));
}

describe('ModalRecibirBotellon — shell and entry', () => {
  it('renders the title, the manual digits entry and the disabled confirm', () => {
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Recibir botellón' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recibir botellón' })).toBeInTheDocument();
    expect(screen.getByLabelText(MANUAL_LABEL)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar a la sesión' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar \(0 botellones\)/ })).toBeDisabled();
    expect(screen.getByText('Aún no se agregaron botellones.')).toBeInTheDocument();
  });

  it('adds a valid code with its pre-filled destino and enables confirm', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    getClienteMock.mockResolvedValue({ id: 'c1', nombre: 'Juan Pérez' });
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    await agregarManual(user, '00001');

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-00001');
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('BOT-00001')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    // Pre-filled destination: entregado → recibir (static arrow text).
    expect(screen.getByText(/Entregado → Recibido/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar \(1 botellones\)/ })).toBeEnabled();
  });

  it('strips non-digits and tolerates pasted full codes like BOT-00045', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    // Simulate a paste of the full code: the input must normalize it to digits.
    fireEvent.change(screen.getByLabelText(MANUAL_LABEL), {
      target: { value: 'BOT-00045' },
    });
    expect((screen.getByLabelText(MANUAL_LABEL) as HTMLInputElement).value).toBe('00045');

    await user.click(screen.getByRole('button', { name: 'Agregar a la sesión' }));

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-00045');
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
  });

  it('shows "Botellón no encontrado" for an unknown code and does not accumulate it', async () => {
    getBotellonByCodigoMock.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    await agregarManual(user, '99999');

    expect(getBotellonByCodigoMock).toHaveBeenCalledWith('BOT-99999');
    expect(screen.getByText('Botellón no encontrado')).toBeInTheDocument();
    expect(screen.getByText('Aún no se agregaron botellones.')).toBeInTheDocument();
  });

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ModalRecibirBotellon — session rows', () => {
  it('shows a "Gestionar en el dashboard" hint for a bottle already in listo', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_LISTO);
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    await agregarManual(user, '00004');

    // Not actionable in this flow: no arrow, no chooser — just the hint.
    expect(screen.getByText('Gestionar en el dashboard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar \(0 botellones\)/ })).toBeDisabled();
  });

  it('recarga row chooser switches the destination between Listo and En delivery', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_RECARGA);
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    await agregarManual(user, '00003');

    const listo = screen.getByRole('button', { name: 'Listo' });
    const delivery = screen.getByRole('button', { name: 'En delivery' });
    // Default destination for a recarga bottle is listo.
    expect(listo).toHaveAttribute('aria-pressed', 'true');
    expect(delivery).toHaveAttribute('aria-pressed', 'false');

    await user.click(delivery);
    expect(listo).toHaveAttribute('aria-pressed', 'false');
    expect(delivery).toHaveAttribute('aria-pressed', 'true');
  });

  it('removes a row with the ✕ button', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    await agregarManual(user, '00001');
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Quitar BOT-00001' }));
    expect(screen.getByText('Aún no se agregaron botellones.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar \(0 botellones\)/ })).toBeDisabled();
  });

  it('flashes the existing row on a duplicate manual entry instead of double-adding', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    await agregarManual(user, '00001');
    await agregarManual(user, '00001');

    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getAllByText('BOT-00001')).toHaveLength(1);
    expect(screen.getByTestId('session-row-b1')).toHaveAttribute('data-flash', 'true');
  });

  it('warns on a clientless bottle with a recargar destino and links to assign a client', async () => {
    getBotellonByCodigoMock.mockResolvedValue(CLIENTLESS_RECIBIDO);
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    await agregarManual(user, '00005');

    // Pre-filled destino recargar → static arrow + amber inline warning.
    expect(screen.getByText(/Recibido → En recarga/)).toBeInTheDocument();
    expect(screen.getByText('Sin cliente asignado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Asignar cliente' })).toHaveAttribute(
      'href',
      '/botellones/b5'
    );
  });
});

describe('ModalRecibirBotellon — confirm and results', () => {
  it('posts one registrarOperacion per destino group with the right operation', async () => {
    getBotellonByCodigoMock.mockImplementation((codigo: string) =>
      Promise.resolve(codigo === 'BOT-00001' ? BOT_ENTREGADO : BOT_RECARGA)
    );
    registrarOperacionMock.mockResolvedValue({ success: true, items: [] });
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    await agregarManual(user, '00001'); // entregado → recibir
    await agregarManual(user, '00003'); // recarga → listo (default)

    await user.click(screen.getByRole('button', { name: /Confirmar \(2 botellones\)/ }));
    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();

    expect(registrarOperacionMock).toHaveBeenCalledTimes(2);
    expect(registrarOperacionMock).toHaveBeenCalledWith({
      botellonIds: ['b1'],
      operacion: 'recibir',
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      hora: expect.stringMatching(/^\d{2}:\d{2}$/),
    });
    expect(registrarOperacionMock).toHaveBeenCalledWith({
      botellonIds: ['b3'],
      operacion: 'listo',
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      hora: expect.stringMatching(/^\d{2}:\d{2}$/),
    });
  });

  it('sends a delivery group when the recarga row is switched to En delivery', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_RECARGA);
    registrarOperacionMock.mockResolvedValue({ success: true, items: [] });
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    await agregarManual(user, '00003');
    await user.click(screen.getByRole('button', { name: 'En delivery' }));

    await user.click(screen.getByRole('button', { name: /Confirmar \(1 botellones\)/ }));
    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();

    expect(registrarOperacionMock).toHaveBeenCalledTimes(1);
    expect(registrarOperacionMock).toHaveBeenCalledWith(
      expect.objectContaining({ botellonIds: ['b3'], operacion: 'delivery' })
    );
  });

  it('shows the rejection reason and Asignar cliente link for a sin-cliente result', async () => {
    getBotellonByCodigoMock.mockResolvedValue(CLIENTLESS_RECIBIDO);
    registrarOperacionMock.mockResolvedValue({
      success: true,
      items: [{ botellonId: 'b5', codigo: 'BOT-00005', ok: false, reason: 'sin-cliente' }],
    });
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    await agregarManual(user, '00005');
    await user.click(screen.getByRole('button', { name: /Confirmar \(1 botellones\)/ }));

    expect(await screen.findByText('Rechazado: sin-cliente')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Asignar cliente' })).toHaveAttribute(
      'href',
      '/botellones/b5'
    );
  });

  it('shows the server error and keeps the session editable via Seguir editando', async () => {
    getBotellonByCodigoMock.mockResolvedValue(BOT_RECARGA);
    registrarOperacionMock.mockResolvedValue({
      success: false,
      items: [{ botellonId: 'b3', codigo: 'BOT-00003', ok: false, reason: 'error' }],
      error: 'update exploded',
    });
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={vi.fn()} />);

    await agregarManual(user, '00003');
    await user.click(screen.getByRole('button', { name: /Confirmar \(1 botellones\)/ }));

    expect(await screen.findByText('update exploded')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(screen.getByText(/Sesión \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('BOT-00003')).toBeInTheDocument();
  });

  it('closes the modal from the success Listo button', async () => {
    const onClose = vi.fn();
    getBotellonByCodigoMock.mockResolvedValue(BOT_ENTREGADO);
    registrarOperacionMock.mockResolvedValue({
      success: true,
      items: [{ botellonId: 'b1', codigo: 'BOT-00001', ok: true }],
    });
    const user = userEvent.setup();
    render(<ModalRecibirBotellon onClose={onClose} />);

    await agregarManual(user, '00001');
    await user.click(screen.getByRole('button', { name: /Confirmar \(1 botellones\)/ }));

    expect(await screen.findByText('Carga registrada')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Listo' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});