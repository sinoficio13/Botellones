# EPIC-0 — Fundación

> **Estado**: ✅ Completado  
> **Historias**: 5 | **Tasks**: 17/18  
> **Depende de**: —  
> **Siguiente**: [[01-DB-Auth|EPIC-1 — DB + Auth]]  
> **Archivado**: 10/08/2026 — implementado directo a `main` (sin cambio SDD dedicado)

---

## Descripción

Setup inicial. Sin esto no existe nada. Proyecto funcional vacío con Next.js + Supabase + shadcn/ui + PWA.

---

## Historias

### HIST-0.1 — Crear proyecto en Supabase

Crear organización, proyecto Postgres y bucket de Storage en Supabase. Obtener API keys.

**AC:**
- [x] Proyecto Supabase activo con URL y publishable key
- [x] Bucket `fotos-clientes` creado (privado)
- [x] Bucket `logos` creado (privado)

### HIST-0.2 — Scaffold Next.js

Crear proyecto Next.js App Router con TypeScript, Tailwind, shadcn/ui y lucide-react.

**AC:**
- [x] `npm run dev` funciona en localhost:3000
- [x] Tailwind configurado con tema base
- [x] shadcn/ui instalado con Button, Input, Card, Table, Dialog, DropdownMenu
- [x] lucide-react instalado

### HIST-0.3 — Configurar cliente Supabase

Crear cliente Supabase en el frontend y probar conexión a la DB.

**AC:**
- [x] Archivo `lib/supabase/client.ts` con cliente browser
- [x] Archivo `lib/supabase/server.ts` con cliente server
- [x] Variables de entorno cargadas desde `.env.local`
- [x] Query de prueba exitosa contra la DB

### HIST-0.4 — PWA manifest + service worker

Configurar manifiesto y service worker para instalación desde navegador móvil.

**AC:**
- [x] `manifest.ts` con nombre, íconos, theme_color
- [x] Service worker registrado en `lib/sw.ts`
- [x] "Instalar app" funcional desde Chrome Android
- [x] Meta tags iOS Safari

### HIST-0.5 — ESLint + Prettier + estructura de carpetas

Configurar linter, formateador y estructura base del proyecto.

**AC:**
- [x] ESLint Flat Config con reglas TypeScript
- [x] Prettier configurado
- [x] Estructura canónica de carpetas con `.gitkeep`

---

## Implementación

| Área | Estado |
|---|---|
| Next.js 16.3 + Turbopack | ✅ |
| Supabase SSR (browser + server) | ✅ |
| shadcn/ui 6 componentes | ✅ |
| PWA manifest + SW + iOS | ✅ |
| ESLint + Prettier | ✅ |
| Estructura carpetas | ✅ |
| Supabase SELECT NOW() | ✅ |
| Lighthouse PWA audit | 🔲 Manual |

---

## Archivos modificados

`src/app/layout.tsx`, `src/app/page.tsx`, `src/app/manifest.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/sw.ts`, `src/types/database.ts`, `src/components/ui/*`, `next.config.ts`, `eslint.config.mjs`, `.prettierrc`, `.env.example`, `public/sw.js`, `public/icon-*.png`
