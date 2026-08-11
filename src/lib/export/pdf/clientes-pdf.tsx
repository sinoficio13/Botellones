import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { SharedHeader } from './shared-header';
import type { ClienteListRow } from '@/lib/db/clientes';
import type { BusinessInfo } from '@/lib/export/types';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
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
  cellCodigo: { width: '12%' },
  cellNombre: { width: '28%' },
  cellTelefono: { width: '16%' },
  cellTipo: { width: '12%' },
  cellRecargas: { width: '14%', textAlign: 'right' },
  cellUltima: { width: '18%', textAlign: 'right' },
  empty: {
    paddingVertical: 32,
    textAlign: 'center',
    color: '#9ca3af',
  },
});

type ClientesPdfProps = {
  clientes: ClienteListRow[];
  info: BusinessInfo;
};

export function ClientesPdf({ clientes, info }: ClientesPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <SharedHeader info={info} title="Reporte de Clientes" />

        {clientes.length === 0 ? (
          <Text style={styles.empty}>Sin datos</Text>
        ) : (
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={styles.cellCodigo}>Código</Text>
              <Text style={styles.cellNombre}>Nombre</Text>
              <Text style={styles.cellTelefono}>Teléfono</Text>
              <Text style={styles.cellTipo}>Tipo</Text>
              <Text style={styles.cellRecargas}>Total Recargas</Text>
              <Text style={styles.cellUltima}>Última Recarga</Text>
            </View>
            {/* Rows */}
            {clientes.map((c) => (
              <View style={styles.row} key={c.id} wrap={false}>
                <Text style={styles.cellCodigo}>{c.codigo}</Text>
                <Text style={styles.cellNombre}>{c.nombre}</Text>
                <Text style={styles.cellTelefono}>{c.telefono_1 ?? '—'}</Text>
                <Text style={styles.cellTipo}>{c.tipo_cliente ?? '—'}</Text>
                <Text style={styles.cellRecargas}>{c.total_recargas}</Text>
                <Text style={styles.cellUltima}>{c.ultima_recarga ?? '—'}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
