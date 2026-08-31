import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GaleriaFotos } from '@/components/clientes/galeria-fotos';

const FOTOS = [
  { id: 'f-1', url: 'https://cdn.test/f1.jpg' },
  { id: 'f-2', url: 'https://cdn.test/f2.jpg' },
];

describe('GaleriaFotos — lightbox de fachadas', () => {
  it('renders the photo at the initial index with counter', () => {
    render(<GaleriaFotos fotos={FOTOS} indiceInicial={0} onClose={vi.fn()} />);

    const img = screen.getByRole('img', { name: 'Foto de fachada 1' });
    expect(img).toHaveAttribute('src', 'https://cdn.test/f1.jpg');
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('next and prev buttons change the index and update the counter', () => {
    render(<GaleriaFotos fotos={FOTOS} indiceInicial={0} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('img', { name: 'Foto de fachada 2' })).toHaveAttribute(
      'src',
      'https://cdn.test/f2.jpg'
    );
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(screen.getByRole('img', { name: 'Foto de fachada 1' })).toHaveAttribute(
      'src',
      'https://cdn.test/f1.jpg'
    );
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('clamps navigation at the ends (prev disabled on first, next disabled on last)', () => {
    render(<GaleriaFotos fotos={FOTOS} indiceInicial={0} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('hides nav buttons when there is a single photo', () => {
    render(<GaleriaFotos fotos={[FOTOS[0]]} indiceInicial={0} onClose={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });

  it('closes on Escape (keydown on document)', () => {
    const onClose = vi.fn();
    render(<GaleriaFotos fotos={FOTOS} indiceInicial={0} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ArrowLeft and ArrowRight navigate', () => {
    render(<GaleriaFotos fotos={FOTOS} indiceInicial={0} onClose={vi.fn()} />);

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('backdrop click closes the gallery', () => {
    const onClose = vi.fn();
    render(<GaleriaFotos fotos={FOTOS} indiceInicial={0} onClose={onClose} />);

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the image area does not close (stops propagation)', () => {
    const onClose = vi.fn();
    render(<GaleriaFotos fotos={FOTOS} indiceInicial={0} onClose={onClose} />);

    fireEvent.click(screen.getByRole('img', { name: 'Foto de fachada 1' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});