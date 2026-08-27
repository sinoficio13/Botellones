# Problemas Conocidos — Botellón

> Registro de bugs y limitaciones conocidas con causa raíz, impacto y plan de resolución.
> Última actualización: 27/08/2026

---

## KI-001 — No se puede avanzar botellones en la cola (modo dev / móvil)

**Estado:** Abierto — se resuelve con el login real (Google) y/o el refactor de server actions.
**Reportado:** 27/08/2026 — el operador no puede avanzar el proceso desde el teléfono (Pasar N a … / Entregar); en PC a veces funciona.

### Síntoma
- Desde el teléfono: tocar el botón de acción de una card de grupo no avanza los botellones. El grupo desaparece un instante (optimistic) y vuelve con un toast rojo "No se pudo mover. Reintentá.".
- En PC puede funcionar si el browser conserva una sesión real de Supabase vieja en cookies.

### Causa raíz
El `mover`/`deshacer` de la cola (`src/hooks/useColaOperaciones.ts`) llama a
`supabase.rpc('mover_botellones', …)` **desde el cliente del browser**
(`src/lib/supabase/client.ts`). El RPC es `SECURITY DEFINER` con guard de rol
(`supabase/migrations/0013_mover_botellones_restaurar.sql:56-59`):

```sql
SELECT (auth.jwt() -> 'app_metadata' ->> 'role') INTO v_role;
IF v_role IS NULL OR v_role NOT IN ('admin', 'repartidor') THEN
  RAISE EXCEPTION 'Permiso denegado: rol no autorizado para mover botellones';
```

En modo `NEXT_PUBLIC_AUTH_MODE=dev` el login crea solo la cookie falsa
`botellon_dev_session` (sin sesión real de Supabase). El cliente del browser no
tiene JWT → `auth.jwt()` devuelve NULL → el guard rechaza → el movimiento
revierte y muestra el toast rojo.

La cola es el **único write path que usa el cliente del browser**; el resto del
sistema (`updateBotellon`, `moverBotellon`, `registrarOperacion`, recargas) usa
server actions con service-role y funciona en dev mode.

### Impacto
- Bloquea la operación principal (avanzar/entregar) cuando no hay sesión real.
- También afecta cualquier otro dato que se lea/escriba con el cliente del
  browser sin sesión (ej: badges realtime RLS-filtered de la ficha del
  botellón → "historial/fidelidad desconectado" reportado por el operador).

### Plan de resolución
1. **Login con Google (previsto):** una sesión real de Supabase con
   `app_metadata.role` en el JWT resuelve el guard del RPC para usuarios
   autenticados. Es el camino natural a futuro.
2. **Refactor recomendado (robusto en ambos modos):** convertir `mover`/
   `deshacer` de la cola en **server actions** (patrón del repo): validan la
   sesión (cookie dev o sesión real) y llaman al RPC con service-role. Requiere
   además una migración para que el guard acepte `service_role`
   (`auth.role() = 'service_role'`), alcanzable solo vía el server action.
3. No requiere tocar el RPC ni el modelo de datos si se opta solo por el login
   real; el refactor es la opción que también cubre dev mode.

### Archivos involucrados
- `src/hooks/useColaOperaciones.ts` (mover, deshacerMovimiento)
- `src/lib/supabase/client.ts` (cliente browser sin sesión en dev)
- `supabase/migrations/0013_mover_botellones_restaurar.sql` (guard de rol)
- `src/lib/db/botellones.ts` (patrón de server actions a replicar)

---

## KI-002 — Preview de Vercel se despliega automáticamente por PR

**Estado:** Mitigado (repo) — control total pendiente (dashboard).
**Reportado:** 27/08/2026 — el usuario pidió frenar los deploys hasta probar el resultado final.

### Causa
La integración Vercel↔GitHub crea un preview por cada PR/branch. Sin
`vercel.json`, todos los branches construyen.

### Mitigación aplicada
`vercel.json` con `"ignored": "exit 0"` en `redesign/central-operaciones`
saltea los builds de ese branch. **No aplica a los PRs abiertos ni a futuros
merges a `main`.**

### Resolución definitiva (dashboard de Vercel)
Project → Settings → Git → **Ignored Build Step** = `exit 0`, o **Pause
Deployments**. Cuando se quiera desplegar, revertir/eliminar el archivo.