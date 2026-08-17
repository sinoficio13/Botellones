# EPIC-13 — Recarga Rapida desde QR

> **Estado**: ⏳ Pendiente
> **Historias**: 4
> **Depende de**: [[12-QR-Publico-Rediseno|EPIC-12 — QR Publico Rediseñado]]
> **Siguiente**: [[14-Scanner-Interno|EPIC-14 — Scanner Interno]]

---

## Descripcion

Hacer que el mismo QR (`/b/[codigo]`) tenga doble funcion:
1. **Publico (anonimo)**: el cliente ve un resumen de su botellon (ya cubierto en EPIC-12).
2. **Interno (admin/repartidor logueado)**: al escanear el QR, aparece un boton "Registrar recarga" que permite cargar el botellon en 1 tap.

El QR no cambia; es la pagina la que detecta la sesion y muestra la accion extra.

---

## Historias

### HIST-13.1 — Pagina session-aware

Detectar si quien abre `/b/[codigo]` esta logueado (admin o repartidor) usando la sesion existente (dev cookie `botellon_dev_session` o Supabase auth).

**AC:**
- [ ] Si hay sesion de admin/repartidor → renderiza la accion de recarga
- [ ] Si es anonimo → solo el resumen (sin acciones internas)
- [ ] La deteccion funciona en dev mode y en produccion

### HIST-13.2 — getBotellonByCodigo devuelve id + cliente_id

Ampliar la query para que la pagina interna tenga los datos necesarios para la recarga.

**AC:**
- [ ] Devuelve `id` del botellon
- [ ] Devuelve `cliente_id` (si esta asignado)
- [ ] No expone datos del cliente a anonimos

### HIST-13.3 — Boton "Registrar recarga" (1 tap)

Para usuarios logueados, mostrar un boton prominente que lleva a la recarga rapida con el botellon preseleccionado.

**AC:**
- [ ] Boton visible solo para admin/repartidor logueado
- [ ] Click → `/recargas/nueva?botellon_id=X` (preseleccion nueva)
- [ ] El flujo confirma la recarga en 1 tap
- [ ] Feedback de exito tras registrar

### HIST-13.4 — Manejo de botellon sin cliente asignado

Si el botellon no tiene cliente asignado, no se puede recargar directamente.

**AC:**
- [ ] Aviso claro: "Este botellon no tiene cliente asignado"
- [ ] Link para asignar cliente (botellon en planta)

---

## Notas

- La recarga rapida requiere que el botellon tenga `cliente_id` (un botellon entregado a un cliente).
- El flujo de recarga existente (`/recargas/nueva`) hoy preselecciona por `cliente_id`; hay que agregar soporte para preseleccionar por `botellon_id`.
- La accion de recarga es SOLO para admin/repartidor; el cliente final nunca la ve.
