# EPIC-14 — Scanner Interno con Camara

> **Estado**: ⏳ Pendiente (opcional — segundo momento)
> **Historias**: 2
> **Depende de**: [[13-Recarga-Rapida-QR|EPIC-13 — Recarga Rapida desde QR]]
> **Siguiente**: —

---

## Descripcion

Agregar un scanner con camara DENTRO del sistema (dashboard) para que el admin/repartidor escanee el QR del botellon directamente desde la app y salte al flujo de recarga rapida sin salir del sistema.

---

## Historias

### HIST-14.1 — Boton "Escanear QR" con camara

Agregar un boton en el dashboard que abre la camara y decodifica el codigo QR.

**AC:**
- [ ] Boton "Escanear QR" visible para admin/repartidor
- [ ] Acceso a camara via `getUserMedia` (requiere HTTPS o localhost)
- [ ] Decodificacion del QR con `jsqr` o `html5-qrcode`
- [ ] Valida que el QR sea de un botellon (`/b/BOT-XXXXX`)
- [ ] Manejo de permiso denegado / camara no disponible

### HIST-14.2 — Decode QR → flujo de recarga rapida

Al leer un codigo valido, ir directo al flujo de recarga rapida (EPIC-13).

**AC:**
- [ ] Extrae el codigo `BOT-XXXXX` del QR
- [ ] Redirige a `/recargas/nueva?botellon_id=X`
- [ ] Si el QR no es de botellon → mensaje de error claro

---

## Notas

- Requiere HTTPS (o localhost) para acceso a camara en el navegador.
- En iOS/Safari, `getUserMedia` solo funciona en contexto seguro.
- Se puede instalar como PWA para que la camara funcione como app nativa.
- Para desarrollo local con camara (por fuera de `localhost`), usar `next dev --experimental-https`, que genera un certificado autofirmado y sirve la app sobre HTTPS.
