# EPIC-8 — Panel y Reportes

> **Estado**: Completado  
> **Historias**: 6  
> **Depende de**: [[03-Clientes|EPIC-3]], [[04-Botellones-QR|EPIC-4]], [[05-Recargas|EPIC-5]], [[06-Fidelidad|EPIC-6]], [[07-Notificaciones|EPIC-7]]  
> **Siguiente**: [[09-Busqueda-Mapa|EPIC-9]], [[10-PDF-Excel|EPIC-10]]

---

## Descripcion

Dashboard con KPIs, graficos, alertas y resumenes inteligentes. Vistas separadas para admin y repartidor.

---

## Historias

### HIST-8.1 — Dashboard admin: KPIs

Pantalla principal del admin con tarjetas de indicadores clave.

**AC:**
- [x] Total clientes (+ variacion nuevos este mes)
- [x] Botellones activos (asignados a clientes)
- [x] Recargas hoy
- [x] Recargas este mes (con % vs mes anterior)
- [x] Premios pendientes (badge rojo con cantidad)
- [x] Se actualizan al navegar al dashboard

### HIST-8.2 — Dashboard admin: Graficos

Visualizaciones de datos en el dashboard.

**AC:**
- [x] Grafico de barras: recargas por dia (ultimos 30 dias)
- [x] Grafico de torta/donut: distribucion de botellones por estado
- [x] Tabla ranking: top 10 clientes por recargas totales
- [x] Libreria: recharts (ligera, React-native)

### HIST-8.3 — Dashboard admin: Alertas

Seccion de alertas y resumenes inteligentes.

**AC:**
- [x] Premios pendientes de entrega (link a ficha de cada cliente)
- [x] Clientes sin actividad en 30+ dias (en riesgo)
- [x] Clientes sin actividad en 60+ dias (a reconquistar)
- [x] Cada alerta tiene link directo a la ficha correspondiente

### HIST-8.4 — Dashboard repartidor

Vista simplificada para el repartidor: solo lo que necesita en ruta.

**AC:**
- [x] Mis recargas del dia (contador)
- [x] Lista de clientes asignados para hoy
- [x] Acceso rapido: "Registrar recarga" (boton prominente)
- [x] Acceso rapido: "Buscar cliente"
- [x] Sin acceso a reportes, configuracion ni gestion de botellones

### HIST-8.5 — Reportes: menu y navegacion

Seccion de reportes con menu lateral de categorias.

**AC:**
- [x] Ruta `/reportes` con sub-menu: Clientes, Recargas, Botellones, Fidelidad, Operaciones
- [x] Cada reporte tiene filtros (exportar PDF/Excel → EPIC-10)
- [x] Solo accesible por admin

### HIST-8.6 — Resumenes inteligentes

Indicadores de negocio calculados automaticamente.

**AC:**
- [x] Cliente del mes (mayor numero de recargas en el mes)
- [x] Tendencia mensual (crecimiento/decrecimiento de recargas vs mes anterior)
- [x] Zonas activas (sectores con mas clientes, basado en campo `sector`)
- [x] Tasa de retorno (% de clientes que repitieron recarga este mes)

---

## KPIs del dashboard

| KPI | Query |
|---|---|
| Total clientes | `SELECT COUNT(*) FROM clientes` |
| Botellones activos | `SELECT COUNT(*) FROM botellones WHERE estado = 'entregado'` |
| Recargas hoy | `SELECT COUNT(*) FROM recargas WHERE fecha = CURRENT_DATE` |
| Recargas mes | `SELECT COUNT(*) FROM recargas WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE)` |
| Premios pendientes | `SELECT COUNT(*) FROM premios WHERE estado = 'pendiente'` |

---

## Cierre

**Fecha**: 2026-08-11  
**Commits**: a92fa04, 1adea12, 4ceefe3, fe4ddad  
**Archivo SDD**: `sdd/EPIC-8-panel-reportes/archive-report` (Engram)

### Advertencias (deferred)
- **WARNING-01**: Premios pendientes usa aro ámbar en vez de badge rojo (AD-03)
- **WARNING-02**: Filtro de tipo no conectado en /reportes (RP-02)
- **WARNING-03**: Date filter usa days-lookback, no true date range — funciona para "últimos N días" pero no para rangos arbitrarios

### Deferred a EPIC-10
- Exportación PDF/Excel de reportes
