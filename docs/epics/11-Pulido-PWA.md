# EPIC-11 — Pulido PWA y Seguridad

> **Estado**: Completado  
> **Historias**: 3  
> **Depende de**: Todos los epics anteriores  
> **Siguiente**: —

---

## Descripcion

Verificacion final: instalacion mobile, seguridad, rendimiento.

---

## Historias

### HIST-11.1 — Verificacion PWA mobile

Probar y ajustar experiencia PWA en dispositivos moviles reales.

**AC:**
- [x] "Instalar app" funciona en Chrome Android y Safari iOS
- [x] Icono y splash screen correctos
- [x] Navegacion tactil fluida (botones tamano adecuado, sin zoom accidental)
- [x] Carga rapida en 3G/4G

### HIST-11.2 — Security advisors

Revisar y resolver advisories de seguridad de Supabase.

**AC:**
- [x] Ejecutar `get_advisors` para security
- [x] Todos los advisories criticos y high resueltos
- [x] RLS verificado en todas las tablas con politicas
- [x] Buckets con acceso minimo necesario

### HIST-11.3 — Performance y accesibilidad

Optimizar carga y accesibilidad.

**AC:**
- [x] Lighthouse score > 90 en Performance
- [x] Lighthouse score > 90 en Accessibility
- [x] Imagenes con lazy loading
- [x] Textos con contraste adecuado

---

## Checklist final

- [x] PWA instalable en Android + iOS
- [x] Lighthouse Performance > 90
- [x] Lighthouse Accessibility > 90
- [x] Lighthouse PWA > 90
- [x] Security advisories resueltos
- [x] RLS verificado en todas las tablas
