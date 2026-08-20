# Epics — Sistema de Gestión de Botellones de Agua

> Versión: 1.0 — 10/08/2026
> Stack: Next.js App Router + TypeScript + Tailwind + shadcn/ui + Supabase (PWA)

---

## Resumen de Epics

| Epic    | Nombre                     | Historias | Depende de                             | Estado     |
| ------- | -------------------------- | --------- | -------------------------------------- | ---------- |
| EPIC-0  | Fundación                  | 5         | —                                      | Completado |
| EPIC-1  | Base de Datos y Auth       | 7         | EPIC-0                                 | Completado |
| EPIC-2  | Configuración del Negocio  | 3         | EPIC-1                                 | Completado |
| EPIC-3  | Gestión de Clientes        | 8         | EPIC-1, EPIC-2                         | Completado |
| EPIC-4  | Gestión de Botellones + QR | 6         | EPIC-1                                 | Completado |
| EPIC-5  | Recargas                   | 5         | EPIC-3, EPIC-4                         | Completado |
| EPIC-6  | Sistema de Fidelidad       | 4         | EPIC-5                                 | Completado |
| EPIC-7  | Notificaciones             | 4         | EPIC-1                                 | Completado |
| EPIC-8  | Panel y Reportes           | 6         | EPIC-3, EPIC-4, EPIC-5, EPIC-6, EPIC-7 | Completado |
| EPIC-9  | Búsqueda y Mapa General    | 3         | EPIC-3                                 | Completado |
| EPIC-10 | PDF y Excel                | 3         | EPIC-8, EPIC-9                         | Completado |
| EPIC-11 | Pulido PWA y Seguridad     | 3         | Todos                                  | Completado |
| EPIC-12 | QR Público Rediseñado      | 4         | EPIC-4                                 | Completado |
| EPIC-13 | Recarga Rápida desde QR    | 4         | EPIC-12                                | Completado |
| EPIC-14 | Scanner Interno con Cámara  | 2         | EPIC-13 (opcional)                     | Completado |

---

## Estado de ejecución

Los 15 epics están implementados en código y archivados como cambios SDD en Engram (los de Fase 1, EPIC-0..11, se completaron directo a `main`; los de Fase 2, EPIC-12..14, como cambios SDD dedicados). El detalle completo de cada historias/AC sigue en las secciones de cada epic, que son la referencia de especificación.

| Epic | Archivado | Cambio SDD (Engram) |
|---|---|---|
| EPIC-0 Fundación | 10/08/2026 | — |
| EPIC-1 DB + Auth | 10/08/2026 | — |
| EPIC-2 Config Negocio | 11/08/2026 | — |
| EPIC-3 Clientes | 11/08/2026 | — |
| EPIC-4 Botellones + QR | 11/08/2026 | — |
| EPIC-5 Recargas | 11/08/2026 | — |
| EPIC-6 Fidelidad | 11/08/2026 | `sdd/EPIC-6-fidelidad` |
| EPIC-7 Notificaciones | 11/08/2026 | `sdd/EPIC-7-notificaciones` |
| EPIC-8 Panel y Reportes | 11/08/2026 | `sdd/EPIC-8-panel-reportes` |
| EPIC-9 Búsqueda y Mapa | 11/08/2026 | `sdd/EPIC-9-busqueda-mapa` |
| EPIC-10 PDF y Excel | 11/08/2026 | `sdd/EPIC-10-pdf-excel` |
| EPIC-11 Pulido PWA | 11/08/2026 | `sdd/EPIC-11-pulido-pwa` |
| EPIC-12 QR Público Rediseñado | 17/08/2026 | `sdd/qr-publico-rediseno` |
| EPIC-13 Recarga Rápida desde QR | 18/08/2026 | `sdd/qr-recarga-rapida` |
| EPIC-14 Scanner Interno | 19/08/2026 | `sdd/scanner-interno` |

> Nota: EPIC-14 estaba marcado como "opcional" en el plan, pero se implementó igualmente.

### Cambios SDD adicionales (más allá de los 15 epics)

| Cambio | Estado | Descripción |
|---|---|---|
| `navegacion-movil` | Completado | Barra de navegación inferior móvil + FAB de scanner + PWA instalable |
| `qa-code-cleanup` | Completado | Limpieza de código y convenciones QA (archivado en `openspec/changes/archive/2026-08-18-qa-code-cleanup/`) |
| `carga-botellones` | Completado | Carga por lote de botellones vía QR (archivado en `openspec/changes/archive/2026-08-20-carga-botellones/`) |

---

## EPIC-0 — Fundación

> Sin esto no existe nada. Setup inicial, proyecto funcional vacío.

**Depende de:** Nada
**Responsable:** Desarrollador

### HIST-0.1 — Crear proyecto en Supabase

**Descripción:** Crear organización, proyecto Postgres y bucket de Storage en Supabase. Obtener API keys.

**Acceptance Criteria:**
- [ ] Proyecto Supabase activo con URL y anon/publishable key
- [ ] Bucket `fotos-clientes` creado (privado)
- [ ] Bucket `logos` creado (privado)

### HIST-0.2 — Scaffold Next.js

**Descripción:** Crear proyecto Next.js App Router con TypeScript, Tailwind, shadcn/ui y lucide-react.

**Acceptance Criteria:**
- [ ] `npm run dev` funciona en localhost:3000
- [ ] Tailwind configurado con tema base
- [ ] shadcn/ui instalado con al menos Button, Input, Card, Table, Dialog, DropdownMenu
- [ ] lucide-react instalado

### HIST-0.3 — Configurar cliente Supabase

**Descripción:** Crear cliente Supabase en el frontend y probar conexión a la DB.

**Acceptance Criteria:**
- [ ] Archivo `lib/supabase/client.ts` con cliente browser
- [ ] Archivo `lib/supabase/server.ts` con cliente server
- [ ] Variables de entorno cargadas desde `.env.local`
- [ ] Query de prueba exitosa contra la DB

### HIST-0.4 — PWA manifest + service worker

**Descripción:** Configurar manifiesto y service worker para instalación desde navegador móvil.

**Acceptance Criteria:**
- [ ] `manifest.json` con nombre, íconos, theme_color
- [ ] Service worker registrado
- [ ] "Instalar app" funcional desde Chrome Android

### HIST-0.5 — ESLint + Prettier + estructura de carpetas

**Descripción:** Configurar linter, formateador y estructura base del proyecto.

**Acceptance Criteria:**
- [ ] ESLint configurado con reglas TypeScript
- [ ] Prettier configurado
- [ ] Estructura de carpetas definida:

```
src/
├── app/                    # App Router pages
│   ├── (auth)/            # Login
│   ├── (dashboard)/       # Rutas protegidas
│   │   ├── clientes/
│   │   ├── botellones/
│   │   ├── recargas/
│   │   ├── reportes/
│   │   └── configuracion/
│   └── b/[codigo]/        # Página pública QR
├── components/
│   ├── ui/                # shadcn/ui
│   ├── clientes/
│   ├── botellones/
│   ├── recargas/
│   ├── fidelidad/
│   ├── notificaciones/
│   ├── reportes/
│   └── shared/            # Header, Sidebar, etc.
├── lib/
│   ├── supabase/          # Clientes
│   ├── db/                # Queries tipadas
│   ├── utils/             # Helpers
│   └── validators/        # Schemas Zod
├── hooks/                 # Custom hooks
└── types/                 # Tipos TypeScript
```

---

## EPIC-1 — Base de Datos y Autenticación

> Las tablas existen, los usuarios entran con su rol y los datos están protegidos por RLS.

**Depende de:** EPIC-0
**Responsable:** Desarrollador

### HIST-1.1 — Migración SQL completa

**Descripción:** Crear migración en Supabase con todas las tablas del sistema.

**Tablas:**
- `perfiles` — id (FK auth.users), nombre, telefono
- `clientes` — codigo, nombre, negocio, cedula, telefono_1, telefono_2, whatsapp, tipo_cliente, horario_preferido, dias_preferidos, contacto_preferido, observaciones, fecha_registro
- `direcciones` — cliente_id, calle, avenida, sector, urbanizacion, ciudad, estado, referencia, latitud, longitud, link_mapa, gps_origen
- `fotos_clientes` — cliente_id, tipo (fachada/entrada/referencia/adicional), ruta_storage, descripcion
- `botellones` — codigo, fecha_creacion, estado, cliente_id
- `recargas` — numero_registro, cliente_id, botellon_id, fecha, hora, realizada_por, observaciones
- `premios` — cliente_id, nivel_recargas, fecha_alcanzado, estado, tipo_premio, entregado_por, observaciones
- `configuracion` — id (single row), nombre_negocio, logo_url, telefono, direccion, email
- `notificaciones` — usuario_id, tipo, titulo, mensaje, cliente_id, botellon_id, leida, creada_en

**Acceptance Criteria:**
- [ ] Todas las tablas creadas con tipos correctos
- [ ] Foreign keys definidas
- [ ] Índices creados (clientes.nombre, clientes.telefono, recargas.cliente_id, recargas.fecha, notificaciones.usuario_id)

### HIST-1.2 — Secuencias para códigos

**Descripción:** Crear secuencias Postgres para generación de códigos únicos (CL-0001, BOT-00001).

**Acceptance Criteria:**
- [ ] Secuencia `cliente_codigo_seq` → formato `CL-XXXX`
- [ ] Secuencia `botellon_codigo_seq` → formato `BOT-XXXXX`
- [ ] Concurrent-safe (usar `nextval` en transacción)

### HIST-1.3 — RLS policies

**Descripción:** Activar Row Level Security en todas las tablas con políticas por rol.

**Acceptance Criteria:**
- [ ] Admin: SELECT, INSERT, UPDATE, DELETE en todas las tablas
- [ ] Repartidor: SELECT en todas las tablas, INSERT en recargas, clientes, fotos_clientes
- [ ] Repartidor NO puede UPDATE ni DELETE salvo sus propias recargas del día
- [ ] Política pública: SELECT en botellones (solo código, total_recargas, última recarga) para página QR

### HIST-1.4 — Buckets de Storage

**Descripción:** Configurar buckets privados con políticas de acceso.

**Acceptance Criteria:**
- [ ] Bucket `fotos-clientes`: solo usuarios autenticados pueden leer/escribir
- [ ] Bucket `logos`: solo admin puede escribir, todos autenticados pueden leer
- [ ] URLs firmadas para acceso temporal a archivos

### HIST-1.5 — Login page

**Descripción:** Página de login con email/contraseña usando Supabase Auth.

**Acceptance Criteria:**
- [ ] Formulario con validación (email requerido, contraseña min 6 chars)
- [ ] Mensaje de error claro si credenciales inválidas
- [ ] Redirección al dashboard tras login exitoso
- [ ] Responsive mobile-first

### HIST-1.6 — Middleware y roles

**Descripción:** Middleware de Next.js que protege rutas y redirige según rol.

**Acceptance Criteria:**
- [ ] Rutas bajo `/(dashboard)` requieren sesión
- [ ] Rutas de admin (`/configuracion`) solo accesibles con rol admin
- [ ] Usuario sin sesión → redirigido a `/login`
- [ ] Repartidor intentando acceder ruta admin → redirigido a dashboard

### HIST-1.7 — Seed de admin inicial

**Descripción:** Script SQL que crea el primer usuario administrador.

**Acceptance Criteria:**
- [ ] Usuario admin creado en `auth.users`
- [ ] Perfil creado con rol `admin` en `app_metadata`
- [ ] Email y contraseña definidos (usar variables de entorno o placeholder seguro)

---

## EPIC-2 — Configuración del Negocio

> El dueño sube su logo (SVG horizontal 400×100, transparente, max 200KB), nombre y datos. El sistema lo refleja en header, PDFs y etiquetas.

**Depende de:** EPIC-1
**Responsable:** Desarrollador

### HIST-2.1 — Página de configuración (admin)

**Descripción:** Formulario para que el admin configure nombre, logo, teléfono, dirección y email del negocio.

**Acceptance Criteria:**
- [ ] Ruta `/configuracion` accesible solo por admin
- [ ] Formulario con campos: nombre_negocio, telefono, direccion, email
- [ ] Guardado en tabla `configuracion` (upsert en single row)

### HIST-2.2 — Upload de logo con vista previa

**Descripción:** Upload de logo con validación y preview en 3 contextos (header, PDF, etiqueta).

**Acceptance Criteria:**
- [ ] Acepta solo SVG y PNG
- [ ] Valida peso máximo (200 KB SVG, 500 KB PNG)
- [ ] Valida dimensiones mínimas para PNG
- [ ] Vista previa en vivo: header, reporte PDF, etiqueta QR
- [ ] Advertencia si la relación de aspecto no es horizontal (pero no bloquea)
- [ ] Upload a bucket `logos` en Supabase Storage

### HIST-2.3 — Header con logo y nombre

**Descripción:** Componente Header que muestra el logo (o fallback de texto) y el nombre del negocio en toda la app.

**Acceptance Criteria:**
- [ ] Si hay logo → lo muestra (32-40px alto)
- [ ] Si no hay logo → muestra nombre del negocio con ícono genérico
- [ ] Visible en todas las páginas autenticadas
- [ ] Responsive: en mobile se adapta sin romper layout

---

## EPIC-3 — Gestión de Clientes

> Ficha completa del cliente con datos, dirección, GPS, fotos, botellones asignados e historial. WhatsApp a un click.

**Depende de:** EPIC-1, EPIC-2
**Responsable:** Desarrollador

### HIST-3.1 — Formulario de nuevo cliente

**Descripción:** Formulario completo con React Hook Form + Zod para crear cliente.

**Campos:**
- nombre (requerido)
- negocio
- cedula
- telefono_1 (requerido)
- telefono_2
- whatsapp
- tipo_cliente (casa / negocio / oficina / otro)
- horario_preferido (mañana / tarde / noche)
- dias_preferidos
- contacto_preferido
- observaciones

**Acceptance Criteria:**
- [ ] Validación con Zod (nombre y teléfono requeridos)
- [ ] Código CL-XXXX asignado automáticamente
- [ ] Fecha de registro automática
- [ ] Redirección a ficha del cliente tras crear

### HIST-3.2 — Lista de clientes con WhatsApp

**Descripción:** Tabla paginada de clientes con búsqueda y botón WhatsApp directo.

**Acceptance Criteria:**
- [ ] Tabla con columnas: código, nombre, negocio, teléfono, tipo, última recarga, total recargas
- [ ] Paginación (server-side)
- [ ] Ordenamiento por nombre, fecha registro, total recargas
- [ ] Ícono WhatsApp en cada fila (abre `wa.me/XXXXXXXXX`)
- [ ] Link a ficha del cliente

### HIST-3.3 — Ficha del cliente — Tab: Datos

**Descripción:** Pestaña con datos completos del cliente, editables.

**Acceptance Criteria:**
- [ ] Página `/clientes/[id]` con tabs
- [ ] Tab "Datos" muestra todos los campos
- [ ] Botón "Editar" → formulario inline
- [ ] Guardar cambios con validación

### HIST-3.4 — Ficha del cliente — Tab: Dirección + Mapa

**Descripción:** Pestaña con dirección escrita y mapa Leaflet con GPS. Parser de link de WhatsApp.

**Acceptance Criteria:**
- [ ] Campos de dirección editables
- [ ] Campo para pegar link de ubicación de WhatsApp → parsea lat/lng → preview en mapa
- [ ] Mapa Leaflet con marcador en la ubicación
- [ ] Botón "Abrir en Google Maps" que deep-linkea a la app

### HIST-3.5 — Ficha del cliente — Tab: Fotos

**Descripción:** Galería de fotos del cliente tomadas desde el celular o subidas.

**Acceptance Criteria:**
- [ ] Upload con `capture="environment"` (abre cámara en mobile)
- [ ] Tipos de foto: fachada, entrada, referencia, adicional
- [ ] Galería con thumbnails (URLs firmadas de Supabase)
- [ ] Eliminar foto (admin)

### HIST-3.6 — Ficha del cliente — Tab: Botellones

**Descripción:** Lista de botellones asignados al cliente con sus estados.

**Acceptance Criteria:**
- [ ] Tabla: código, estado, fecha creación, total recargas
- [ ] Badge de color según estado (verde=disponible, azul=asignado, amarillo=recarga, gris=mantenimiento, rojo=dañado/perdido)
- [ ] Link a página del botellón

### HIST-3.7 — Ficha del cliente — Tab: Historial

**Descripción:** Historial completo de recargas del cliente con filtro por fecha.

**Acceptance Criteria:**
- [ ] Tabla cronológica: fecha, hora, botellón, repartidor
- [ ] Filtro por rango de fechas
- [ ] Total de recargas en el período seleccionado
- [ ] Paginación si hay muchas recargas

### HIST-3.8 — Botón WhatsApp en todos lados

**Descripción:** WhatsApp accesible desde lista, ficha, búsqueda y notificaciones.

**Acceptance Criteria:**
- [ ] Ícono/botón WhatsApp visible en:
  - Lista de clientes (cada fila)
  - Ficha del cliente (header)
  - Resultados de búsqueda
  - Notificaciones que referencien al cliente
- [ ] Formato: `https://wa.me/CODIGO_PAIS+NUMERO` (ej: `https://wa.me/584141234567`)

---

## EPIC-4 — Gestión de Botellones + QR

> Cada botellón tiene código, estado, QR imprimible e historial público vía QR.

**Depende de:** EPIC-1
**Responsable:** Desarrollador

### HIST-4.1 — CRUD de botellones

**Descripción:** Crear, listar, editar y eliminar botellones (admin).

**Acceptance Criteria:**
- [ ] Formulario de creación: código auto (BOT-XXXXX), estado inicial (disponible)
- [ ] Lista paginada: código, estado, cliente asignado, fecha creación, total recargas
- [ ] Edición: cambiar estado, reasignar cliente
- [ ] Eliminación lógica (no borrar si tiene recargas)

### HIST-4.2 — Estados y transiciones

**Descripción:** Sistema de estados del botellón con reglas de transición válidas.

**Acceptance Criteria:**
- [ ] Estados: disponible, asignado, en_recarga, mantenimiento, danado, perdido
- [ ] Transiciones válidas:
  - disponible → asignado, mantenimiento, danado, perdido
  - asignado → en_recarga, disponible, perdido
  - en_recarga → asignado, disponible, mantenimiento
  - mantenimiento → disponible, danado
  - danado → (estado terminal)
  - perdido → disponible (si se recupera)
- [ ] Dropdown con solo transiciones válidas

### HIST-4.3 — Asignar / desasignar a cliente

**Descripción:** Vincular botellón a un cliente o liberarlo a planta.

**Acceptance Criteria:**
- [ ] Select de cliente con búsqueda en formulario de botellón
- [ ] Al asignar: estado cambia a "asignado"
- [ ] Al desasignar: estado cambia a "disponible"
- [ ] No se puede asignar un botellón dañado o perdido

### HIST-4.4 — Generación de QR

**Descripción:** Al crear un botellón, se genera automáticamente un código QR que enlaza a su página pública.

**Acceptance Criteria:**
- [ ] QR generado con `qrcode.react` (SVG)
- [ ] Enlace: `/b/BOT-XXXXX`
- [ ] Botón "Descargar QR" que exporta el SVG
- [ ] QR visible en ficha del botellón

### HIST-4.5 — Página pública del botellón

**Descripción:** Página accesible sin login que muestra info básica del botellón al escanear el QR.

**Acceptance Criteria:**
- [ ] Ruta `/b/[codigo]` pública (sin autenticación)
- [ ] Muestra: código del botellón, total de recargas, última recarga (fecha)
- [ ] NO muestra datos personales del cliente
- [ ] Muestra logo del negocio (si está configurado)

### HIST-4.6 — Vista de impresión de etiqueta

**Descripción:** Página con formato de impresión para etiquetas físicas con QR.

**Acceptance Criteria:**
- [ ] Ruta `/botellones/[id]/imprimir` con layout de impresión (sin header/sidebar)
- [ ] Formato A4 con múltiples etiquetas por hoja
- [ ] Cada etiqueta: código, QR, nombre del cliente, logo del negocio
- [ ] CSS `@media print` optimizado

---

## EPIC-5 — Recargas

> Registrar una recarga toma 3 taps. Fecha/hora automáticas. Queda historial completo.

**Depende de:** EPIC-3, EPIC-4
**Responsable:** Desarrollador

### HIST-5.1 — Registro rápido de recarga (3 taps)

**Descripción:** Flujo optimizado para mobile: buscar cliente → elegir botellón → confirmar.

**Acceptance Criteria:**
- [ ] Paso 1: Buscar cliente (input con autocompletado)
- [ ] Paso 2: Seleccionar botellón del cliente (solo muestra los asignados a ese cliente)
- [ ] Paso 3: Confirmar (muestra resumen: cliente, botellón)
- [ ] Fecha y hora automáticas (sin input manual)
- [ ] Usuario que registra asignado automáticamente
- [ ] Feedback visual: toast de confirmación
- [ ] Botón "Registrar otra" para repetir el flujo

### HIST-5.2 — Historial de recargas por cliente

**Descripción:** Tabla de recargas en ficha del cliente, filtrable.

**Acceptance Criteria:**
- [ ] Orden cronológico inverso (más reciente primero)
- [ ] Columnas: fecha, hora, botellón, repartidor
- [ ] Filtro por rango de fechas
- [ ] Total de recargas en el período

### HIST-5.3 — Historial de recargas por botellón

**Descripción:** Tabla de recargas en ficha del botellón.

**Acceptance Criteria:**
- [ ] Orden cronológico inverso
- [ ] Columnas: fecha, hora, cliente, repartidor
- [ ] Total de recargas del botellón

### HIST-5.4 — Contadores para panel y fidelidad

**Descripción:** Campos calculados o queries que alimentan el dashboard y el sistema de fidelidad.

**Acceptance Criteria:**
- [ ] `total_recargas` por cliente (count de recargas)
- [ ] `ultima_recarga` por cliente (MAX de fecha)
- [ ] `recargas_hoy` (count con fecha = today)
- [ ] `recargas_mes` (count con fecha en mes actual)
- [ ] Query eficiente (usar índices creados en EPIC-1)

### HIST-5.5 — Registro rápido desde la lista de clientes

**Descripción:** Atajo: desde la lista de clientes, botón "Registrar recarga" que salta al paso 2.

**Acceptance Criteria:**
- [ ] Botón en cada fila de la lista de clientes
- [ ] Click → va directo a seleccionar botellón (cliente ya elegido)
- [ ] Reduce el flujo de 3 taps a 2 taps

---

## EPIC-6 — Sistema de Fidelidad

> Cada 100 recargas = premio. El admin elige qué entregar. El repartidor ve la alerta en ruta. El cliente ve su progreso.

**Depende de:** EPIC-5
**Responsable:** Desarrollador

### HIST-6.1 — Detección automática de premios

**Descripción:** Al registrar una recarga, el sistema detecta si el cliente alcanzó un múltiplo de 100 y genera un premio pendiente.

**Acceptance Criteria:**
- [ ] Lógica: después de cada INSERT en `recargas`, verificar `COUNT(*) % 100 === 0`
- [ ] Si alcanza 100, 200, 300... → INSERT en `premios` con estado "pendiente"
- [ ] No genera duplicados (verificar que no exista premio para ese nivel)
- [ ] Registra: cliente_id, nivel_recargas, fecha_alcanzado

### HIST-6.2 — Gestión de premios (admin)

**Descripción:** Panel para que el admin vea premios pendientes, elija tipo y marque como entregado.

**Acceptance Criteria:**
- [ ] Lista de premios pendientes
- [ ] Lista de premios entregados (histórico)
- [ ] Modal para entregar premio: elegir tipo (botellón gratis, descuento 50%, termo, otro) + observaciones
- [ ] Al marcar entregado: se registra fecha, usuario que entrega, tipo de premio

### HIST-6.3 — Barra de progreso en ficha del cliente

**Descripción:** Indicador visual de progreso hacia el próximo premio + nivel actual.

**Acceptance Criteria:**
- [ ] Barra circular: "67 / 100 recargas" con progreso hacia próximo múltiplo
- [ ] Insignia de nivel: 🥉 Bronce (0-99), 🥈 Plata (100-199), 🥇 Oro (200-499), 💎 Platino (500+)
- [ ] Si está en nivel con premio pendiente → badge "Premio pendiente"
- [ ] Se actualiza en tiempo real tras cada recarga

### HIST-6.4 — Alerta al repartidor

**Descripción:** Cuando el repartidor registra la recarga que dispara un premio, ve una notificación inmediata.

**Acceptance Criteria:**
- [ ] Toast/popup al confirmar recarga: "🎁 ¡Juan Pérez alcanzó 100 recargas! Tiene un premio pendiente."
- [ ] Botones: "Ver ficha", "WhatsApp"
- [ ] También se crea notificación en el centro de notificaciones (EPIC-7)

---

## EPIC-7 — Notificaciones

> Campanita con badge de no leídas. Cada alerta del sistema se puede revisar 1 a 1. WhatsApp a un click.

**Depende de:** EPIC-1
**Responsable:** Desarrollador

### HIST-7.1 — Centro de notificaciones (UI)

**Descripción:** Componente de campanita en header + panel desplegable con lista de notificaciones.

**Acceptance Criteria:**
- [ ] Ícono de campana 🔔 en header con badge numérico de no leídas
- [ ] Click → dropdown con últimas 5 notificaciones
- [ ] "Ver todas" → página `/notificaciones` con historial completo
- [ ] Filtro por tipo (premio, inactividad, botellón)
- [ ] Marcar individual o "Marcar todas como leídas"
- [ ] Cada notificación es clickeable → lleva a la ficha correspondiente
- [ ] Badge se actualiza en tiempo real (Supabase Realtime)

### HIST-7.2 — Tipos de notificaciones automáticas

**Descripción:** El sistema genera notificaciones automáticas para eventos clave.

**Acceptance Criteria:**
- [ ] 🎁 Cliente alcanza 100 recargas → notificación para admin + repartidor
- [ ] ⚠️ Cliente 30 días sin recarga → notificación para admin (se ejecuta diariamente)
- [ ] 🔧 Botellón cambia a "dañado" o "perdido" → notificación para admin
- [ ] ⭐ Cliente a 5 recargas del premio (95, 195, 295...) → notificación para admin

### HIST-7.3 — Notificación con acción WhatsApp

**Descripción:** Cada notificación relevante incluye botón directo de WhatsApp.

**Acceptance Criteria:**
- [ ] Notificaciones que referencian un cliente → botón WhatsApp visible
- [ ] Formato: `https://wa.me/CODIGO+NUMERO`
- [ ] Ícono de WhatsApp reconocible

### HIST-7.4 — Supabase Realtime

**Descripción:** Las notificaciones se reciben en tiempo real sin refrescar la página.

**Acceptance Criteria:**
- [ ] Suscripción a canal `notificaciones` con Supabase Realtime
- [ ] Nueva notificación → aparece en dropdown inmediatamente
- [ ] Badge se actualiza automáticamente

---

## EPIC-8 — Panel y Reportes

> Dashboard con KPIs, gráficos, alertas y resúmenes inteligentes. Vistas separadas para admin y repartidor.

**Depende de:** EPIC-3, EPIC-4, EPIC-5, EPIC-6, EPIC-7
**Responsable:** Desarrollador

### HIST-8.1 — Dashboard admin: KPIs

**Descripción:** Pantalla principal del admin con tarjetas de indicadores clave.

**Acceptance Criteria:**
- [ ] Total clientes (+ variación nuevos este mes)
- [ ] Botellones activos (asignados a clientes)
- [ ] Botellones en planta (disponibles)
- [ ] Recargas hoy
- [ ] Recargas este mes (con % vs mes anterior)
- [ ] Premios pendientes (badge rojo con cantidad)
- [ ] Se actualizan al navegar al dashboard

### HIST-8.2 — Dashboard admin: Gráficos

**Descripción:** Visualizaciones de datos en el dashboard.

**Acceptance Criteria:**
- [ ] Gráfico de barras: recargas por día (últimos 30 días)
- [ ] Gráfico de torta/donut: distribución de botellones por estado
- [ ] Tabla ranking: top 10 clientes por recargas totales
- [ ] Librería: recharts (ligera, React-native)

### HIST-8.3 — Dashboard admin: Alertas

**Descripción:** Sección de alertas y resúmenes inteligentes.

**Acceptance Criteria:**
- [ ] Premios pendientes de entrega (link a ficha de cada cliente)
- [ ] Clientes sin actividad en 30+ días (🔴 en riesgo)
- [ ] Clientes sin actividad en 60+ días (🟡 a reconquistar)
- [ ] Botellones en mantenimiento o dañados
- [ ] Cada alerta tiene link directo a la ficha correspondiente

### HIST-8.4 — Dashboard repartidor

**Descripción:** Vista simplificada para el repartidor: solo lo que necesita en ruta.

**Acceptance Criteria:**
- [ ] Mis recargas del día (contador)
- [ ] Lista de clientes asignados para hoy
- [ ] Acceso rápido: "Registrar recarga" (botón prominente)
- [ ] Acceso rápido: "Buscar cliente"
- [ ] Sin acceso a reportes, configuración ni gestión de botellones

### HIST-8.5 — Reportes: menú y navegación

**Descripción:** Sección de reportes con menú lateral de categorías.

**Acceptance Criteria:**
- [ ] Ruta `/reportes` con sub-menú: Clientes, Recargas, Botellones, Fidelidad, Operaciones
- [ ] Cada reporte tiene filtros y botón de exportar (PDF/Excel)
- [ ] Solo accesible por admin

### HIST-8.6 — Resúmenes inteligentes

**Descripción:** Indicadores de negocio calculados automáticamente.

**Acceptance Criteria:**
- [ ] ⭐ Cliente del mes (mayor número de recargas en el mes)
- [ ] 📈 Tendencia mensual (crecimiento/decrecimiento de recargas vs mes anterior)
- [ ] 🏠 Zonas activas (sectores con más clientes, basado en campo `sector`)
- [ ] 🔄 Tasa de retorno (% de clientes que repitieron recarga este mes)

---

## EPIC-9 — Búsqueda y Mapa General

> Búsqueda global rápida y mapa con todos los clientes ubicados.

**Depende de:** EPIC-3
**Responsable:** Desarrollador

### HIST-9.1 — Búsqueda global

**Descripción:** Barra de búsqueda en header que busca en clientes por múltiples campos.

**Acceptance Criteria:**
- [ ] Input con debounce (300ms)
- [ ] Busca por: nombre, teléfono, código cliente, cédula, negocio, dirección (ILIKE en Postgres)
- [ ] Resultados en dropdown debajo del input
- [ ] Cada resultado: código, nombre, negocio, teléfono, WhatsApp
- [ ] Click en resultado → ficha del cliente

### HIST-9.2 — Mapa general de clientes

**Descripción:** Mapa Leaflet con todos los clientes que tienen coordenadas GPS.

**Acceptance Criteria:**
- [ ] Ruta `/mapa` con mapa full-screen
- [ ] Marcadores para cada cliente con coordenadas
- [ ] Si hay +50 marcadores → clusterización (Leaflet.markercluster)
- [ ] Click en marcador → popup con: nombre, negocio, dirección, botón "Ver ficha", botón WhatsApp
- [ ] Solo muestra clientes con lat/lng definidas
- [ ] Sin API key (OpenStreetMap tiles gratuitos)

### HIST-9.3 — Búsqueda con filtros avanzados

**Descripción:** Página de búsqueda avanzada con filtros combinables.

**Acceptance Criteria:**
- [ ] Ruta `/clientes/buscar`
- [ ] Filtros: tipo de cliente, rango de recargas, con/sin actividad reciente, por sector
- [ ] Resultados en tabla con las mismas acciones que la lista de clientes

---

## EPIC-10 — PDF y Excel

> Exportación de reportes en PDF y Excel desde el panel de reportes.

**Depende de:** EPIC-8
**Responsable:** Desarrollador

### HIST-10.1 — Exportación PDF

**Descripción:** Generar PDFs con `@react-pdf/renderer` para cada tipo de reporte.

**Acceptance Criteria:**
- [ ] PDF de Reporte de Clientes (con logo del negocio en encabezado)
- [ ] PDF de Reporte de Recargas (filtrable por fecha)
- [ ] PDF de Reporte de Botellones (por estado)
- [ ] PDF de Reporte de Fidelidad (ranking + premios)
- [ ] Cada PDF incluye: logo, nombre negocio, fecha de generación, datos del reporte
- [ ] Descarga como archivo `.pdf`

### HIST-10.2 — Exportación Excel

**Descripción:** Generar archivos Excel con `xlsx` (SheetJS) para cada tipo de reporte.

**Acceptance Criteria:**
- [ ] Excel de Lista de Clientes
- [ ] Excel de Historial de Recargas
- [ ] Excel de Inventario de Botellones
- [ ] Descarga como archivo `.xlsx`
- [ ] Columnas con formato adecuado (fechas como fecha, números como número)

### HIST-10.3 — Ficha individual en PDF

**Descripción:** Botón "Exportar ficha" desde la ficha de cualquier cliente.

**Acceptance Criteria:**
- [ ] PDF con todos los datos del cliente
- [ ] Incluye: datos, dirección, última recarga, total recargas, nivel de fidelidad
- [ ] Logo del negocio en encabezado
- [ ] Descarga inmediata

---

## EPIC-11 — Pulido PWA y Seguridad

> Verificación final: instalación mobile, seguridad, rendimiento.

**Depende de:** Todos los epics
**Responsable:** Desarrollador

### HIST-11.1 — Verificación PWA mobile

**Descripción:** Probar y ajustar experiencia PWA en dispositivos móviles reales.

**Acceptance Criteria:**
- [ ] "Instalar app" funciona en Chrome Android y Safari iOS
- [ ] Ícono y splash screen correctos
- [ ] Navegación táctil fluida (botones tamaño adecuado, sin zoom accidental)
- [ ] Carga rápida en 3G/4G

### HIST-11.2 — Security advisors

**Descripción:** Revisar y resolver advisories de seguridad de Supabase.

**Acceptance Criteria:**
- [ ] Ejecutar `get_advisors` para security
- [ ] Todos los advisories críticos y high resueltos
- [ ] RLS verificado en todas las tablas con políticas
- [ ] Buckets con acceso mínimo necesario

### HIST-11.3 — Performance y accesibilidad

**Descripción:** Optimizar carga y accesibilidad.

**Acceptance Criteria:**
- [ ] Lighthouse score > 90 en Performance
- [ ] Lighthouse score > 90 en Accessibility
- [ ] Imágenes con lazy loading
- [ ] Textos con contraste adecuado

---

## EPIC-12 — QR Público Rediseñado

> La página pública del QR (`/b/[codigo]`) se rediseña con la paleta "Agua" y muestra la identidad completa del negocio + resumen del botellón + WhatsApp de contacto. El QR NO cambia.

**Depende de:** EPIC-4
**Responsable:** Desarrollador

### HIST-12.1 — Rediseñar con paleta "Agua"

**Descripción:** Aplicar gradiente `#0c4a6e → #06b6d4`, colores cyan y tipografía al estilo de la etiqueta.

**Acceptance Criteria:**
- [ ] Header con gradiente cyan
- [ ] Tarjeta principal con borde/sombra consistente
- [ ] Responsive mobile-first

### HIST-12.2 — Identidad del negocio

**Descripción:** Mostrar logo, nombre y eslogan desde `configuracion`.

**Acceptance Criteria:**
- [ ] Logo (si hay), nombre y eslogan visibles
- [ ] Fallback sin logo

### HIST-12.3 — Resumen del botellón

**Descripción:** Estado (badge), total y última recarga. Sin datos personales del cliente.

**Acceptance Criteria:**
- [ ] Código, estado con badge, total recargas, última recarga
- [ ] NO muestra nombre/teléfono/dirección del cliente

### HIST-12.4 — WhatsApp de contacto

**Descripción:** Botón verde WhatsApp con el teléfono del negocio.

**Acceptance Criteria:**
- [ ] `https://wa.me/CODIGO+NUMERO`, visible solo si `telefono` configurado

---

## EPIC-13 — Recarga Rápida desde QR

> El mismo QR detecta la sesión: anónimo ve el resumen; admin/repartidor logueado ve "Registrar recarga" en 1 tap.

**Depende de:** EPIC-12
**Responsable:** Desarrollador

### HIST-13.1 — Página session-aware

**Descripción:** Detectar sesión (dev cookie / Supabase auth) y renderizar acciones según rol.

**Acceptance Criteria:**
- [ ] Logueado → acción de recarga; anónimo → solo resumen
- [ ] Funciona en dev y prod

### HIST-13.2 — getBotellonByCodigo ampliado

**Descripción:** Devolver `id` y `cliente_id` para la recarga.

**Acceptance Criteria:**
- [ ] Devuelve id + cliente_id sin exponer datos del cliente

### HIST-13.3 — Botón "Registrar recarga" (1 tap)

**Descripción:** Botón prominente → `/recargas/nueva?botellon_id=X` (preselección nueva).

**Acceptance Criteria:**
- [ ] Preselección por botellón; confirmación en 1 tap

### HIST-13.4 — Botellón sin cliente

**Descripción:** Aviso "sin cliente asignado" + link para asignar.

**Acceptance Criteria:**
- [ ] Aviso claro y link a asignar cliente

---

## EPIC-14 — Scanner Interno con Cámara (opcional)

> Scanner con cámara dentro del dashboard para escanear QR y saltar a la recarga rápida sin salir del sistema.

**Depende de:** EPIC-13
**Responsable:** Desarrollador

### HIST-14.1 — Botón "Escanear QR" con cámara

**Acceptance Criteria:**
- [ ] Acceso a cámara (`getUserMedia`, requiere HTTPS) + decode con `jsqr`/`html5-qrcode`
- [ ] Valida QR de botellón (`/b/BOT-XXXXX`)

### HIST-14.2 — Decode → recarga rápida

**Acceptance Criteria:**
- [ ] Extrae `BOT-XXXXX` y redirige a `/recargas/nueva?botellon_id=X`

---

## Orden de ejecución

```
EPIC-0 → EPIC-1 → EPIC-2 ─┬─→ EPIC-3 ─┬─→ EPIC-5 → EPIC-6
                           │            │
                           └─→ EPIC-4 ─┘
                                        │
                           EPIC-7 ──────┤
                                        │
                                        └─→ EPIC-8 → EPIC-9 → EPIC-10 → EPIC-11
```

EPIC-7 puede ejecutarse en paralelo con EPIC-3/4/5.

---

## Fase 2 — QR inteligente (post-EPIC-11)

```
EPIC-12 → EPIC-13 → EPIC-14 (opcional)
```

- **EPIC-12** rediseña la página pública del QR (paleta "Agua").
- **EPIC-13** agrega la recarga rápida en 1 tap para admin/repartidor.
- **EPIC-14** (opcional) agrega el scanner con cámara dentro del dashboard.
