# Mapa del Sistema — Botellón

> Documento generado automáticamente — última actualización: 2026-08-11

---

## 🔑 Credenciales (Modo Dev)

| Rol | Email | Contraseña |
|---|---|---|
| Admin | `admin@botellon.com` | `Admin123!` |
| Repartidor | `repartidor@botellon.com` | `Repartidor123!` |

> Modo dev activo en `.env.local`: `NEXT_PUBLIC_AUTH_MODE=dev`

---

## 🗄️ Capa de Datos — `src/lib/db/`

### `analytics.ts` — Dashboard KPIs y agregaciones
| Función | Descripción |
|---|---|
| `getDashboardKpis()` → `DashboardKpis` | 7 KPIs en paralelo: total clientes, nuevos mes, botellones activos, recargas hoy/mes, premios pendientes, variación % |
| `getRecargasPorDia(days?)` → `RecargaPorDia[]` | Recargas agregadas por día (últimos 30 por defecto) |
| `getBotellonesPorEstado()` → `BotellonPorEstado[]` | Distribución de botellones por estado |
| `getTopClientes(limit?)` → `TopCliente[]` | Top N clientes por total recargas |
| `getAlertas()` → `AlertasPanel` | Premios pendientes, clientes inactivos 30/60d |
| `getResumenesNegocio()` → `ResumenesNegocio` | Cliente del mes, tendencia 6 meses, zonas activas, tasa retorno |
| `getRepartidorDashboard(userId)` → `RepartidorDashboard` | Recargas hoy + clientes asignados |

### `botellones.ts` — CRUD Botellones
| Función | Descripción |
|---|---|
| `getBotellones(page?, search?)` → `{ botellones, total }` | Lista paginada con búsqueda por código |
| `getBotellon(id)` → `botellon` | Detalle con cliente asignado y total recargas |
| `getBotellonByCodigo(codigo)` → `botellon` | Búsqueda por código único (página pública QR) |
| `createBotellon(prev, formData)` → `BotellonState` | Crea botellón con código auto BOT-XXXXX |
| `updateBotellon(prev, formData)` → `BotellonState` | Actualiza estado/cliente (asignar → entregado; desasignar mantiene estado) |
| `getClientesForSelect(search?)` → `cliente[]` | Top 20 clientes para dropdown |

### `clientes.ts` — CRUD Clientes
| Función | Descripción |
|---|---|
| `createCliente(prev, formData)` → `ClienteState` | Crea cliente con código auto CL-XXXX |
| `getClientes(page?, search?, orderBy?)` → `{ clientes, total }` | Lista paginada, búsqueda ILIKE en 6 campos |
| `getCliente(id)` → `ClienteRow` | Detalle con total_recargas |
| `updateCliente(prev, formData)` → `ClienteState` | Actualiza campos del cliente |

### `configuracion.ts` — Configuración del Negocio
| Función | Descripción |
|---|---|
| `getConfiguracion()` → `ConfiguracionRow` | Lee nombre_negocio y logo_url; fallback "Botellón" |

### `direcciones.ts` — Direcciones de Clientes
| Función | Descripción |
|---|---|
| `getDireccion(clienteId)` → `direccion` | Dirección del cliente |
| `saveDireccion(prev, formData)` → `DireccionState` | Upsert de dirección con coordenadas GPS |

### `mapa.ts` — Datos para Mapa
| Función | Descripción |
|---|---|
| `getClientesConCoordenadas()` → `ClienteMapa[]` | Clientes con lat/lng para marcadores del mapa |

### `notificaciones.ts` — Centro de Notificaciones
| Función | Descripción |
|---|---|
| `getUnreadCount(userId)` → `number` | Contador de no leídas para el badge |
| `getNotificaciones(userId, filter?, page?)` → `{ items, total }` | Lista paginada con filtro por tipo |
| `getLastNotificaciones(userId, limit?)` → `NotificacionRow[]` | Últimas N para el dropdown de la campana |
| `markAsRead(prev, formData)` → `NotificacionState` | Marca una como leída |
| `markAllAsRead(prev, formData)` → `NotificacionState` | Marca todas como leídas |
| `insertNotificacion(data)` → `void` | Inserta una notificación (uso interno) |
| `insertNotificacionMulti(usuarios[], data)` → `void` | Broadcast a múltiples perfiles |
| `checkInactividad()` → `void` | Detecta clientes 30d sin recarga, genera notificaciones |

### `premios.ts` — Gestión de Premios (Fidelidad)
| Función | Descripción |
|---|---|
| `getPremios(estado, page?)` → `{ premios, total }` | Lista paginada por estado (pendiente/entregado) |
| `getPremiosByCliente(clienteId)` → `PremioRow[]` | Todos los premios de un cliente |
| `entregarPremio(prev, formData)` → `PremioState` | Marca premio como entregado con tipo y observaciones |

### `recargas.ts` — Registro de Recargas
| Función | Descripción |
|---|---|
| `registrarRecarga(prev, formData)` → `RecargaState` | Flujo completo: INSERT recarga, update botellón, detección fidelidad (cada 100 = premio, cada 95/195 = alerta), notificaciones |
| `getRecargasCliente(clienteId, desde?, hasta?)` → `{ recargas, total }` | Historial de recargas con filtro de fechas |
| `getRecargasBotellon(botellonId)` → `{ recargas, total }` | Historial de recargas de un botellón |
| `getClientesForSearch(query)` → `cliente[]` | Búsqueda de clientes para el formulario de recarga |
| `getBotellonesDelCliente(clienteId)` → `botellon[]` | Botellones asignados al cliente |
| `getContadores()` → `{ recargas_hoy, recargas_mes, recargas_total }` | Contadores para la página de recargas |

### `search.ts` — Búsqueda Global
| Función | Descripción |
|---|---|
| `searchClientesLight(q, limit?)` → `SearchResult[]` | ILIKE en 6 campos, devuelve top 10 para dropdown del header |

---

## 📄 Exportación PDF/Excel — `src/lib/export/`

### `actions.tsx` — Server Actions de Exportación
| Función | Formato | Descripción |
|---|---|---|
| `exportClientesPDF()` | PDF | Reporte de clientes (100 primeros) |
| `exportRecargasPDF()` | PDF | Reporte de recargas con gráficos y top 20 |
| `exportBotellonesPDF()` | PDF | Reporte de botellones con distribución |
| `exportFidelidadPDF()` | PDF | Reporte de premios pendientes y entregados |
| `exportClienteFichaPDF(clienteId)` | PDF | Ficha individual completa del cliente |
| `exportClientesExcel()` | XLSX | Lista de clientes con auto-filtro |
| `exportRecargasExcel()` | XLSX | Top 20 clientes por recargas |
| `exportBotellonesExcel()` | XLSX | Inventario de botellones |

---

## 🧩 Componentes UI — `src/components/`

### Dashboard
| Componente | Descripción |
|---|---|
| `AdminDashboard` | Dashboard completo: KPIs, gráficos, alertas, resúmenes |
| `RepartidorDashboard` | Vista simplificada: recargas hoy, clientes, accesos rápidos |
| `KpiCard` | Tarjeta de métrica con valor, delta %, icono |
| `RecargasBarChart` | Gráfico de barras (recharts) — recargas por día |
| `BotellonesDonutChart` | Gráfico donut (recharts) — botellones por estado |
| `TopClientesTable` | Tabla ranking top 10 clientes |
| `AlertPanel` | Panel de alertas inteligentes |

### Reportes
| Componente | Descripción |
|---|---|
| `ReportesTabs` | 5 tabs: Clientes, Recargas, Botellones, Fidelidad, Operaciones |
| `FiltroFechas` | Filtro de rango de fechas con tipo opcional |
| `ResumenesNegocio` | Tarjetas de resumen: cliente del mes, tendencia, zonas, retorno |

### Fidelidad
| Componente | Descripción |
|---|---|
| `LoyaltyBadge` | Badge circular SVG con nivel (Bronce/Plata/Oro/Platino) y progreso |
| `PremioAlertCard` | Tarjeta de alerta al alcanzar milestone con link WhatsApp |

### Notificaciones
| Componente | Descripción |
|---|---|
| `BellNotification` | Campana con badge, dropdown, suscripción Supabase Realtime |
| `NotificationIcon` | Icono/emoji según tipo de notificación |

### Shared
| Componente | Descripción |
|---|---|
| `Header` | Barra de navegación con logo, links, búsqueda global, campana |
| `ExportButton` | Botón de exportación con spinner y descarga Blob |

### Búsqueda
| Componente | Descripción |
|---|---|
| `GlobalSearch` | Barra de búsqueda con debounce 300ms, dropdown, navegación por teclado |

### Mapa
| Componente | Descripción |
|---|---|
| `MapaClientes` | Mapa Leaflet full-screen con clustering de marcadores y filtro por sector |

### PWA
| Componente | Descripción |
|---|---|
| `PwaShell` | Wrapper cliente para el prompt de actualización |
| `UpdatePrompt` | Toast "Nueva versión disponible" al detectar update del SW |

### Accesibilidad
| Componente | Descripción |
|---|---|
| `SkipLink` | Link "Saltar al contenido" visible al focus |

### UI (shadcn/base-ui)
`Button`, `Card`, `Dialog`, `DropdownMenu`, `Input`, `Select`, `Table`, `Tabs`, `Badge`

---

## 🗺️ Rutas — `src/app/`

| Ruta | Descripción | Acceso |
|---|---|---|
| `/` | Landing page | Público |
| `/login` | Formulario de login | Público |
| `/dashboard` | Dashboard role-aware (admin/repartidor) | Auth |
| `/clientes` | Lista de clientes con búsqueda | Auth |
| `/clientes/nuevo` | Crear cliente | Auth |
| `/clientes/buscar` | Búsqueda avanzada con filtros | Auth |
| `/clientes/[id]` | Ficha del cliente con tabs (Datos, Dirección, Fotos, Botellones, Historial, Fidelidad) | Auth |
| `/recargas` | Contadores de recargas | Auth |
| `/recargas/nueva` | Wizard de 3 pasos para registrar recarga | Auth |
| `/reportes` | Panel de reportes con tabs (admin only) | Admin |
| `/botellones` | Lista de botellones | Auth |
| `/botellones/nuevo` | Crear botellón | Auth |
| `/botellones/[id]` | Detalle de botellón con QR | Auth |
| `/botellones/[id]/imprimir` | Página optimizada para imprimir etiqueta QR | Auth |
| `/premios` | Gestión de premios (pendientes/entregados) | Auth |
| `/notificaciones` | Centro de notificaciones con filtros | Auth |
| `/configuracion` | Configuración del negocio (nombre, logo, contacto) | Auth |
| `/mapa` | Mapa full-screen con todos los clientes geolocalizados | Auth |
| `/b/[codigo]` | Página pública de botellón (QR scan) | Público |

---

## 🔧 Hooks — `src/hooks/`

| Hook | Descripción |
|---|---|
| `useMarkerCluster(markers)` | Crea grupo de clusters Leaflet con popups y cleanup |

---

## 🗃️ Migraciones — `supabase/migrations/`

| Archivo | Descripción |
|---|---|
| `0001_init.sql` | Schema fundacional: 9 tablas, RLS, storage buckets, políticas |
| `0002_seed.sql` | Seed: admin user + configuracion default |
| `0003_add_premios_unique.sql` | Índice único en premios(cliente_id, nivel_recargas) + RLS repartidor |
| `0004_add_direcciones_index.sql` | Índice parcial en direcciones(latitud, longitud) |

---

## 📚 Utilidades — `src/lib/`

| Archivo | Export | Descripción |
|---|---|---|
| `utils.ts` | `cn()` | Merge de clases Tailwind |
| `utils.ts` | `timeAgo()` | Tiempo relativo en español |
| `loyalty.ts` | `NIVELES` | Definición de niveles (Bronce/Plata/Oro/Platino) |
| `loyalty.ts` | `getNivelLoyalty()` | Nivel según total recargas |
| `loyalty.ts` | `getProgressPercent()` | Progreso hacia próximo nivel |
| `utils/estados.ts` | `ESTADOS`, `getTransiciones()` | Máquina de estados de botellones |
| `utils/location.ts` | `parseWhatsAppLocation()` | Parsea coordenadas de links de ubicación |
| `leaflet/icon-fix.ts` | `defaultIcon` | Fix de íconos de Leaflet para bundlers |
