import { describe, it, expect } from 'vitest';
import { validarImagen, MAX_SOURCE_BYTES } from '@/lib/client/imagen';

describe('validarImagen — tipo y tamaño de la foto', () => {
  it('acepta JPG, PNG y WebP', () => {
    const jpeg = new File(['data'], 'foto.jpg', { type: 'image/jpeg' });
    const png = new File(['data'], 'foto.png', { type: 'image/png' });
    const webp = new File(['data'], 'foto.webp', { type: 'image/webp' });

    expect(validarImagen(jpeg)).toBeNull();
    expect(validarImagen(png)).toBeNull();
    expect(validarImagen(webp)).toBeNull();
  });

  it('rechaza un archivo .txt explicando qué subir', () => {
    const file = new File(['nota'], 'nota.txt', { type: 'text/plain' });

    expect(validarImagen(file)).toBe('Solo se aceptan fotos JPG, PNG o WebP.');
  });

  it('rechaza un archivo de más de 5 MB con su mensaje de tamaño', () => {
    const file = new File([new ArrayBuffer(MAX_SOURCE_BYTES + 1)], 'grande.jpg', {
      type: 'image/jpeg',
    });

    expect(validarImagen(file)).toBe(
      'La foto "grande.jpg" supera los 5 MB. Subí una más liviana.'
    );
  });

  it('acepta un archivo válido y pequeño', () => {
    const file = new File(['pequeño'], 'chica.png', { type: 'image/png' });

    expect(validarImagen(file)).toBeNull();
  });
});

// Nota: `comprimirImagen` NO se testea en jsdom — necesita canvas + Image +
// FileReader reales (jsdom no implementa canvas). Se cubre indirectamente a
// través de los flujos de subida (FachadaUploader / SubirFotos) en el browser.