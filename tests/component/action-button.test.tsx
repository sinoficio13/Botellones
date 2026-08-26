import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionButton } from '@/components/operaciones/action-button';

/**
 * ActionButton — REQ-COS-11. Class assertions are spec-mandated by the
 * REQ-COS-15 test contract ("marca class, disabled fill/text classes").
 */
describe('ActionButton — REQ-COS-11', () => {
  it('renders the primary action always in --marca with a 44px touch target (S1)', () => {
    render(<ActionButton>Pasar a Listo</ActionButton>);

    const button = screen.getByRole('button', { name: 'Pasar a Listo' });
    expect(button).toHaveClass('bg-marca');
    expect(button).toHaveClass('min-h-11');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('uses fill/text-disabled tokens, stays 44px, and ignores clicks when disabled (S2)', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ActionButton disabled onClick={onClick}>
        Pasar a Listo
      </ActionButton>
    );

    const button = screen.getByRole('button', { name: 'Pasar a Listo' });
    expect(button).toHaveClass('bg-fill-disabled', 'text-text-disabled');
    expect(button).toHaveClass('min-h-11');
    expect(button).toBeDisabled();

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('exposes the accessible label (S3)', () => {
    render(
      <ActionButton aria-label="Pasar 3 botellones a Listo">
        Pasar a Listo
      </ActionButton>
    );

    expect(
      screen.getByRole('button', { name: 'Pasar 3 botellones a Listo' })
    ).toBeInTheDocument();
  });
});