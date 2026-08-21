# EPIC-4 — Gestion de Botellones + QR

> **Estado**: 🟢 Completado  
> **Historias**: 6  
> **Depende de**: [[01-DB-Auth|EPIC-1 — DB + Auth]]  
> **Siguiente**: [[05-Recargas|EPIC-5 — Recargas]]  
> **Archivado**: 11/08/2026 — implementado directo a `main` (sin cambio SDD dedicado)

---

## Descripcion

Cada botellon tiene codigo, estado, QR imprimible e historial publico via QR.

---

## Historias

### HIST-4.1 — CRUD de botellones

Crear, listar, editar y eliminar botellones (admin).

**AC:**
- [x] Formulario de creacion: codigo auto (BOT-XXXXX), estado inicial (recibido)
- [x] Lista paginada: codigo, estado, cliente asignado, fecha creacion, total recargas
- [x] Edicion: cambiar estado, reasignar cliente
- [x] Eliminacion logica (no borrar si tiene recargas)

### HIST-4.2 — Estados y transiciones

Sistema de estados del botellon con reglas de transicion validas.

**Estados**: entregado, recibido, recarga, listo, delivery

**Transiciones validas (ciclo puro de 5 estados):**
- entregado → recibido
- recibido → recarga
- recarga → listo
- listo → entregado, delivery
- delivery → entregado

**AC:**
- [x] Dropdown con solo transiciones validas

### HIST-4.3 — Asignar / desasignar a cliente

Vincular botellon a un cliente o dejarlo sin cliente (queda como stock en su estado actual).

**AC:**
- [x] Select de cliente con busqueda en formulario de botellon
- [x] Al asignar: estado cambia a "entregado"
- [x] Al desasignar: se limpia el cliente y el estado se mantiene

### HIST-4.4 — Generacion de QR

Al crear un botellon, se genera automaticamente un codigo QR que enlaza a su pagina publica.

**AC:**
- [x] QR generado con `qrcode.react` (SVG)
- [x] Enlace: `/b/BOT-XXXXX`
- [x] Boton "Descargar QR" que exporta el SVG
- [x] QR visible en ficha del botellon

### HIST-4.5 — Pagina publica del botellon

Pagina accesible sin login que muestra info basica del botellon al escanear el QR.

**AC:**
- [x] Ruta `/b/[codigo]` publica (sin autenticacion)
- [x] Muestra: codigo del botellon, total de recargas, ultima recarga (fecha)
- [x] NO muestra datos personales del cliente
- [x] Muestra logo del negocio (si esta configurado)

### HIST-4.6 — Vista de impresion de etiqueta

Pagina con formato de impresion para etiquetas fisicas con QR.

**AC:**
- [x] Ruta `/botellones/[id]/imprimir` con layout de impresion (sin header/sidebar)
- [x] Formato A4 con multiples etiquetas por hoja
- [x] Cada etiqueta: codigo, QR, nombre del cliente, logo del negocio
- [x] CSS `@media print` optimizado

---

## Estados del botellon

```
entregado ──→ recibido ──→ recarga ──→ listo ──→ entregado
                              │           │
                              │           └──→ delivery ──→ entregado
                              └───────────┘ (loop del ciclo)
```
