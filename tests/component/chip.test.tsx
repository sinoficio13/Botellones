import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chip } from '@/components/operaciones/chip';

/**
 * Stateful harness: Chip is controlled (pressed + onToggle), so this wrapper
 * lets tests drive a real DOM aria-pressed flip through the parent's state,
 * exactly as a fase-3 caller would wire it.
 */
function StatefulChip({
  label = 'A-001',
  initialPressed = false,
}: {
  label?: string;
  initialPressed?: boolean;
}) {
  const [pressed, setPressed] = useState(initialPressed);
  return <Chip label={label} pressed={pressed} onToggle={setPressed} />;
}

describe('Chip — toggle primitive (REQ-COS-10)', () => {
  it('renders a mono button with a >=44px touch target (S2)', () => {
    render(<Chip label="A-001" pressed={false} onToggle={vi.fn()} />);

    const chip = screen.getByRole('button', { name: 'A-001' });
    expect(chip).toHaveClass('font-mono', 'min-h-11');
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('flips aria-pressed to true on click via the caller state (S1)', async () => {
    const user = userEvent.setup();
    render(<StatefulChip initialPressed={false} />);
    const chip = screen.getByRole('button', { name: 'A-001' });

    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await user.click(chip);

    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('invokes the caller toggle callback with the next state (S1)', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<Chip label="A-001" pressed={false} onToggle={onToggle} />);

    await user.click(screen.getByRole('button', { name: 'A-001' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('renders selected tokens when pressed and unselected tokens otherwise', () => {
    const { rerender } = render(
      <Chip label="A-001" pressed onToggle={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: 'A-001' })).toHaveClass(
      'border-marca',
      'bg-marca',
      'text-white'
    );

    rerender(<Chip label="A-001" pressed={false} onToggle={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'A-001' })).toHaveClass(
      'border-border-strong',
      'bg-surface-2',
      'text-text-secondary'
    );
  });

  it('toggles chips individually — clicking the first twice only affects it (S2)', async () => {
    const user = userEvent.setup();
    render(
      <>
        <StatefulChip label="A-001" />
        <StatefulChip label="B-002" />
      </>
    );

    const chipA = screen.getByRole('button', { name: 'A-001' });
    const chipB = screen.getByRole('button', { name: 'B-002' });

    await user.click(chipA);
    await user.click(chipA);

    expect(chipA).toHaveAttribute('aria-pressed', 'false');
    expect(chipB).toHaveAttribute('aria-pressed', 'false');
    expect(chipB).not.toHaveClass('bg-marca');
  });
});