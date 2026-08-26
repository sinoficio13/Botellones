import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TabsEstados } from '@/components/operaciones/tabs-estados';
import { BarraContexto } from '@/components/operaciones/barra-contexto';
import { VacioPorEstado } from '@/components/operaciones/copy-vacios';
import { ListaSkeleton } from '@/components/operaciones/lista-skeleton';
import { ESTADOS_OPERATIVOS, type EstadoOperativo } from '@/hooks/useColaOperaciones';

const CONTADORES: Record<EstadoOperativo, number> = { recibido: 3, recarga: 1, listo: 0, delivery: 2 };

describe('TabsEstados — REQ-COS-17', () => {
  it('renders a tablist with 4 tabs carrying per-estado group counters', () => {
    render(<TabsEstados activo="recibido" onCambio={vi.fn()} contadores={CONTADORES} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'Recibido 3' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'En recarga 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Listo 0' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'En delivery 2' })).toBeInTheDocument();
  });

  it('marks only the active tab aria-selected and notifies on change', () => {
    const onCambio = vi.fn();
    render(<TabsEstados activo="recibido" onCambio={onCambio} contadores={CONTADORES} />);
    expect(screen.getByRole('tab', { name: 'Recibido 3' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'En recarga 1' })).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(screen.getByRole('tab', { name: 'En recarga 1' }));
    expect(onCambio).toHaveBeenCalledWith('recarga');
  });

  it('underlines the active tab in its --estado-* token and keeps the tablist sticky', () => {
    render(<TabsEstados activo="delivery" onCambio={vi.fn()} contadores={CONTADORES} />);
    const tablist = screen.getByRole('tablist');
    // Sticky positioning + 2px underline token are positional/visual (jsdom cannot
    // observe position:sticky or token colors) — asserted via the utility classes
    // that carry the locked behavior (design: tabs sticky; underline = estado token).
    expect(tablist.className).toContain('sticky');
    expect(tablist.className).toContain('top-0');
    const tab = screen.getByRole('tab', { name: 'En delivery 2' });
    const underline = tab.querySelector('span[aria-hidden="true"]');
    expect(underline).not.toBeNull();
    expect(underline!.className).toContain('bg-estado-delivery');
    expect(underline!.className).toContain('h-0.5');
    expect(screen.getByRole('tab', { name: 'Recibido 3' }).querySelector('span[aria-hidden="true"]')).toBeNull();
  });
});

describe('BarraContexto — REQ-COS-17', () => {
  it('shows queue totals with the más antiguo arriba hint (plural + singular)', () => {
    render(<BarraContexto clientes={3} botellones={5} />);
    expect(screen.getByText('3 clientes · 5 botellones · más antiguo arriba')).toBeInTheDocument();
    render(<BarraContexto clientes={1} botellones={1} />);
    expect(screen.getByText('1 cliente · 1 botellón · más antiguo arriba')).toBeInTheDocument();
  });
});

describe('VacioPorEstado — REQ-COS-21 per-tab empty copy', () => {
  const CASOS: Array<[EstadoOperativo, string, string, string]> = [
    ['recibido', 'Nada esperando lavado', 'Escanéá un botellón para sumarlo a la cola de lavado.', '📷 Escanear'],
    ['recarga', 'Nada llenándose', 'Pasá botellones desde Recibido para empezar el llenado.', 'Ver Recibido'],
    ['listo', 'Nada listo para salir', 'Cuando termine la recarga, los botellones listos aparecen acá.', 'Ver En recarga'],
    ['delivery', 'Nada en la calle', 'Los botellones en delivery aparecen acá hasta que vuelvan entregados.', 'Ver Listo'],
  ];

  it('renders title, description, icon and action button for every estado', () => {
    expect(CASOS).toHaveLength(ESTADOS_OPERATIVOS.length);
    for (const [estado, titulo, descripcion, accion] of CASOS) {
      const { container } = render(<VacioPorEstado estado={estado} />);
      expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument();
      expect(screen.getByText(descripcion)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: accion })).toBeInTheDocument();
      expect(container.querySelector('svg')).not.toBeNull();
      container.remove();
    }
  });
});

describe('ListaSkeleton — REQ-COS-21 loading blocks', () => {
  it('renders shimmer placeholders and never a spinner', () => {
    const { container } = render(<ListaSkeleton cantidad={2} />);
    expect(container.querySelectorAll('.animate-shimmer')).toHaveLength(6); // 3 per card × 2
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(container.textContent).toBe('');
  });
});