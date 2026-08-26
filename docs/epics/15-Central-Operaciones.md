# EPIC-15 — Central de Operaciones

> **Estado**: En ejecución — FASE 1 y FASE 2 completadas (changes `central-op-fase1-schema` y `central-op-fase2-tokens` archivados; PRs #2/#3 y #4/#5)  
> **Historias**: 15  
> **Depende de**: [[08-Panel-Reportes|EPIC-8 — Panel y Reportes]], [[04-Botellones-QR|EPIC-4 — Gestión de Botellones + QR]]  
> **Siguiente**: FASE 3 — Vista móvil (cola agrupada)  
> **Archivado**: FASE 1 → `central-op-fase1-schema` (26/08/2026); FASE 2 → `central-op-fase2-tokens` (26/08/2026)

---

## Descripcion

Rediseño total del dashboard de operaciones (`/dashboard`) como **Central de Operaciones**: una cola de trabajo agrupada **por cliente**, mobile-first, con FIFO estricto por antigüedad en el estado actual, selección por chips, acción de avance en un solo toque con deshacer, WhatsApp integrado, ficha del cliente en bottom sheet y realtime que no reordena bajo el dedo.

**Regla fundamental del negocio:** todos los botellones son propiedad de los clientes; el negocio solo los recarga. Un botellón tiene un dueño fijo que nunca cambia. **Entregar = confirmar devolución al dueño** (un solo toque, sin selector de cliente). Los botellones sin dueño (stock) se gestionan aparte y NO aparecen en la cola agrupada.

La unidad de trabajo es el **cliente**, no el botellón: un cliente devuelve 3 botellones → se recargan juntos → se devuelven juntos.

---

## Historias

## FASE 1 — Schema + tipos + data mock (sin UI)

> Objetivo: la base de datos soporta FIFO por estado y movimiento en lote transaccional. Sin UI.

### HIST-15.1.1 — Columna `estado_desde` + trigger de auditoría

**Descripción:** Agregar `estado_desde` a `botellones` (timestamptz NOT NULL default now()), backfill de datos existentes (entregado → `fecha_entrega`, resto → `created_at`) y trigger `trg_estado_desde` que resetea `estado_desde = now()` e inserta en `movimientos` cada vez que cambia `estado`. El FIFO depende de esto.

**AC:**
- [ ] Columna `estado_desde` existe con default `now()`
- [ ] Backfill aplicado: ningún botellón queda con `estado_desde` nulo o `now()` genérico
- [ ] Trigger inserta en `movimientos` (estado_previo, estado_nuevo, usuario_id) en cada cambio de estado
- [ ] El trigger NO inserta si el estado no cambia

### HIST-15.1.2 — Tabla `movimientos` (auditoría/historial)

**Descripción:** Tabla de auditoría de cambios de estado, alimentada por el trigger.

**AC:**
- [ ] Tabla `movimientos` con índice por `botellon_id`
- [ ] FK a `botellones` y `auth.users`
- [ ] RLS consistente con el resto del esquema (admin/repartidor)

### HIST-15.1.3 — RPC `mover_botellones(ids[], estado)` transaccional

**Descripción:** Función SQL `security definer` que mueve un lote de botellones a un estado en **una sola transacción** (nunca N llamadas), validando la máquina de estados existente (avance + reversión) y con guard de rol.

**AC:**
- [ ] Un `UPDATE ... WHERE id = ANY(p_ids) RETURNING *`
- [ ] Valida transiciones permitidas (rechaza saltos inválidos, cero escrituras)
- [ ] Guard de rol: solo admin/repartidor autenticado
- [ ] Devuelve los botellones actualizados

### HIST-15.1.4 — Tipos `GrupoCliente` + `agrupar()` + tests

**Descripción:** Tipo derivado que consume la UI y función pura de agrupación FIFO: agrupa por `cliente_id`, antigüedad = botellón más viejo del grupo, orden más antiguo primero, códigos ordenados dentro del grupo.

**AC:**
- [ ] `agrupar()` ordena grupos de más antiguo a más nuevo (FIFO estricto)
- [ ] Antigüedad del grupo = `min(estado_desde)` de sus botellones
- [ ] Dentro del grupo, códigos del más antiguo al más nuevo
- [ ] Tests unitarios cubren agrupación y ordenamiento

## FASE 2 — Tokens de diseño + primitivos

> Objetivo: sistema visual y primitivos reutilizables. Sin pantallas todavía.

### HIST-15.2.1 — Tokens de color (CSS vars, claro/oscuro)

**Descripción:** CSS variables `:root`/`.dark` para superficies, bordes, texto y colores semánticos de estado. Colores semánticos iguales en ambos modos. El botón de acción primaria es SIEMPRE `#0C7C92`; el color de estado vive en el tab y el punto, nunca en el fondo de la card.

**AC:**
- [ ] Vars `--surface-*`, `--border*`, `--text-*`, `--fill-disabled`, `--text-disabled` en `:root` y `.dark`
- [ ] Semánticos: recibido `#64748B`, recarga `#0C7C92`, listo `#1A9150`, delivery `#DB9A2E`, entregado `#6D42C7`, urgencia `#B07515`, WhatsApp `#1A9150`
- [ ] Ningún hex hardcodeado en componentes (solo vars)

### HIST-15.2.2 — Primitivos: Chip, botón acción, toast con Deshacer, skeleton, vacíos

**Descripción:** Componentes base: `Chip` de código (button `aria-pressed`), botón de acción primaria (44px, `#0C7C92`, texto por estado), toast con "Deshacer" (4.5s, aria-live polite), skeleton shimmer, y componentes de estado vacío.

**AC:**
- [ ] Chip es `<button>` con `aria-pressed`, ~32px alto, monoespaciado
- [ ] Botón acción ≥44px, color `#0C7C92` en los 4 estados
- [ ] Toast único, 4.5s, posición inferior, con acción "Deshacer" (excepto error)
- [ ] Skeleton shimmer 1.5s loop (nunca spinner)
- [ ] Vacíos con ícono `CircleDashed`, título, descripción y acción por estado

## FASE 3 — Vista móvil (cola agrupada)

> Objetivo: el 80% del valor — la cola operativa en el celular.

### HIST-15.3.1 — Tabs de estados + barra de contexto

**Descripción:** Tabs de los 4 estados (role=tablist, sticky, subrayado 2px color estado, contador en vivo) y barra de contexto ("N clientes · N botellones · más antiguo arriba").

**AC:**
- [ ] Tabs con `role="tablist"`/`role="tab"` y `aria-selected`
- [ ] Subrayado 2px con el color del estado activo
- [ ] Contadores se actualizan en tiempo real
- [ ] Barra de contexto con totales

### HIST-15.3.2 — Card de grupo cliente con chips de selección

**Descripción:** Card por cliente: bloque nombre+cédula (target → ficha), ícono WhatsApp (target aparte), chips de código con `aria-pressed` (todos marcados por defecto, toggle individual, `+N` si >6), antigüedad con 2 niveles de urgencia (`▲` + fondo ámbar 7% si >24h), botón primario que refleja la selección.

**AC:**
- [ ] Chips vienen todos marcados; destildar actualiza el contador al instante
- [ ] Con 0 marcados: botón deshabilitado, "Elegí al menos un botellón"
- [ ] >6 botellones: 6 chips + chip `+N` que expande
- [ ] Urgencia: <6h normal, 6-24h ámbar `#B07515`, >24h `▲` + fondo ámbar 7%
- [ ] 3 targets táctiles independientes (ficha, WhatsApp, chips), todos ≥44px

### HIST-15.3.3 — Acción de avance + entrega + deshacer

**Descripción:** Botón primario por estado (`→ Pasar N a En recarga` / `→ Pasar N a Listo` / `→ Pasar N a En delivery` / `✓ Entregar N a {PrimerNombre}`). Optimistic update → toast con Deshacer → RPC `mover_botellones`. Deshacer revierte estado y `estado_desde`. **Entregar NO abre selector de cliente.**

**AC:**
- [ ] Entregar no abre ningún selector de cliente (confirmar devolución en 1 toque)
- [ ] Botón siempre `#0C7C92` en los 4 estados
- [ ] Optimistic update: los botellones desaparecen de la lista al instante
- [ ] Toast "Deshacer" 4.5s; Deshacer revierte estado y `estado_desde` original
- [ ] Error: revert + toast rojo "No se pudo mover. Reintentá." (sin deshacer)

### HIST-15.3.4 — Buscador

**Descripción:** Input que busca en paralelo por nombre de cliente (ilike), cédula normalizada y código de botellón. Debounce 250ms, mínimo 2 caracteres, resultados agrupados por tipo.

**AC:**
- [ ] Búsqueda por nombre, cédula (sin puntos/guiones) y código
- [ ] Debounce 250ms; no busca con <2 caracteres
- [ ] Resultados agrupados por tipo

### HIST-15.3.5 — Reemplazo del dashboard + estados vacíos/carga

**Descripción:** La nueva Central reemplaza `operaciones-dashboard.tsx` en `/dashboard`. Carga con skeleton (nunca spinner). Estados vacíos por tab con copy y acción propios; vacío total de primer uso con [Escanear]/[Cargar manual].

**AC:**
- [ ] `/dashboard` renderiza la nueva cola agrupada (móvil y tablet en grilla 2 col)
- [ ] Skeleton en carga; nunca spinner
- [ ] 4 estados vacíos con copy y acción propios
- [ ] Vacío total (primer uso) con [📷 Escanear] y [Cargar manual]
- [ ] Funciona en 375px sin scroll horizontal

## FASE 4 — Vista desktop (kanban agrupado)

> Objetivo: misma cola, 4 columnas, en pantallas ≥1024px.

### HIST-15.4.1 — Kanban de 4 columnas agrupadas

**Descripción:** 4 columnas (Recibido/Recarga/Listo/Delivery) con encabezado color estado + contador + subtítulo, cards de grupo, códigos en línea separados por `·` (no chips), botón que actúa sobre TODO el grupo, placeholder de columna vacía (borde punteado, min 120px).

**AC:**
- [ ] Códigos en una línea separados por `·`
- [ ] Botón actúa sobre todo el grupo (sin selección parcial en desktop)
- [ ] Columna vacía con placeholder de borde punteado que mantiene la grilla

### HIST-15.4.2 — Drag & drop nativo

**Descripción:** Arrastrar la card de grupo completa a otra columna. Solo desktop. Implementación con drag & drop HTML5 nativo (patrón del dashboard actual), sin `@dnd-kit`.

**AC:**
- [ ] Drag de card de grupo a columna destino mueve todos los botellones del grupo
- [ ] Solo ≥1024px; sin drag en móvil/tablet
- [ ] Si el drop es inválido, no escribe nada y muestra toast de error

## FASE 5 — Realtime + WhatsApp + ficha cliente

> Objetivo: operación multi-dispositivo segura y comunicación con el cliente.

### HIST-15.5.1 — Realtime con cola + chip flotante

**Descripción:** Suscripción `postgres_changes` a `botellones`. Si el usuario scrollea o el cambio reordena la lista, NO reordenar bajo el dedo: encolar y mostrar chip flotante ("↑ N botellones nuevos", tap = aplicar). Contadores de tabs siempre en vivo. Cards nuevas con outline `#0C7C92` 1.2s que se desvanece.

**AC:**
- [ ] Cambio realtime mientras se scrollea NO reordena bajo el dedo
- [ ] Chip flotante sticky bajo los tabs con conteo; tap aplica la cola
- [ ] Contadores de tabs siempre en tiempo real
- [ ] Animación de entrada: outline 2px `#0C7C92` 1.2s, luego fade; sin slide

### HIST-15.5.2 — Sheet de WhatsApp

**Descripción:** Bottom sheet con mensaje pre-cargado según el estado actual (texto de la spec), editable, nota "Tocá para editar antes de enviar", botón verde `#1A9150` "Abrir WhatsApp" (deep link `wa.me`), Cancelar. Ícono deshabilitado (opacidad 40%) si el cliente no tiene teléfono → toast explicativo.

**AC:**
- [ ] Mensaje cambia según el tab/estado activo
- [ ] Campo editable antes de enviar
- [ ] Deep link `https://wa.me/<digitos>?text=<encode>` abre en nueva pestaña
- [ ] Cliente sin teléfono: ícono deshabilitado + toast "Este cliente no tiene teléfono cargado"
- [ ] NO hay envío automático al cambiar de estado

### HIST-15.5.3 — Ficha del cliente (bottom sheet)

**Descripción:** Tap en nombre+cédula → sheet con datos del cliente (nombre, cédula, dirección), 3 acciones (WhatsApp, Llamar `tel:`, Ficha → `/clientes/[id]`) y lista de botellones de TODOS los estados (incluye `entregado`) con antigüedad. Atrapa foco y cierra con Escape.

**AC:**
- [ ] Lista muestra botellones de todos los estados, incl. entregado
- [ ] "Llamar" usa `tel:` con el teléfono del cliente
- [ ] "Ficha" navega a `/clientes/[id]`
- [ ] Sheet atrapa foco, cierra con Escape
- [ ] Tocar nombre o cédula abre la ficha

---

## Notas

- **Fuera de alcance (spec §9):** sección "Necesita tu atención", sección "En circulación", KPIs en móvil, selector "Asignar a cliente" en entrega, modo lote aparte, drag en móvil/tablet, envío automático de WhatsApp, tercer nivel de urgencia, color de estado como fondo de card.
- **Decisiones abiertas postergadas (spec §12):** reasignación de dueño ("Cambiar dueño" en detalle del botellón), cédula obligatoria para facturación, escaneo QR como punto de entrada — se evalúan en fases futuras, no en este epic.
- **Adaptaciones sobre el proyecto existente:** códigos `BOT-XXXXX` (no `B-014`), `whatsapp`/`telefono_1` en `clientes` (no `telefono`), dirección en tabla `direcciones` (no columna), estados como text+CHECK (no enum). `cliente_id` sigue nullable: los botellones stock no entran a la cola agrupada.
- Los criterios de aceptación globales de la spec §11 se verifican al cerrar cada change SDD de fase.