import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { SharedHeader } from './shared-header';
import type { PremioRow } from '@/lib/db/premios';
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
    marginTop: 20,
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
  cellCliente: { width: '40%' },
  cellNivel: { width: '30%' },
  cellFecha: { width: '30%', textAlign: 'right' },
  cellTipo: { width: '30%' },
  empty: {
    paddingVertical: 16,
    textAlign: 'center',
    color: '#9ca3af',
  },
});

type FidelidadPdfProps = {
  pendientes: PremioRow[];
  entregados: PremioRow[];
  info: BusinessInfo;
};

export function FidelidadPdf({ pendientes, entregados, info }: FidelidadPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <SharedHeader info={info} title="Reporte de Fidelidad" />

        {/* Pendientes */}
        <Text style={styles.sectionTitle}>Premios pendientes</Text>
        {pendientes.length === 0 ? (
          <Text style={styles.empty}>Sin premios</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.headerRow}>
              <Text style={styles.cellCliente}>Cliente</Text>
              <Text style={styles.cellNivel}>Nivel</Text>
              <Text style={styles.cellFecha}>Alcanzado</Text>
            </View>
            {pendientes.map((p) => (
              <View style={styles.row} key={p.id} wrap={false}>
                <Text style={styles.cellCliente}>
                  {p.clientes?.nombre ?? '—'}
                </Text>
                <Text style={styles.cellNivel}>{p.nivel_recargas}</Text>
                <Text style={styles.cellFecha}>{p.fecha_alcanzado}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Entregados */}
        <Text style={styles.sectionTitle}>Premios entregados</Text>
        {entregados.length === 0 ? (
          <Text style={styles.empty}>Sin premios</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.headerRow}>
              <Text style={styles.cellCliente}>Cliente</Text>
              <Text style={styles.cellTipo}>Tipo</Text>
              <Text style={styles.cellNivel}>Nivel</Text>
            </View>
            {entregados.map((p) => (
              <View style={styles.row} key={p.id} wrap={false}>
                <Text style={styles.cellCliente}>
                  {p.clientes?.nombre ?? '—'}
                </Text>
                <Text style={styles.cellTipo}>{p.tipo_premio ?? '—'}</Text>
                <Text style={styles.cellNivel}>{p.nivel_recargas}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
