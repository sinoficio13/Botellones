# EPIC-3 — Gestión de Clientes

> **Estado**: ⬜ Pendiente  
> **Historias**: 8  
> **Depende de**: [[01-DB-Auth|EPIC-1]], [[02-Config-Negocio|EPIC-2]]  
> **Siguiente**: [[05-Recargas|EPIC-5]], [[08-Panel-Reportes|EPIC-8]], [[09-Busqueda-Mapa|EPIC-9]]

---

## Descripción

Ficha completa del cliente con datos, dirección, GPS, fotos, botellones asignados e historial. WhatsApp a un click.

---

## Historias

### HIST-3.1 — Formulario de nuevo cliente

Formulario completo con React Hook Form + Zod para crear cliente.

**Campos**: nombre (req), negocio, cedula, telefono_1 (req), telefono_2, whatsapp, tipo_cliente (casa/negocio/oficina/otro), horario_preferido (mañana/tarde/noche), dias_preferidos, contacto_preferido, observaciones

**AC:**
- [ ] Validación con Zod (nombre y teléfono requeridos)
- [ ] Código CL-XXXX asignado automáticamente
- [ ] Fecha de registro automática
- [ ] Redirección a ficha del cliente tras crear

### HIST-3.2 — Lista de clientes con WhatsApp

Tabla paginada de clientes con búsqueda y botón WhatsApp directo.

**AC:**
- [ ] Tabla: código, nombre, negocio, teléfono, tipo, última recarga, total recargas
- [ ] Paginación (server-side)
- [ ] Ordenamiento por nombre, fecha registro, total recargas
- [ ] Ícono WhatsApp en cada fila (`wa.me/XXXXXXXXX`)
- [ ] Link a ficha del cliente

### HIST-3.3 — Ficha del cliente — Tab: Datos

Pestaña con datos completos del cliente, editables.

**AC:**
- [ ] Página `/clientes/[id]` con tabs
- [ ] Tab "Datos" muestra todos los campos
- [ ] Botón "Editar" → formulario inline
- [ ] Guardar cambios con validación

### HIST-3.4 — Ficha del cliente — Tab: Dirección + Mapa

Pestaña con dirección escrita y mapa Leaflet con GPS. Parser de link de WhatsApp.

**AC:**
- [ ] Campos de dirección editables
- [ ] Campo para pegar link de ubicación de WhatsApp → parsea lat/lng → preview en mapa
- [ ] Mapa Leaflet con marcador
- [ ] Botón "Abrir en Google Maps" que deep-linkea a la app

### HIST-3.5 — Ficha del cliente — Tab: Fotos

Galería de fotos del cliente tomadas desde el celular o subidas.

**AC:**
- [ ] Upload con `capture="environment"` (abre cámara en mobile)
- [ ] Tipos de foto: fachada, entrada, referencia, adicional
- [ ] Galería con thumbnails (URLs firmadas de Supabase)
- [ ] Eliminar foto (admin)

### HIST-3.6 — Ficha del cliente — Tab: Botellones

Lista de botellones asignados al cliente con sus estados.

**AC:**
- [ ] Tabla: código, estado, fecha creación, total recargas
- [ ] Badge de color según estado (verde=disponible, azul=asignado, amarillo=recarga, gris=mantenimiento, rojo=dañado/perdido)
- [ ] Link a página del botellón

### HIST-3.7 — Ficha del cliente — Tab: Historial

Historial completo de recargas del cliente con filtro por fecha.

**AC:**
- [ ] Tabla cronológica: fecha, hora, botellón, repartidor
- [ ] Filtro por rango de fechas
- [ ] Total de recargas en el período seleccionado
- [ ] Paginación

### HIST-3.8 — Botón WhatsApp en todos lados

WhatsApp accesible desde lista, ficha, búsqueda y notificaciones.

**AC:**
- [ ] Ícono/botón WhatsApp visible en: lista de clientes, ficha del cliente, resultados de búsqueda, notificaciones que referencien al cliente
- [ ] Formato: `https://wa.me/CODIGO_PAIS+NUMERO` (ej: `https://wa.me/584141234567`)

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
