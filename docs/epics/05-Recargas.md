# EPIC-5 — Recargas

> **Estado**: Pendiente  
> **Historias**: 5  
> **Depende de**: [[03-Clientes|EPIC-3 — Clientes]], [[04-Botellones-QR|EPIC-4 — Botellones + QR]]  
> **Siguiente**: [[06-Fidelidad|EPIC-6 — Fidelidad]], [[08-Panel-Reportes|EPIC-8 — Panel y Reportes]]

---

## Descripcion

Registrar una recarga toma 3 taps. Fecha/hora automaticas. Queda historial completo.

---

## Historias

### HIST-5.1 — Registro rapido de recarga (3 taps)

Flujo optimizado para mobile: buscar cliente → elegir botellon → confirmar.

**AC:**
- [ ] Paso 1: Buscar cliente (input con autocompletado)
- [ ] Paso 2: Seleccionar botellon del cliente (solo muestra los asignados a ese cliente)
- [ ] Paso 3: Confirmar (muestra resumen: cliente, botellon)
- [ ] Fecha y hora automaticas (sin input manual)
- [ ] Usuario que registra asignado automaticamente
- [ ] Feedback visual: toast de confirmacion
- [ ] Boton "Registrar otra" para repetir el flujo

### HIST-5.2 — Historial de recargas por cliente

Tabla de recargas en ficha del cliente, filtrable.

**AC:**
- [ ] Orden cronologico inverso (mas reciente primero)
- [ ] Columnas: fecha, hora, botellon, repartidor
- [ ] Filtro por rango de fechas
- [ ] Total de recargas en el periodo

### HIST-5.3 — Historial de recargas por botellon

Tabla de recargas en ficha del botellon.

**AC:**
- [ ] Orden cronologico inverso
- [ ] Columnas: fecha, hora, cliente, repartidor
- [ ] Total de recargas del botellon

### HIST-5.4 — Contadores para panel y fidelidad

Campos calculados o queries que alimentan el dashboard y el sistema de fidelidad.

**AC:**
- [ ] `total_recargas` por cliente (count)
- [ ] `ultima_recarga` por cliente (MAX fecha)
- [ ] `recargas_hoy` (count con fecha = today)
- [ ] `recargas_mes` (count con fecha en mes actual)
- [ ] Query eficiente (usar indices creados en EPIC-1)

### HIST-5.5 — Registro rapido desde la lista de clientes

Atajo: desde la lista de clientes, boton "Registrar recarga" que salta al paso 2.

**AC:**
- [ ] Boton en cada fila de la lista de clientes
- [ ] Click → va directo a seleccionar botellon (cliente ya elegido)
- [ ] Reduce el flujo de 3 taps a 2 taps

---

## Flujo de recarga

```
Lista clientes ──→ Buscar cliente ──→ Elegir botellon ──→ Confirmar ──→ Toast
     │                  │                    │                 │
     └─(atajo)──────────┘                    │                 │
                                             └── solo muestra  │
                                                los asignados  │
                                                al cliente     │
                                                      Premio? → Notificacion (EPIC-7)
```
