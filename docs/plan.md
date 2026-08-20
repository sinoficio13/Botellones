# Plan — Sistema de Gestión de Botellones de Agua

> Estado: **COMPLETADO (15/15 epics implementados; Fase 2 incluida)**
> Última actualización: 20/08/2026

## Documentación del proyecto

Toda la especificación detallada está en estos archivos:

| Documento | Contenido |
|---|---|
| [`epics.md`](./epics.md) | **Epics completos**: 15 epics, 67 historias de usuario con acceptance criteria |
| [`Propuesta_Sistema_Botellones.pdf`](./Propuesta_Sistema_Botellones.pdf) | Propuesta comercial para el cliente |

## Stack

| Capa | Elección |
|---|---|
| Frontend | Next.js App Router + TypeScript + Tailwind + shadcn/ui + lucide-react |
| UI Forms | React Hook Form + Zod |
| Backend/DB | Supabase (Postgres + Auth + Storage + Realtime) |
| Mapas | Leaflet + OpenStreetMap (gratis) |
| QR | qrcode.react (SVG) |
| Gráficos | recharts |
| PDF | @react-pdf/renderer (server-side) |
| Excel | xlsx / SheetJS |
| PWA | Manifest + service worker |

## Decisiones de diseño

| Tema | Decisión |
|---|---|
| Logo | SVG 400×100, transparente, horizontal, max 200KB |
| QR | Por botellón, enlace a página pública `/b/BOT-XXXXX` |
| Fidelidad | Acumulativo de por vida, cada 100 = premio, admin elige tipo |
| Notificaciones | Supabase Realtime, campanita con badge, WhatsApp integrado |
| Roles | Admin (todo) + Repartidor (registra recargas, consulta clientes) |

## Resumen de Epics

| Epic | Historias |
|---|---|
| EPIC-0 Fundación | 5 |
| EPIC-1 DB + Auth | 7 |
| EPIC-2 Config Negocio | 3 |
| EPIC-3 Clientes | 8 |
| EPIC-4 Botellones + QR | 6 |
| EPIC-5 Recargas | 5 |
| EPIC-6 Fidelidad | 4 |
| EPIC-7 Notificaciones | 4 |
| EPIC-8 Panel + Reportes | 6 |
| EPIC-9 Búsqueda + Mapa | 3 |
| EPIC-10 PDF + Excel | 3 |
| EPIC-11 Pulido PWA | 3 |
| EPIC-12 QR Público Rediseñado | 4 |
| EPIC-13 Recarga Rápida desde QR | 4 |
| EPIC-14 Scanner Interno | 2 |
| **Total** | **67 historias** |

## Estado de ejecución

Todos los 15 epics están implementados en código y archivados como cambios SDD en Engram (excepto donde se indica). Los epics de la Fase 1 (EPIC-0..11) se completaron directamente a `main`; los de la Fase 2 (EPIC-12..14) se implementaron como cambios SDD dedicados.

| Epic | Estado | Archivado | Cambio SDD |
|---|---|---|---|
| EPIC-0 Fundación | Completado | 10/08/2026 | — |
| EPIC-1 DB + Auth | Completado | 10/08/2026 | — |
| EPIC-2 Config Negocio | Completado | 11/08/2026 | — |
| EPIC-3 Clientes | Completado | 11/08/2026 | — |
| EPIC-4 Botellones + QR | Completado | 11/08/2026 | — |
| EPIC-5 Recargas | Completado | 11/08/2026 | — |
| EPIC-6 Fidelidad | Completado | 11/08/2026 | `sdd/EPIC-6-fidelidad` |
| EPIC-7 Notificaciones | Completado | 11/08/2026 | `sdd/EPIC-7-notificaciones` |
| EPIC-8 Panel + Reportes | Completado | 11/08/2026 | `sdd/EPIC-8-panel-reportes` |
| EPIC-9 Búsqueda + Mapa | Completado | 11/08/2026 | `sdd/EPIC-9-busqueda-mapa` |
| EPIC-10 PDF + Excel | Completado | 11/08/2026 | `sdd/EPIC-10-pdf-excel` |
| EPIC-11 Pulido PWA | Completado | 11/08/2026 | `sdd/EPIC-11-pulido-pwa` |
| EPIC-12 QR Público Rediseñado | Completado | 17/08/2026 | `sdd/qr-publico-rediseno` |
| EPIC-13 Recarga Rápida desde QR | Completado | 18/08/2026 | `sdd/qr-recarga-rapida` |
| EPIC-14 Scanner Interno | Completado | 19/08/2026 | `sdd/scanner-interno` |

> Nota: EPIC-14 estaba marcado como "opcional" en el plan, pero se implementó igualmente.

### Cambios SDD adicionales (más allá de los 15 epics)

| Cambio | Estado | Descripción |
|---|---|---|
| `navegacion-movil` | Completado | Barra de navegación inferior móvil + FAB de scanner + PWA instalable |
| `qa-code-cleanup` | Completado | Limpieza de código y convenciones QA (archivado en `openspec/changes/archive/`) |
| `carga-botellones` | Completado | Carga por lote de botellones vía QR (archivado en `openspec/changes/archive/2026-08-20-carga-botellones/`) |
