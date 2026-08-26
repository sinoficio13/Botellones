import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  showToast,
  dismissToast,
  ToastHost,
  TOAST_DURATION_MS,
} from '@/components/operaciones/toast';

function renderHost() {
  return render(<ToastHost />);
}

/**
 * Toast — REQ-COS-12. All timing assertions use vitest fake timers
 * (REQ-COS-15 mandates no real waits); module state is reset after each test.
 */
describe('Toast — REQ-COS-12', () => {
  afterEach(() => {
    vi.useRealTimers();
    dismissToast();
  });

  it('renders the message inside a polite live region (S4)', () => {
    renderHost();
    act(() => {
      showToast({ message: 'Avanzados 3 botellones', tone: 'success' });
    });

    expect(screen.getByText('Avanzados 3 botellones')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('auto-dismisses exactly 4.5s after being shown (S2)', () => {
    vi.useFakeTimers();
    renderHost();
    act(() => {
      showToast({ message: 'Avanzados 3 botellones', tone: 'success' });
    });

    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(screen.getByText('Avanzados 3 botellones')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Avanzados 3 botellones')).not.toBeInTheDocument();
  });

  it('replaces the previous toast and restarts the timer on a new show (S1)', () => {
    vi.useFakeTimers();
    renderHost();
    act(() => {
      showToast({ message: 'Primer aviso', tone: 'success' });
    });
    act(() => vi.advanceTimersByTime(3000));
    act(() => {
      showToast({ message: 'Segundo aviso', tone: 'success' });
    });

    expect(screen.queryByText('Primer aviso')).not.toBeInTheDocument();
    expect(screen.getByText('Segundo aviso')).toBeInTheDocument();

    // 2000ms after the second show (5000ms total): the first toast would
    // already be gone, the second must still be visible → timer was reset
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText('Segundo aviso')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2500));
    expect(screen.queryByText('Segundo aviso')).not.toBeInTheDocument();
  });

  it('fires onAction when Deshacer is activated on a success toast (S3)', () => {
    vi.useFakeTimers();
    const onAction = vi.fn();
    renderHost();
    act(() => {
      showToast({
        message: 'Avanzados 3 botellones',
        tone: 'success',
        actionLabel: 'Deshacer',
        onAction,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Avanzados 3 botellones')).not.toBeInTheDocument();
  });

  it('renders no action label for an error-tone toast (S3)', () => {
    renderHost();
    act(() => {
      showToast({
        message: 'No se pudo avanzar',
        tone: 'error',
        actionLabel: 'Deshacer',
        onAction: vi.fn(),
      });
    });

    expect(screen.getByText('No se pudo avanzar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deshacer' })).not.toBeInTheDocument();
  });

  it('keeps a toast shown inside onAction alive after the original dismiss (R3-001)', () => {
    vi.useFakeTimers();
    renderHost();
    act(() => {
      showToast({
        message: 'Avanzados 3 botellones',
        tone: 'success',
        actionLabel: 'Deshacer',
        onAction: () => {
          showToast({ message: 'Deshaciendo movimiento…', tone: 'success' });
        },
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));

    // The dismiss of the original toast must NOT remove the toast shown inside
    // onAction (MOD REQ-COS-12 scenario "Action-shown toast survives (R3-001)").
    expect(screen.queryByText('Avanzados 3 botellones')).not.toBeInTheDocument();
    expect(screen.getByText('Deshaciendo movimiento…')).toBeInTheDocument();

    // The new toast runs its own 4.5s timer.
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(screen.getByText('Deshaciendo movimiento…')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Deshaciendo movimiento…')).not.toBeInTheDocument();
  });
});