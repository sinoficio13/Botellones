'use client';

export function PrintButton() {
  return (
    <p>
      Vista previa —{' '}
      <button
        type="button"
        onClick={() => window.print()}
        style={{
          cursor: 'pointer',
          textDecoration: 'underline',
          background: 'none',
          border: 'none',
          fontSize: 'inherit',
        }}
      >
        Imprimir
      </button>
    </p>
  );
}
