# Base de Conocimiento — Botellon

> Sistema de Gestion de Botellones de Agua  
> Stack: Next.js + TypeScript + Tailwind + shadcn/ui + Supabase (PWA)

---

## Documentos principales

| Documento | Contenido |
|---|---|
| [[plan|plan.md]] | Plan general, stack, decisiones de diseno |
| [[epics|epics.md]] | Epics completos (documento maestro, 782 lineas) |
| [[Epicas|Epics.canvas]] | Grafo visual de dependencias (Obsidian Canvas) |

---

## Modulos (Epics)

| # | Epic | Estado | Historias | Dependencias |
|---|---|---|---|---|
| 0 | [[epics/00-Fundacion\|Fundacion]] | ✅ | 5 | — |
| 1 | [[epics/01-DB-Auth\|DB + Auth]] | 🔴 | 7 | EPIC-0 |
| 2 | [[epics/02-Config-Negocio\|Config Negocio]] | ⬜ | 3 | EPIC-1 |
| 3 | [[epics/03-Clientes\|Clientes]] | ⬜ | 8 | EPIC-1, EPIC-2 |
| 4 | [[epics/04-Botellones-QR\|Botellones + QR]] | ⬜ | 6 | EPIC-1 |
| 5 | [[epics/05-Recargas\|Recargas]] | ⬜ | 5 | EPIC-3, EPIC-4 |
| 6 | [[epics/06-Fidelidad\|Fidelidad]] | ⬜ | 4 | EPIC-5 |
| 7 | [[epics/07-Notificaciones\|Notificaciones]] | ⬜ | 4 | EPIC-1 |
| 8 | [[epics/08-Panel-Reportes\|Panel + Reportes]] | ⬜ | 6 | EPIC-3,4,5,6,7 |
| 9 | [[epics/09-Busqueda-Mapa\|Busqueda + Mapa]] | ⬜ | 3 | EPIC-3 |
| 10 | [[epics/10-PDF-Excel\|PDF + Excel]] | ⬜ | 3 | EPIC-8, EPIC-9 |
| 11 | [[epics/11-Pulido-PWA\|Pulido PWA]] | ⬜ | 3 | Todos |

**Total**: 62 historias | **Completado**: 5/62

---

## Orden de ejecucion

```
EPIC-0 ✅ → EPIC-1 🔴 → EPIC-2 → EPIC-3 → EPIC-5 → EPIC-6
                       → EPIC-4 ↗           ↘
                       → EPIC-7              EPIC-8 → EPIC-9 → EPIC-10 → EPIC-11
```

---

## Stack tecnologico

| Capa | Eleccion |
|---|---|
| Frontend | Next.js App Router + TypeScript + Tailwind + shadcn/ui + lucide-react |
| UI Forms | React Hook Form + Zod |
| Backend/DB | Supabase (Postgres + Auth + Storage + Realtime) |
| Mapas | Leaflet + OpenStreetMap |
| QR | qrcode.react (SVG) |
| Graficos | recharts |
| PDF | @react-pdf/renderer |
| Excel | xlsx / SheetJS |
| PWA | Manifest + Service Worker |
