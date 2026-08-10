# EPIC-10 — PDF y Excel

> **Estado**: Pendiente  
> **Historias**: 3  
> **Depende de**: [[08-Panel-Reportes|EPIC-8 — Panel y Reportes]], [[09-Busqueda-Mapa|EPIC-9 — Busqueda y Mapa]]  
> **Siguiente**: [[11-Pulido-PWA|EPIC-11 — Pulido PWA y Seguridad]]

---

## Descripcion

Exportacion de reportes en PDF y Excel desde el panel de reportes.

---

## Historias

### HIST-10.1 — Exportacion PDF

Generar PDFs con `@react-pdf/renderer` para cada tipo de reporte.

**AC:**
- [ ] PDF de Reporte de Clientes (con logo del negocio en encabezado)
- [ ] PDF de Reporte de Recargas (filtrable por fecha)
- [ ] PDF de Reporte de Botellones (por estado)
- [ ] PDF de Reporte de Fidelidad (ranking + premios)
- [ ] Cada PDF incluye: logo, nombre negocio, fecha de generacion, datos del reporte
- [ ] Descarga como archivo `.pdf`

### HIST-10.2 — Exportacion Excel

Generar archivos Excel con `xlsx` (SheetJS) para cada tipo de reporte.

**AC:**
- [ ] Excel de Lista de Clientes
- [ ] Excel de Historial de Recargas
- [ ] Excel de Inventario de Botellones
- [ ] Descarga como archivo `.xlsx`
- [ ] Columnas con formato adecuado (fechas como fecha, numeros como numero)

### HIST-10.3 — Ficha individual en PDF

Boton "Exportar ficha" desde la ficha de cualquier cliente.

**AC:**
- [ ] PDF con todos los datos del cliente
- [ ] Incluye: datos, direccion, ultima recarga, total recargas, nivel de fidelidad
- [ ] Logo del negocio en encabezado
- [ ] Descarga inmediata

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
