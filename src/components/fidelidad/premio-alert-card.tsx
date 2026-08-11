'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Award, MessageCircle, X } from 'lucide-react';

interface Props {
  nombre: string;
  telefono: string | null;
  nivel: number;
  clienteId: string;
}

export function PremioAlertCard({ nombre, telefono, nivel, clienteId }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const cleanPhone = telefono?.replace(/\D/g, '') || '';

  return (
    <div className="rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-50 to-yellow-50 p-6 shadow-sm dark:border-amber-800/60 dark:from-amber-950/30 dark:to-yellow-950/20">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 rounded-full bg-amber-100 p-2 dark:bg-amber-900/50">
            <Award className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
              ¡{nombre} alcanzó {nivel} recargas!
            </h3>
            <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">
              Tiene un premio pendiente
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-full p-1 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/50"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/clientes/${clienteId}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
        >
          Ver ficha
        </Link>
        {cleanPhone && (
          <a
            href={`https://wa.me/58${cleanPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50"
          >
            <MessageCircle size={16} />
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
