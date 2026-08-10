# EPIC-7 — Notificaciones

> **Estado**: Pendiente  
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
- [ ] Icono de campana en header con badge numerico de no leidas
- [ ] Click → dropdown con ultimas 5 notificaciones
- [ ] "Ver todas" → pagina `/notificaciones` con historial completo
- [ ] Filtro por tipo (premio, inactividad, botellon)
- [ ] Marcar individual o "Marcar todas como leidas"
- [ ] Cada notificacion es clickeable → lleva a la ficha correspondiente
- [ ] Badge se actualiza en tiempo real (Supabase Realtime)

### HIST-7.2 — Tipos de notificaciones automaticas

El sistema genera notificaciones automaticas para eventos clave.

**AC:**
- [ ] Cliente alcanza 100 recargas → notificacion para admin + repartidor
- [ ] Cliente 30 dias sin recarga → notificacion para admin (se ejecuta diariamente)
- [ ] Botellon cambia a "danado" o "perdido" → notificacion para admin
- [ ] Cliente a 5 recargas del premio (95, 195, 295...) → notificacion para admin

### HIST-7.3 — Notificacion con accion WhatsApp

Cada notificacion relevante incluye boton directo de WhatsApp.

**AC:**
- [ ] Notificaciones que referencian un cliente → boton WhatsApp visible
- [ ] Formato: `https://wa.me/CODIGO+NUMERO`
- [ ] Icono de WhatsApp reconocible

### HIST-7.4 — Supabase Realtime

Las notificaciones se reciben en tiempo real sin refrescar la pagina.

**AC:**
- [ ] Suscripcion a canal `notificaciones` con Supabase Realtime
- [ ] Nueva notificacion → aparece en dropdown inmediatamente
- [ ] Badge se actualiza automaticamente

---

## Tipos de notificacion

| Evento | Icono | Destinatario |
|---|---|---|
| Premio alcanzado (100, 200, 300...) | 🎁 | Admin + Repartidor |
| Inactividad 30 dias | ⚠️ | Admin |
| Botellon danado/perdido | 🔧 | Admin |
| A 5 recargas del premio | ⭐ | Admin |
