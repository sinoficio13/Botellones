import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/operaciones/empty-state';
import { Skeleton } from '@/components/operaciones/skeleton';

describe('EmptyState — REQ-COS-14', () => {
  it('renders icon, title, description and action in that order with locked sizes/tones', () => {
    const { container } = render(
      <EmptyState
        title="Sin botellones"
        description="No hay botellones en este estado."
        action={<button>Ver todos</button>}
      />
    );

    const icon = container.querySelector('svg');
    const title = screen.getByRole('heading', { name: 'Sin botellones' });
    const description = screen.getByText('No hay botellones en este estado.');
    const action = screen.getByRole('button', { name: 'Ver todos' });

    expect(icon).not.toBeNull();
    expect(icon).toHaveClass('size-10', 'text-text-muted');
    expect(title).toHaveClass('text-[15px]', 'font-medium', 'text-text-primary');
    expect(description).toHaveClass('text-xs', 'text-text-muted');

    const following = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(icon!.compareDocumentPosition(title) & following).toBeTruthy();
    expect(title.compareDocumentPosition(description) & following).toBeTruthy();
    expect(description.compareDocumentPosition(action) & following).toBeTruthy();
  });

  it('omits the action element when none is provided', () => {
    const { container } = render(
      <EmptyState title="Sin botellones" description="No hay nada." />
    );

    expect(screen.getByRole('heading', { name: 'Sin botellones' })).toBeInTheDocument();
    expect(screen.getByText('No hay nada.')).toBeInTheDocument();
    expect(container.querySelector('button')).toBeNull();
  });
});

describe('Skeleton — REQ-COS-13', () => {
  it('renders a shimmer placeholder with a 1.5s looping animation and no spinner', () => {
    const { container } = render(<Skeleton className="h-20 w-full" />);

    const shimmer = container.querySelector('div');
    expect(shimmer).not.toBeNull();
    expect(shimmer).toHaveClass('animate-shimmer');
    // 4R R4-001: shimmer must stop under prefers-reduced-motion
    expect(shimmer).toHaveClass('motion-reduce:animate-none');
    expect(shimmer).toHaveClass('h-20', 'w-full');
    expect(shimmer).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders no spinner, icon, or text inside the placeholder', () => {
    const { container } = render(<Skeleton />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toBe('');
  });
});