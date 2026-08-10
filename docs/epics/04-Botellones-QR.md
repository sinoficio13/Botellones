# EPIC-4 — Gestion de Botellones + QR

> **Estado**: Pendiente  
> **Historias**: 6  
> **Depende de**: [[01-DB-Auth|EPIC-1 — DB + Auth]]  
> **Siguiente**: [[05-Recargas|EPIC-5 — Recargas]]

---

## Descripcion

Cada botellon tiene codigo, estado, QR imprimible e historial publico via QR.

---

## Historias

### HIST-4.1 — CRUD de botellones

Crear, listar, editar y eliminar botellones (admin).

**AC:**
- [ ] Formulario de creacion: codigo auto (BOT-XXXXX), estado inicial (disponible)
- [ ] Lista paginada: codigo, estado, cliente asignado, fecha creacion, total recargas
- [ ] Edicion: cambiar estado, reasignar cliente
- [ ] Eliminacion logica (no borrar si tiene recargas)

### HIST-4.2 — Estados y transiciones

Sistema de estados del botellon con reglas de transicion validas.

**Estados**: disponible, asignado, en_recarga, mantenimiento, danado, perdido

**Transiciones validas:**
- disponible → asignado, mantenimiento, danado, perdido
- asignado → en_recarga, disponible, perdido
- en_recarga → asignado, disponible, mantenimiento
- mantenimiento → disponible, danado
- danado → (terminal)
- perdido → disponible (si se recupera)

**AC:**
- [ ] Dropdown con solo transiciones validas

### HIST-4.3 — Asignar / desasignar a cliente

Vincular botellon a un cliente o liberarlo a planta.

**AC:**
- [ ] Select de cliente con busqueda en formulario de botellon
- [ ] Al asignar: estado cambia a "asignado"
- [ ] Al desasignar: estado cambia a "disponible"
- [ ] No se puede asignar un botellon danado o perdido

### HIST-4.4 — Generacion de QR

Al crear un botellon, se genera automaticamente un codigo QR que enlaza a su pagina publica.

**AC:**
- [ ] QR generado con `qrcode.react` (SVG)
- [ ] Enlace: `/b/BOT-XXXXX`
- [ ] Boton "Descargar QR" que exporta el SVG
- [ ] QR visible en ficha del botellon

### HIST-4.5 — Pagina publica del botellon

Pagina accesible sin login que muestra info basica del botellon al escanear el QR.

**AC:**
- [ ] Ruta `/b/[codigo]` publica (sin autenticacion)
- [ ] Muestra: codigo del botellon, total de recargas, ultima recarga (fecha)
- [ ] NO muestra datos personales del cliente
- [ ] Muestra logo del negocio (si esta configurado)

### HIST-4.6 — Vista de impresion de etiqueta

Pagina con formato de impresion para etiquetas fisicas con QR.

**AC:**
- [ ] Ruta `/botellones/[id]/imprimir` con layout de impresion (sin header/sidebar)
- [ ] Formato A4 con multiples etiquetas por hoja
- [ ] Cada etiqueta: codigo, QR, nombre del cliente, logo del negocio
- [ ] CSS `@media print` optimizado

---

## Estados del botellon

```
disponible ──→ asignado ──→ en_recarga ──→ asignado
    │              │              │
    ├── mantenim.   ├── perdido    ├── mantenim.
    ├── danado      └── disponible └── disponible
    └── perdido

mantenimiento ──→ disponible
              └──→ danado

danado → (terminal)
perdido → disponible (recuperado)
```
