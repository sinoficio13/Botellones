# EPIC-3 — Gestión de Clientes

> **Estado**: 🟢 Completado  
> **Historias**: 8  
> **Depende de**: [[01-DB-Auth|EPIC-1]], [[02-Config-Negocio|EPIC-2]]  
> **Siguiente**: [[05-Recargas|EPIC-5]], [[08-Panel-Reportes|EPIC-8]], [[09-Busqueda-Mapa|EPIC-9]]  
> **Archivado**: 11/08/2026 — implementado directo a `main` (sin cambio SDD dedicado)

---

## Descripción

Ficha completa del cliente con datos, dirección, GPS, fotos, botellones asignados e historial. WhatsApp a un click.

---

## Historias

### HIST-3.1 — Formulario de nuevo cliente

Formulario completo con React Hook Form + Zod para crear cliente.

**Campos**: nombre (req), negocio, cedula, telefono_1 (req), telefono_2, whatsapp, tipo_cliente (casa/negocio/oficina/otro), horario_preferido (mañana/tarde/noche), dias_preferidos, contacto_preferido, observaciones

**AC:**
- [x] Validación con Zod (nombre y teléfono requeridos)
- [x] Código CL-XXXX asignado automáticamente
- [x] Fecha de registro automática
- [x] Redirección a ficha del cliente tras crear

### HIST-3.2 — Lista de clientes con WhatsApp

Tabla paginada de clientes con búsqueda y botón WhatsApp directo.

**AC:**
- [x] Tabla: código, nombre, negocio, teléfono, tipo, última recarga, total recargas
- [x] Paginación (server-side)
- [x] Ordenamiento por nombre, fecha registro, total recargas
- [x] Ícono WhatsApp en cada fila (`wa.me/XXXXXXXXX`)
- [x] Link a ficha del cliente

### HIST-3.3 — Ficha del cliente — Tab: Datos

Pestaña con datos completos del cliente, editables.

**AC:**
- [x] Página `/clientes/[id]` con tabs
- [x] Tab "Datos" muestra todos los campos
- [x] Botón "Editar" → formulario inline
- [x] Guardar cambios con validación

### HIST-3.4 — Ficha del cliente — Tab: Dirección + Mapa

Pestaña con dirección escrita y mapa Leaflet con GPS. Parser de link de WhatsApp.

**AC:**
- [x] Campos de dirección editables
- [x] Campo para pegar link de ubicación de WhatsApp → parsea lat/lng → preview en mapa
- [x] Mapa Leaflet con marcador
- [x] Botón "Abrir en Google Maps" que deep-linkea a la app

### HIST-3.5 — Ficha del cliente — Tab: Fotos

Galería de fotos del cliente tomadas desde el celular o subidas.

**AC:**
- [x] Upload con `capture="environment"` (abre cámara en mobile)
- [x] Tipos de foto: fachada, entrada, referencia, adicional
- [x] Galería con thumbnails (URLs firmadas de Supabase)
- [x] Eliminar foto (admin)

### HIST-3.6 — Ficha del cliente — Tab: Botellones

Lista de botellones asignados al cliente con sus estados.

**AC:**
- [x] Tabla: código, estado, fecha creación, total recargas
- [x] Badge de color según estado (morado=entregado, gris=recibido, cian=en recarga, verde=listo, ámbar=en delivery)
- [ ] Link a página del botellón (EPIC-4)

### HIST-3.7 — Ficha del cliente — Tab: Historial

Historial completo de recargas del cliente con filtro por fecha.

**AC:**
- [x] Tabla cronológica: fecha, hora, botellón, repartidor
- [ ] Filtro por rango de fechas (próxima iteración)
- [x] Total de recargas en el período seleccionado
- [x] Paginación (últimas 50)

### HIST-3.8 — Botón WhatsApp en todos lados

WhatsApp accesible desde lista, ficha, búsqueda y notificaciones.

**AC:**
- [x] Ícono/botón WhatsApp visible en: lista de clientes, ficha del cliente
- [ ] resultados de búsqueda, notificaciones (próximos epics)
- [x] Formato: `https://wa.me/CODIGO_PAIS+NUMERO`

---

## Estructura de la ficha

```
/clientes/[id]
  ├── Tab: Datos        (HIST-3.3)
  ├── Tab: Dirección    (HIST-3.4) — mapa Leaflet + GPS
  ├── Tab: Fotos        (HIST-3.5) — galería + upload
  ├── Tab: Botellones   (HIST-3.6) — asignados al cliente
  └── Tab: Historial    (HIST-3.7) — recargas cronológicas
```
