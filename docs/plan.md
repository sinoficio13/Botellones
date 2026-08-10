# Plan — Sistema de Gestión de Botellones de Agua

> Estado: **LISTO PARA SDD** — Epics definidos y organizados.
> Última actualización: 10/08/2026

## Documentación del proyecto

Toda la especificación detallada está en estos archivos:

| Documento | Contenido |
|---|---|
| [`epics.md`](./epics.md) | **Epics completos**: 11 epics, 62 historias de usuario con acceptance criteria |
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
| **Total** | **62 historias** |
