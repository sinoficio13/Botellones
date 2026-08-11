'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export type FiltroState = {
  desde: string;
  hasta: string;
  tipo?: string;
};

type FiltroFechasProps = {
  onFilterChange: (filtro: FiltroState) => void;
  tipos?: { value: string; label: string }[];
  showTipo?: boolean;
};

/**
 * Reusable date range and type filter bar.
 * 'use client' — manages local state, calls parent on change/apply.
 */
export function FiltroFechas({ onFilterChange, tipos, showTipo = false }: FiltroFechasProps) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tipo, setTipo] = useState('');

  const aplicar = () => {
    onFilterChange({
      desde: desde || '',
      hasta: hasta || '',
      tipo: showTipo && tipo ? tipo : undefined,
    });
  };

  const limpiar = () => {
    setDesde('');
    setHasta('');
    setTipo('');
    onFilterChange({ desde: '', hasta: '', tipo: undefined });
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Desde</label>
        <Input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="w-36"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Hasta</label>
        <Input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="w-36"
        />
      </div>

      {showTipo && tipos && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <Select value={tipo} onValueChange={(value) => setTipo(value ?? '')}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {tipos.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={aplicar}>
          Aplicar
        </Button>
        <Button size="sm" variant="outline" onClick={limpiar}>
          Limpiar
        </Button>
      </div>
    </div>
  );
}
