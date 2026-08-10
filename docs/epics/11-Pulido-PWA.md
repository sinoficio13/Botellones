# EPIC-11 — Pulido PWA y Seguridad

> **Estado**: Pendiente  
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
- [ ] "Instalar app" funciona en Chrome Android y Safari iOS
- [ ] Icono y splash screen correctos
- [ ] Navegacion tactil fluida (botones tamano adecuado, sin zoom accidental)
- [ ] Carga rapida en 3G/4G

### HIST-11.2 — Security advisors

Revisar y resolver advisories de seguridad de Supabase.

**AC:**
- [ ] Ejecutar `get_advisors` para security
- [ ] Todos los advisories criticos y high resueltos
- [ ] RLS verificado en todas las tablas con politicas
- [ ] Buckets con acceso minimo necesario

### HIST-11.3 — Performance y accesibilidad

Optimizar carga y accesibilidad.

**AC:**
- [ ] Lighthouse score > 90 en Performance
- [ ] Lighthouse score > 90 en Accessibility
- [ ] Imagenes con lazy loading
- [ ] Textos con contraste adecuado

---

## Checklist final

- [ ] PWA instalable en Android + iOS
- [ ] Lighthouse Performance > 90
- [ ] Lighthouse Accessibility > 90
- [ ] Lighthouse PWA > 90
- [ ] Security advisories resueltos
- [ ] RLS verificado en todas las tablas
