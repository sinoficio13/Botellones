import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { SharedHeader } from './shared-header';
import type { ClienteRow } from '@/lib/db/clientes';
import type { PremioRow } from '@/lib/db/premios';
import type { BusinessInfo } from '@/lib/export/types';

type RecargaItem = {
  fecha: string;
  hora: string;
  botellon_codigo?: string;
};

type DireccionData = {
  calle?: string | null;
  avenida?: string | null;
  sector?: string | null;
  urbanizacion?: string | null;
  ciudad?: string | null;
  referencia?: string | null;
} | null;

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 8,
    marginTop: 16,
    paddingBottom: 4,
    borderBottom: '1pt solid #e5e7eb',
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  fieldLabel: {
    width: '30%',
    color: '#6b7280',
    fontWeight: 500,
  },
  fieldValue: {
    width: '70%',
    color: '#111827',
  },
  fidelityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  badge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: 700,
    color: '#111827',
  },
  progressBar: {
    marginTop: 6,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    width: '100%',
  },
  progressFill: {
    height: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 4,
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
  cellHora: { width: '25%' },
  cellBotellon: { width: '45%' },
  empty: {
    paddingVertical: 16,
    textAlign: 'center',
    color: '#9ca3af',
  },
});

type ClienteFichaPdfProps = {
  cliente: ClienteRow;
  recargas: RecargaItem[];
  premios: PremioRow[];
  direccion: DireccionData;
  info: BusinessInfo;
};

export function ClienteFichaPdf({
  cliente,
  recargas,
  premios,
  direccion,
  info,
}: ClienteFichaPdfProps) {
  const pendientes = premios.filter((p) => p.estado === 'pendiente');
  const entregados = premios.filter((p) => p.estado === 'entregado');
  const nivelRecargas = cliente.total_recargas ?? 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <SharedHeader info={info} title={`Ficha — ${cliente.nombre}`} />

        {/* Datos personales */}
        <Text style={styles.sectionTitle}>Datos personales</Text>
        <Field label="Nombre" value={cliente.nombre} />
        <Field label="Código" value={cliente.codigo} />
        <Field label="Negocio" value={cliente.negocio ?? '—'} />
        <Field label="Cédula" value={cliente.cedula ?? '—'} />
        <Field label="Teléfono 1" value={cliente.telefono_1 ?? '—'} />
        <Field label="Teléfono 2" value={cliente.telefono_2 ?? '—'} />
        <Field label="WhatsApp" value={cliente.whatsapp ?? '—'} />

        {/* Dirección */}
        <Text style={styles.sectionTitle}>Dirección</Text>
        {direccion ? (
          <>
            <Field label="Calle" value={direccion.calle ?? '—'} />
            <Field label="Avenida" value={direccion.avenida ?? '—'} />
            <Field label="Sector" value={direccion.sector ?? '—'} />
            <Field label="Urbanización" value={direccion.urbanizacion ?? '—'} />
            <Field label="Ciudad" value={direccion.ciudad ?? '—'} />
            <Field label="Referencia" value={direccion.referencia ?? '—'} />
          </>
        ) : (
          <Text style={styles.empty}>Sin dirección registrada</Text>
        )}

        {/* Historial de recargas */}
        <Text style={styles.sectionTitle}>Historial de recargas</Text>
        {recargas.length === 0 ? (
          <Text style={styles.empty}>Sin recargas registradas</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.headerRow}>
              <Text style={styles.cellFecha}>Fecha</Text>
              <Text style={styles.cellHora}>Hora</Text>
              <Text style={styles.cellBotellon}>Botellón</Text>
            </View>
            {recargas.map((r, i) => (
              <View style={styles.row} key={i} wrap={false}>
                <Text style={styles.cellFecha}>{r.fecha}</Text>
                <Text style={styles.cellHora}>{r.hora}</Text>
                <Text style={styles.cellBotellon}>{r.botellon_codigo ?? '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Fidelidad */}
        <Text style={styles.sectionTitle}>Fidelidad</Text>
        <View style={styles.fidelityBadge}>
          <Text style={styles.badge}>Nivel {nivelRecargas} recargas</Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={{
              ...styles.progressFill,
              width: `${Math.min((nivelRecargas % 100) / 100 * 100, 100)}%`,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={{ fontSize: 8, color: '#9ca3af' }}>
            {Math.floor(nivelRecargas / 100) * 100}
          </Text>
          <Text style={{ fontSize: 8, color: '#9ca3af' }}>
            {Math.ceil(nivelRecargas / 100) * 100}
          </Text>
        </View>

        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 9, color: '#374151' }}>
            Premios pendientes: {pendientes.length}
          </Text>
          <Text style={{ fontSize: 9, color: '#374151' }}>
            Premios entregados: {entregados.length}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}
