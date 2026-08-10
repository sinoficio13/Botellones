# EPIC-5 — Recargas

> **Estado**: 🟢 Completado  
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
- [x] Paso 1: Buscar cliente (input con autocompletado)
- [x] Paso 2: Seleccionar botellon del cliente (solo muestra los asignados a ese cliente)
- [x] Paso 3: Confirmar (muestra resumen: cliente, botellon)
- [x] Fecha y hora automaticas (sin input manual)
- [x] Usuario que registra asignado automaticamente
- [x] Feedback visual: toast de confirmacion
- [x] Boton "Registrar otra" para repetir el flujo

### HIST-5.2 — Historial de recargas por cliente

Tabla de recargas en ficha del cliente, filtrable.

**AC:**
- [x] Orden cronologico inverso
- [x] Columnas: fecha, hora, botellon
- [x] Filtro por rango de fechas
- [x] Total de recargas en el periodo

### HIST-5.3 — Historial de recargas por botellon

Tabla de recargas en ficha del botellon.

**AC:**
- [x] Orden cronologico inverso
- [x] Columnas: fecha, hora, cliente
- [x] Total de recargas del botellon

### HIST-5.4 — Contadores para panel y fidelidad

Campos calculados o queries que alimentan el dashboard y el sistema de fidelidad.

**AC:**
- [x] `total_recargas` por cliente (count)
- [x] `ultima_recarga` por cliente (MAX fecha)
- [x] `recargas_hoy` (count)
- [x] `recargas_mes` (count)
- [x] Query eficiente (usa indices EPIC-1)

### HIST-5.5 — Registro rapido desde la lista de clientes

Atajo: desde la lista de clientes, boton "Registrar recarga" que salta al paso 2.

**AC:**
- [x] Boton en cada fila de la lista de clientes
- [x] Click → va directo a seleccionar botellon
- [x] Reduce flujo de 3 a 2 taps

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
