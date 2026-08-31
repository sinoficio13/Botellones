export const TIPOS_IMAGEN_VALIDOS = ['image/jpeg', 'image/png', 'image/webp'];

export const MAX_SOURCE_BYTES = 5 * 1024 * 1024; // 5 MB por foto original

export const MAX_LADO = 1280; // px en el lado más largo tras comprimir

/**
 * Valida una foto ANTES de comprimirla. Devuelve null si el archivo sirve, o
 * un mensaje en español explicando qué se espera (tipo y tamaño máximo).
 */
export function validarImagen(file: File): string | null {
  if (!TIPOS_IMAGEN_VALIDOS.includes(file.type)) {
    return 'Solo se aceptan fotos JPG, PNG o WebP.';
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return `La foto "${file.name}" supera los 5 MB. Subí una más liviana.`;
  }
  return null;
}

/**
 * Comprime una imagen CLIENT-SIDE a JPEG (lado más largo ≤ maxLado, calidad
 * 0.7) para mantener el storage bajo. Devuelve un Blob listo para subir.
 */
export function comprimirImagen(file: File, maxLado = MAX_LADO, calidad = 0.7): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * escala));
        const h = Math.max(1, Math.round(img.naturalHeight * escala));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas no disponible'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('toBlob falló'))),
          'image/jpeg',
          calidad
        );
      };
      img.onerror = () => reject(new Error('no se pudo leer la imagen'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('no se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}