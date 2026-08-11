import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { SharedHeader } from './shared-header';
import type { RecargaPorDia, TopCliente } from '@/lib/db/analytics';
import type { BusinessInfo } from '@/lib/export/types';

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
  counters: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  counterCard: {
    flex: 1,
    border: '1pt solid #e5e7eb',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 20,
    fontWeight: 700,
    color: '#111827',
  },
  counterLabel: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 2,
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
  cellFecha: { width: '30%' },
  cellCount: { width: '70%', textAlign: 'right' },
  cellPos: { width: '10%' },
  cellCliente: { width: '55%' },
  cellTotal: { width: '35%', textAlign: 'right' },
});

type RecargasPdfProps = {
  recargasPorDia: RecargaPorDia[];
  topClientes: TopCliente[];
  contadores: { recargas_hoy: number; recargas_mes: number; recargas_total: number };
  info: BusinessInfo;
};

export function RecargasPdf({
  recargasPorDia,
  topClientes,
  contadores,
  info,
}: RecargasPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <SharedHeader info={info} title="Reporte de Recargas" />

        {/* Contadores */}
        <View style={styles.counters}>
          <View style={styles.counterCard}>
            <Text style={styles.counterValue}>{contadores.recargas_hoy}</Text>
            <Text style={styles.counterLabel}>Recargas hoy</Text>
          </View>
          <View style={styles.counterCard}>
            <Text style={styles.counterValue}>{contadores.recargas_mes}</Text>
            <Text style={styles.counterLabel}>Recargas este mes</Text>
          </View>
          <View style={styles.counterCard}>
            <Text style={styles.counterValue}>{contadores.recargas_total}</Text>
            <Text style={styles.counterLabel}>Total histórico</Text>
          </View>
        </View>

        {/* Recargas por día */}
        <Text style={styles.sectionTitle}>Recargas por día</Text>
        {recargasPorDia.length === 0 ? (
          <Text style={{ color: '#9ca3af', paddingVertical: 16, textAlign: 'center' }}>
            Sin datos
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.headerRow}>
              <Text style={styles.cellFecha}>Fecha</Text>
              <Text style={styles.cellCount}>Recargas</Text>
            </View>
            {recargasPorDia.map((r) => (
              <View style={styles.row} key={r.fecha} wrap={false}>
                <Text style={styles.cellFecha}>{r.fecha}</Text>
                <Text style={styles.cellCount}>{r.count}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Top 20 */}
        <Text style={styles.sectionTitle}>Top 20 clientes</Text>
        {topClientes.length === 0 ? (
          <Text style={{ color: '#9ca3af', paddingVertical: 16, textAlign: 'center' }}>
            Sin datos
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.headerRow}>
              <Text style={styles.cellPos}>#</Text>
              <Text style={styles.cellCliente}>Cliente</Text>
              <Text style={styles.cellTotal}>Total Recargas</Text>
            </View>
            {topClientes.map((c, i) => (
              <View style={styles.row} key={c.cliente_id} wrap={false}>
                <Text style={styles.cellPos}>{i + 1}</Text>
                <Text style={styles.cellCliente}>{c.nombre}</Text>
                <Text style={styles.cellTotal}>{c.total_recargas}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
