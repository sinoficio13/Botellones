import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScannerIsland } from '@/components/scanner/scanner-island';

// Stub the lazily-imported modal so the island test never pulls camera code.
vi.mock('@/components/scanner/scanner-modal', () => ({
  default: () => <div data-testid="scanner-modal" />,
}));

describe('ScannerIsland', () => {
  it('renders the "Escanear QR" button', () => {
    render(<ScannerIsland />);
    expect(
      screen.getByRole('button', { name: 'Escanear QR' })
    ).toBeInTheDocument();
  });

  it('does not mount the modal until the button is clicked (lazy)', () => {
    render(<ScannerIsland />);
    expect(screen.queryByTestId('scanner-modal')).not.toBeInTheDocument();
  });

  it('opens the modal on click', async () => {
    const user = userEvent.setup();
    render(<ScannerIsland />);

    await user.click(screen.getByRole('button', { name: 'Escanear QR' }));

    expect(await screen.findByTestId('scanner-modal')).toBeInTheDocument();
  });
});