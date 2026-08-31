import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileNav } from '@/components/navigation/mobile-nav';
import { ScannerModal } from '@/components/scanner/scanner-modal';

// Mock the pathname so tests can drive the active state.
const mockPathname = { current: '/dashboard' };

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname.current,
}));

// Stub the lazily-imported modal so the nav test never pulls camera code.
// Mirrors the real module shape: a named `ScannerModal` export.
vi.mock('@/components/scanner/scanner-modal', () => ({
  ScannerModal: vi.fn(() => <div data-testid="scanner-modal" />),
}));

const scannerModalMock = vi.mocked(ScannerModal);

describe('MobileNav', () => {
  beforeEach(() => {
    mockPathname.current = '/dashboard';
    scannerModalMock.mockClear();
  });

  it('renders the 5 bottom-bar slots with the lg:hidden bar class', () => {
    render(<MobileNav />);

    const bar = screen.getByRole('navigation', { name: 'Navegación móvil' });
    expect(bar).toHaveClass('lg:hidden');

    // 3 primary tabs
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Botellones' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clientes' })).toBeInTheDocument();

    // Center FAB + Más trigger
    expect(
      screen.getByRole('button', { name: 'Escanear QR' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Más' })).toBeInTheDocument();
  });

  it('marks Dashboard active on /dashboard', () => {
    render(<MobileNav />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Botellones' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('marks Botellones active on /botellones', () => {
    mockPathname.current = '/botellones';
    render(<MobileNav />);
    expect(screen.getByRole('link', { name: 'Botellones' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('uses >= 44px touch targets', () => {
    render(<MobileNav />);

    for (const tab of screen.getAllByRole('link')) {
      expect(tab).toHaveClass('min-h-[44px]');
    }

    expect(screen.getByRole('button', { name: 'Escanear QR' })).toHaveClass(
      'h-14',
      'w-14'
    );
    expect(screen.getByRole('button', { name: 'Más' })).toHaveClass(
      'min-h-[44px]'
    );
  });

  it('opens the Más drawer listing all three secondary links', async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Más' }));

    for (const label of [
      'Mapa',
      'Reportes',
      'Configuración',
    ]) {
      expect(await screen.findByRole('link', { name: label })).toBeVisible();
    }
  });

  it('closes the Más drawer when a link is clicked', async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Más' }));
    const link = await screen.findByRole('link', { name: 'Mapa' });
    await user.click(link);

    // Drawer closed via state (link unmounted synchronously, no exit
    // animation in jsdom) while the bottom bar itself stays mounted.
    expect(
      screen.queryByRole('link', { name: 'Mapa' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Navegación móvil' })
    ).toBeInTheDocument();
  });

  it('shows a Cerrar sesión action inside the Más drawer', async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    expect(
      screen.queryByRole('button', { name: 'Cerrar sesión' })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Más' }));

    const logoutButton = await screen.findByRole('button', {
      name: 'Cerrar sesión',
    });
    expect(logoutButton).toBeVisible();
    expect(logoutButton).toHaveClass('min-h-[44px]');
  });

  it('opens the scanner modal from the FAB in one tap', async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    expect(screen.queryByTestId('scanner-modal')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Escanear QR' }));

    expect(await screen.findByTestId('scanner-modal')).toBeInTheDocument();
    expect(scannerModalMock).toHaveBeenCalledTimes(1);
  });
});