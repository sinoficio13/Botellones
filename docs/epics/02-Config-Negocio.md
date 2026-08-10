# EPIC-2 — Configuración del Negocio

> **Estado**: 🟢 Completado  
> **Historias**: 3  
> **Depende de**: [[01-DB-Auth|EPIC-1 — DB + Auth]]  
> **Siguiente**: [[03-Clientes|EPIC-3 — Clientes]]

---

## Descripción

El dueño sube su logo, nombre y datos. El sistema lo refleja en header, PDFs y etiquetas.

**Especificación del logo**: SVG 400×100, transparente, horizontal, max 200KB.

---

## Historias

### HIST-2.1 — Página de configuración (admin)

Formulario para que el admin configure nombre, logo, teléfono, dirección y email del negocio.

**AC:**
- [x] Ruta `/configuracion` accesible solo por admin
- [x] Formulario con campos: nombre_negocio, telefono, direccion, email
- [x] Guardado en tabla `configuracion` (upsert en single row)

### HIST-2.2 — Upload de logo con vista previa

Upload de logo con validación y preview en 3 contextos (header, PDF, etiqueta).

**AC:**
- [x] Acepta solo SVG y PNG
- [x] Valida peso máximo (200 KB SVG, 500 KB PNG)
- [x] Valida dimensiones mínimas para PNG
- [x] Vista previa en vivo: header, reporte PDF, etiqueta QR
- [x] Advertencia si la relación de aspecto no es horizontal (no bloquea)
- [x] Upload a bucket `logos` en Supabase Storage (dev: data URL)

### HIST-2.3 — Header con logo y nombre

Componente Header que muestra el logo (o fallback de texto) y el nombre del negocio en toda la app.

**AC:**
- [x] Si hay logo → lo muestra (32-40px alto)
- [x] Si no hay logo → muestra nombre del negocio con ícono genérico
- [x] Visible en todas las páginas autenticadas
- [x] Responsive: en mobile se adapta sin romper layout

---

## Notas técnicas

- Tabla `configuracion` es single-row (id=1 siempre)
- Bucket `logos` configurado en EPIC-1 (HIST-1.4)
- El logo se usa en: header, PDFs (EPIC-10), etiquetas QR (EPIC-4)
