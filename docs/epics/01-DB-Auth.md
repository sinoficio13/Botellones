# EPIC-1 — Base de Datos y Autenticación

> **Estado**: 🟢 Completado  
> **Historias**: 7  
> **Depende de**: [[00-Fundacion|EPIC-0 — Fundación]]  
> **Siguiente**: [[02-Config-Negocio|EPIC-2]], [[03-Clientes|EPIC-3]], [[04-Botellones-QR|EPIC-4]], [[07-Notificaciones|EPIC-7]]

---

## Descripción

Las tablas existen, los usuarios entran con su rol y los datos están protegidos por RLS.

---

## Historias

### HIST-1.1 — Migración SQL completa

Crear migración en Supabase con todas las tablas del sistema.

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

**AC:**
- [x] Todas las tablas creadas con tipos correctos
- [x] Foreign keys definidas
- [x] Índices creados (clientes.nombre, clientes.telefono, recargas.cliente_id, recargas.fecha, notificaciones.usuario_id)

### HIST-1.2 — Secuencias para códigos

Crear secuencias Postgres para generación de códigos únicos.

**AC:**
- [x] Secuencia `cliente_codigo_seq` → formato `CL-XXXX`
- [x] Secuencia `botellon_codigo_seq` → formato `BOT-XXXXX`
- [x] Concurrent-safe (usar `nextval` en transacción)

### HIST-1.3 — RLS policies

Activar Row Level Security en todas las tablas con políticas por rol.

**AC:**
- [x] Admin: SELECT, INSERT, UPDATE, DELETE en todas las tablas
- [x] Repartidor: SELECT en todas las tablas, INSERT en recargas, clientes, fotos_clientes
- [x] Repartidor NO puede UPDATE ni DELETE salvo sus propias recargas del día
- [x] Política pública: SELECT en botellones (código, total_recargas, última recarga) para página QR

### HIST-1.4 — Buckets de Storage

Configurar buckets privados con políticas de acceso.

**AC:**
- [x] Bucket `fotos-clientes`: solo usuarios autenticados pueden leer/escribir
- [x] Bucket `logos`: solo admin puede escribir, todos autenticados pueden leer
- [x] URLs firmadas para acceso temporal a archivos

### HIST-1.5 — Login page

Página de login con email/contraseña usando Supabase Auth.

**AC:**
- [x] Formulario con validación (email requerido, contraseña min 6 chars)
- [x] Mensaje de error claro si credenciales inválidas
- [x] Redirección al dashboard tras login exitoso
- [x] Responsive mobile-first

### HIST-1.6 — Middleware y roles

Middleware de Next.js que protege rutas y redirige según rol.

**AC:**
- [x] Rutas bajo `/(dashboard)` requieren sesión
- [x] Rutas de admin (`/configuracion`) solo accesibles con rol admin
- [x] Usuario sin sesión → redirigido a `/login`
- [x] Repartidor intentando acceder ruta admin → redirigido a dashboard

### HIST-1.7 — Seed de admin inicial

Script SQL que crea el primer usuario administrador.

**AC:**
- [x] Usuario admin creado en `auth.users`
- [x] Perfil creado con rol `admin` en `app_metadata`
- [x] Email y contraseña definidos

---

## Tablas (resumen)

| Tabla | Descripción | FK |
|---|---|---|
| `perfiles` | Datos del usuario | auth.users |
| `clientes` | Clientes con datos completos | — |
| `direcciones` | Dirección + GPS por cliente | clientes |
| `fotos_clientes` | Fotos por cliente | clientes |
| `botellones` | Botellones con estado | clientes |
| `recargas` | Registro de cada recarga | clientes, botellones |
| `premios` | Premios de fidelidad | clientes |
| `configuracion` | Datos del negocio (single row) | — |
| `notificaciones` | Notificaciones por usuario | perfiles |
