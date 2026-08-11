# EPIC-7 — Notificaciones

> **Estado**: Completado  
> **Historias**: 4  
> **Depende de**: [[01-DB-Auth|EPIC-1 — DB + Auth]]  
> **Siguiente**: [[08-Panel-Reportes|EPIC-8 — Panel y Reportes]]

---

## Descripcion

Campanita con badge de no leidas. Cada alerta del sistema se puede revisar 1 a 1. WhatsApp a un click.

---

## Historias

### HIST-7.1 — Centro de notificaciones (UI)

Componente de campanita en header + panel desplegable con lista de notificaciones.

**AC:**
- [x] Icono de campana en header con badge numerico de no leidas
- [x] Click → dropdown con ultimas 5 notificaciones
- [x] "Ver todas" → pagina `/notificaciones` con historial completo
- [x] Filtro por tipo (premio, inactividad, botellon)
- [x] Marcar individual o "Marcar todas como leidas"
- [x] Cada notificacion es clickeable → lleva a la ficha correspondiente
- [x] Badge se actualiza en tiempo real (Supabase Realtime)

### HIST-7.2 — Tipos de notificaciones automaticas

El sistema genera notificaciones automaticas para eventos clave.

**AC:**
- [x] Cliente alcanza 100 recargas → notificacion para admin + repartidor
- [x] Cliente 30 dias sin recarga → notificacion para admin (se ejecuta diariamente)
- [x] Botellon cambia a "danado" o "perdido" → notificacion para admin
- [x] Cliente a 5 recargas del premio (95, 195, 295...) → notificacion para admin

### HIST-7.3 — Notificacion con accion WhatsApp

Cada notificacion relevante incluye boton directo de WhatsApp.

**AC:**
- [x] Notificaciones que referencian un cliente → boton WhatsApp visible
- [x] Formato: `https://wa.me/CODIGO+NUMERO`
- [x] Icono de WhatsApp reconocible

### HIST-7.4 — Supabase Realtime

Las notificaciones se reciben en tiempo real sin refrescar la pagina.

**AC:**
- [x] Suscripcion a canal `notificaciones` con Supabase Realtime
- [x] Nueva notificacion → aparece en dropdown inmediatamente
- [x] Badge se actualiza automaticamente

---

## Tipos de notificacion

| Evento | Icono | Destinatario |
|---|---|---|
| Premio alcanzado (100, 200, 300...) | 🎁 | Admin + Repartidor |
| Inactividad 30 dias | ⚠️ | Admin |
| Botellon danado/perdido | 🔧 | Admin |
| A 5 recargas del premio | ⭐ | Admin |
