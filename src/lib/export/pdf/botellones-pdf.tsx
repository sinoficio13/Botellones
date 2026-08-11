import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { SharedHeader } from './shared-header';
import type { BotellonPorEstado } from '@/lib/db/analytics';
import type { BusinessInfo } from '@/lib/export/types';

type BotellonRow = {
  id: string;
  codigo: string;
  estado: string;
  cliente_id: string | null;
  fecha_creacion: string | null;
  clientes?: { nombre: string } | null;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 8,
    marginTop: 16,
  },
  stateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  stateCard: {
    border: '1pt solid #e5e7eb',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  stateValue: {
    fontSize: 16,
    fontWeight: 700,
    color: '#111827',
  },
  stateLabel: {
    fontSize: 8,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  table: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottom: '1pt solid #d1d5db',
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontWeight: 700,
  },
  row: {
    flexDirection: 'row',
    borderBottom: '1pt solid #f3f4f6',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  cellCodigo: { width: '20%' },
  cellEstado: { width: '20%', textTransform: 'capitalize' },
  cellCliente: { width: '35%' },
  cellCreado: { width: '25%', textAlign: 'right' },
});

type BotellonesPdfProps = {
  botellones: BotellonRow[];
  estados: BotellonPorEstado[];
  info: BusinessInfo;
};

export function BotellonesPdf({ botellones, estados, info }: BotellonesPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <SharedHeader info={info} title="Reporte de Botellones" />

        {/* State distribution */}
        <Text style={styles.sectionTitle}>Distribución por estado</Text>
        {estados.length === 0 ? (
          <Text style={{ color: '#9ca3af', paddingVertical: 16, textAlign: 'center' }}>
            Sin datos
          </Text>
        ) : (
          <View style={styles.stateGrid}>
            {estados.map((e) => (
              <View style={styles.stateCard} key={e.estado}>
                <Text style={styles.stateValue}>{e.count}</Text>
                <Text style={styles.stateLabel}>{e.estado}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Botellones list */}
        <Text style={styles.sectionTitle}>Botellones</Text>
        {botellones.length === 0 ? (
          <Text style={{ color: '#9ca3af', paddingVertical: 16, textAlign: 'center' }}>
            Sin datos
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.headerRow}>
              <Text style={styles.cellCodigo}>Código</Text>
              <Text style={styles.cellEstado}>Estado</Text>
              <Text style={styles.cellCliente}>Cliente</Text>
              <Text style={styles.cellCreado}>Creado</Text>
            </View>
            {botellones.map((b) => (
              <View style={styles.row} key={b.id} wrap={false}>
                <Text style={styles.cellCodigo}>{b.codigo}</Text>
                <Text style={styles.cellEstado}>{b.estado}</Text>
                <Text style={styles.cellCliente}>
                  {b.clientes?.nombre ?? '—'}
                </Text>
                <Text style={styles.cellCreado}>
                  {b.fecha_creacion?.slice(0, 10) ?? '—'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
