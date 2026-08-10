# EPIC-8 — Panel y Reportes

> **Estado**: Pendiente  
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
- [ ] Total clientes (+ variacion nuevos este mes)
- [ ] Botellones activos (asignados a clientes)
- [ ] Botellones en planta (disponibles)
- [ ] Recargas hoy
- [ ] Recargas este mes (con % vs mes anterior)
- [ ] Premios pendientes (badge rojo con cantidad)
- [ ] Se actualizan al navegar al dashboard

### HIST-8.2 — Dashboard admin: Graficos

Visualizaciones de datos en el dashboard.

**AC:**
- [ ] Grafico de barras: recargas por dia (ultimos 30 dias)
- [ ] Grafico de torta/donut: distribucion de botellones por estado
- [ ] Tabla ranking: top 10 clientes por recargas totales
- [ ] Libreria: recharts (ligera, React-native)

### HIST-8.3 — Dashboard admin: Alertas

Seccion de alertas y resumenes inteligentes.

**AC:**
- [ ] Premios pendientes de entrega (link a ficha de cada cliente)
- [ ] Clientes sin actividad en 30+ dias (en riesgo)
- [ ] Clientes sin actividad en 60+ dias (a reconquistar)
- [ ] Botellones en mantenimiento o danados
- [ ] Cada alerta tiene link directo a la ficha correspondiente

### HIST-8.4 — Dashboard repartidor

Vista simplificada para el repartidor: solo lo que necesita en ruta.

**AC:**
- [ ] Mis recargas del dia (contador)
- [ ] Lista de clientes asignados para hoy
- [ ] Acceso rapido: "Registrar recarga" (boton prominente)
- [ ] Acceso rapido: "Buscar cliente"
- [ ] Sin acceso a reportes, configuracion ni gestion de botellones

### HIST-8.5 — Reportes: menu y navegacion

Seccion de reportes con menu lateral de categorias.

**AC:**
- [ ] Ruta `/reportes` con sub-menu: Clientes, Recargas, Botellones, Fidelidad, Operaciones
- [ ] Cada reporte tiene filtros y boton de exportar (PDF/Excel)
- [ ] Solo accesible por admin

### HIST-8.6 — Resumenes inteligentes

Indicadores de negocio calculados automaticamente.

**AC:**
- [ ] Cliente del mes (mayor numero de recargas en el mes)
- [ ] Tendencia mensual (crecimiento/decrecimiento de recargas vs mes anterior)
- [ ] Zonas activas (sectores con mas clientes, basado en campo `sector`)
- [ ] Tasa de retorno (% de clientes que repitieron recarga este mes)

---

## KPIs del dashboard

| KPI | Query |
|---|---|
| Total clientes | `SELECT COUNT(*) FROM clientes` |
| Botellones activos | `SELECT COUNT(*) FROM botellones WHERE estado = 'asignado'` |
| Botellones en planta | `SELECT COUNT(*) FROM botellones WHERE estado = 'disponible'` |
| Recargas hoy | `SELECT COUNT(*) FROM recargas WHERE fecha = CURRENT_DATE` |
| Recargas mes | `SELECT COUNT(*) FROM recargas WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE)` |
| Premios pendientes | `SELECT COUNT(*) FROM premios WHERE estado = 'pendiente'` |
