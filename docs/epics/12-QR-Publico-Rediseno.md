# EPIC-12 — QR Publico Rediseñado

> **Estado**: ⏳ Pendiente
> **Historias**: 4
> **Depende de**: [[04-Botellones-QR|EPIC-4 — Botellones + QR]]
> **Siguiente**: [[13-Recarga-Rapida-QR|EPIC-13 — Recarga Rapida desde QR]]

---

## Descripcion

Rediseñar la pagina publica `/b/[codigo]` (la que ve el cliente al escanear el QR del botellon) con la paleta "Agua" y la identidad completa del negocio. El QR no cambia (sigue codificando `/b/{codigo}`), solo cambia el aspecto y la info que muestra.

**Paleta "Agua"** (guardada en memoria):
- Gradiente header: `linear-gradient(135deg, #0c4a6e 0%, #0e7490 45%, #06b6d4 100%)`
- Primary `#0e7490`, accent `#06b6d4`, WhatsApp verde `#15803d` sobre `#f0fdf4`
- Texto `#0f172a`, muted `#64748b`, fondo `#f1f5f9`, borde `#cbd5e1`

---

## Historias

### HIST-12.1 — Rediseñar la pagina publica con la paleta "Agua"

Aplicar el nuevo estilo visual (gradiente, colores cyan, tipografia) a `/b/[codigo]`, reemplazando el estilo zinc/azul actual.

**AC:**
- [ ] Header con gradiente `#0c4a6e → #06b6d4`
- [ ] Tipografia system-ui, titulo font-weight 800 letter-spacing -0.02em
- [ ] Tarjeta principal con borde `#cbd5e1` y sombra `rgba(2,132,199,0.14)`
- [ ] Responsive mobile-first (max-w-sm centrado)

### HIST-12.2 — Mostrar identidad del negocio

Mostrar logo, nombre y eslogan del negocio (desde `getConfiguracion()`).

**AC:**
- [ ] Logo del negocio visible (si esta configurado)
- [ ] Nombre del negocio visible
- [ ] Eslogan visible (si esta configurado)
- [ ] Fallback sin logo (icono generico)

### HIST-12.3 — Mostrar resumen del botellon

Mostrar el estado, total de recargas y ultima recarga del botellon.

**AC:**
- [ ] Codigo del botellon visible (mono)
- [ ] Estado con badge de color
- [ ] Total de recargas
- [ ] Ultima recarga (fecha)
- [ ] NO muestra datos personales del cliente (nombre, telefono, direccion)

### HIST-12.4 — Boton de contacto WhatsApp del negocio

Agregar un boton/botonera de WhatsApp con el telefono del negocio.

**AC:**
- [ ] Boton visible solo si `telefono` esta configurado
- [ ] Formato: `https://wa.me/CODIGO+NUMERO`
- [ ] Estilo verde WhatsApp (`#15803d` sobre `#f0fdf4`)
- [ ] Icono de WhatsApp reconocible

---

## Notas

- El QR en si NO cambia: no hay que reimprimir etiquetas existentes.
- La info del negocio sale de la tabla `configuracion` (nombre_negocio, logo_url, eslogan, telefono).
