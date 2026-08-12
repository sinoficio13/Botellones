'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { AlertTriangle, Gift, UserX, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type AlertaItem = {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  href: string;
  entidadId: string;
};

type AlertasPanel = {
  premiosPendientes: AlertaItem[];
  clientesInactivos30: AlertaItem[];
  clientesInactivos60: AlertaItem[];
  botellonesDanados: AlertaItem[];
};

const PAGE_SIZE = 5;

type SectionKey = 'premiosPendientes' | 'clientesInactivos30' | 'clientesInactivos60' | 'botellonesDanados';

type SectionConfig = {
  key: SectionKey;
  icon: React.ReactNode;
  title: string;
  variant?: 'destructive';
};

const SECTIONS: SectionConfig[] = [
  { key: 'premiosPendientes', icon: <Gift className="h-4 w-4" />, title: 'Premios pendientes' },
  { key: 'clientesInactivos30', icon: <UserX className="h-4 w-4" />, title: 'Inactivos 30+ días' },
  { key: 'clientesInactivos60', icon: <UserX className="h-4 w-4" />, title: 'Inactivos 60+ días', variant: 'destructive' },
  { key: 'botellonesDanados', icon: <Wrench className="h-4 w-4" />, title: 'Botellones dañados', variant: 'destructive' },
];

/**
 * Alert panel with pagination and Supabase Realtime subscription.
 * Shows alerts grouped by section, paginated at 10 total across sections.
 * Subscribes to premios, botellones, and recargas changes for live updates.
 */
export function AlertPanel({ data: initialData }: { data: AlertasPanel }) {
  const [data, setData] = useState<AlertasPanel>(initialData);
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(new Set());
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const supabase = createClient();

  // Realtime subscriptions
  useEffect(() => {
    const handlePremioChange = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      // Refresh alerts when premios change
      refreshAlerts();
    };

    const handleBotellonChange = () => refreshAlerts();
    const handleRecargaChange = () => refreshAlerts();

    const premiosChannel = supabase
      .channel('alertas-premios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'premios' }, handlePremioChange)
      .subscribe();

    const botellonesChannel = supabase
      .channel('alertas-botellones')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'botellones' }, handleBotellonChange)
      .subscribe();

    const recargasChannel = supabase
      .channel('alertas-recargas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'recargas' }, handleRecargaChange)
      .subscribe();

    return () => {
      supabase.removeChannel(premiosChannel);
      supabase.removeChannel(botellonesChannel);
      supabase.removeChannel(recargasChannel);
    };
  }, []);

  const refreshAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alertas', { credentials: 'include' });
      if (res.ok) {
        const fresh = await res.json();
        setData(fresh);
      }
    } catch {
      // Keep existing data on error
    }
  }, []);

  const toggleSection = (key: SectionKey) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const hasAlerts = SECTIONS.some((s) => data[s.key].length > 0);

  if (!hasAlerts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-24 items-center justify-center text-muted-foreground text-sm">
          Sin alertas pendientes
        </CardContent>
      </Card>
    );
  }

  // Count total visible items (respecting page size + expanded sections)
  let shown = 0;
  const sectionsContent: React.ReactNode[] = [];

  for (const section of SECTIONS) {
    const items = data[section.key];
    if (items.length === 0) continue;

    const isExpanded = expandedSections.has(section.key);
    // Unexpanded: show up to remaining page slots
    // Expanded: show all
    const remaining = pageSize - shown;
    const visibleItems = isExpanded ? items : items.slice(0, Math.min(items.length, Math.max(1, remaining)));

    shown += visibleItems.length;

    sectionsContent.push(
      <div key={section.key}>
        <button
          onClick={() => toggleSection(section.key)}
          className="mb-2 flex w-full items-center gap-2 text-left"
        >
          {section.icon}
          <span className="text-sm font-medium">{section.title}</span>
          <Badge variant={section.variant === 'destructive' ? 'destructive' : 'secondary'}>
            {items.length}
          </Badge>
          {isExpanded ? (
            <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <div className="space-y-1">
          {visibleItems.map((a) => (
            <AlertRow key={a.id} item={a} />
          ))}
          {!isExpanded && items.length > visibleItems.length && (
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              + {items.length - visibleItems.length} más
            </button>
          )}
        </div>
      </div>
    );
  }

  const totalAlerts = SECTIONS.reduce((sum, s) => sum + data[s.key].length, 0);
  const allExpanded = SECTIONS.every((s) => !data[s.key].length || expandedSections.has(s.key));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Alertas
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {totalAlerts} total &middot; {allExpanded ? 'todas' : `${pageSize} por página`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sectionsContent}
        {!allExpanded && shown < totalAlerts && (
          <button
            onClick={() => setPageSize((p) => p + PAGE_SIZE)}
            className="w-full rounded-md border py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            Mostrar más alertas
          </button>
        )}
        {allExpanded && totalAlerts > PAGE_SIZE && (
          <button
            onClick={() => {
              setPageSize(PAGE_SIZE);
              setExpandedSections(new Set());
            }}
            className="w-full rounded-md border py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            Colapsar
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function AlertRow({ item }: { item: AlertaItem }) {
  return (
    <Link
      href={item.href}
      className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm hover:bg-muted transition-colors"
    >
      <span className="font-medium text-foreground">{item.titulo}</span>
      <span className="text-muted-foreground text-xs">{item.descripcion}</span>
    </Link>
  );
}