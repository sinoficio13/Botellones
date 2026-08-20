# EPIC-10 — PDF y Excel

> **Estado**: Completado  
> **Historias**: 3  
> **Depende de**: [[08-Panel-Reportes|EPIC-8 — Panel y Reportes]], [[09-Busqueda-Mapa|EPIC-9 — Busqueda y Mapa]]  
> **Siguiente**: [[11-Pulido-PWA|EPIC-11 — Pulido PWA y Seguridad]]  
> **Archivado**: 11/08/2026 — cambio SDD `sdd/EPIC-10-pdf-excel`

---

## Descripcion

Exportacion de reportes en PDF y Excel desde el panel de reportes.

---

## Historias

### HIST-10.1 — Exportacion PDF

Generar PDFs con `@react-pdf/renderer` para cada tipo de reporte.

**AC:**
- [x] PDF de Reporte de Clientes (con logo del negocio en encabezado)
- [x] PDF de Reporte de Recargas (filtrable por fecha)
- [x] PDF de Reporte de Botellones (por estado)
- [x] PDF de Reporte de Fidelidad (ranking + premios)
- [x] Cada PDF incluye: logo, nombre negocio, fecha de generacion, datos del reporte
- [x] Descarga como archivo `.pdf`

### HIST-10.2 — Exportacion Excel

Generar archivos Excel con `xlsx` (SheetJS) para cada tipo de reporte.

**AC:**
- [x] Excel de Lista de Clientes
- [x] Excel de Historial de Recargas
- [x] Excel de Inventario de Botellones
- [x] Descarga como archivo `.xlsx`
- [x] Columnas con formato adecuado (fechas como fecha, numeros como numero)

### HIST-10.3 — Ficha individual en PDF

Boton "Exportar ficha" desde la ficha de cualquier cliente.

**AC:**
- [x] PDF con todos los datos del cliente
- [x] Incluye: datos, direccion, ultima recarga, total recargas, nivel de fidelidad
- [x] Logo del negocio en encabezado
- [x] Descarga inmediata

---

## Reportes disponibles

| Tipo | PDF | Excel |
|---|---|---|
| Clientes | ✅ | ✅ |
| Recargas | ✅ | ✅ |
| Botellones | ✅ | ✅ |
| Fidelidad | ✅ | — |
| Ficha individual | ✅ | — |

## Stack

| Componente | Libreria |
|---|---|
| PDF | @react-pdf/renderer (server-side) |
| Excel | xlsx / SheetJS |
