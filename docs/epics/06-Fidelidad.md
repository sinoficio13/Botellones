# EPIC-6 — Sistema de Fidelidad

> **Estado**: Pendiente  
> **Historias**: 4  
> **Depende de**: [[05-Recargas|EPIC-5 — Recargas]]  
> **Siguiente**: [[08-Panel-Reportes|EPIC-8 — Panel y Reportes]]

---

## Descripcion

Cada 100 recargas = premio. El admin elige que entregar. El repartidor ve la alerta en ruta. El cliente ve su progreso.

---

## Historias

### HIST-6.1 — Deteccion automatica de premios

Al registrar una recarga, el sistema detecta si el cliente alcanzo un multiplo de 100 y genera un premio pendiente.

**AC:**
- [ ] Logica: despues de cada INSERT en `recargas`, verificar `COUNT(*) % 100 === 0`
- [ ] Si alcanza 100, 200, 300... → INSERT en `premios` con estado "pendiente"
- [ ] No genera duplicados (verificar que no exista premio para ese nivel)
- [ ] Registra: cliente_id, nivel_recargas, fecha_alcanzado

### HIST-6.2 — Gestion de premios (admin)

Panel para que el admin vea premios pendientes, elija tipo y marque como entregado.

**AC:**
- [ ] Lista de premios pendientes
- [ ] Lista de premios entregados (historico)
- [ ] Modal para entregar premio: elegir tipo (botellon gratis, descuento 50%, termo, otro) + observaciones
- [ ] Al marcar entregado: se registra fecha, usuario que entrega, tipo de premio

### HIST-6.3 — Barra de progreso en ficha del cliente

Indicador visual de progreso hacia el proximo premio + nivel actual.

**AC:**
- [ ] Barra circular: "67 / 100 recargas" con progreso hacia proximo multiplo
- [ ] Insignia de nivel: Bronce (0-99), Plata (100-199), Oro (200-499), Platino (500+)
- [ ] Si esta en nivel con premio pendiente → badge "Premio pendiente"
- [ ] Se actualiza en tiempo real tras cada recarga

### HIST-6.4 — Alerta al repartidor

Cuando el repartidor registra la recarga que dispara un premio, ve una notificacion inmediata.

**AC:**
- [ ] Toast/popup al confirmar recarga: "Juan Perez alcanzo 100 recargas! Tiene un premio pendiente."
- [ ] Botones: "Ver ficha", "WhatsApp"
- [ ] Tambien se crea notificacion en el centro de notificaciones (EPIC-7)

---

## Niveles de fidelidad

| Nivel | Recargas | Insignia |
|---|---|---|
| Bronce | 0-99 | 🥉 |
| Plata | 100-199 | 🥈 |
| Oro | 200-499 | 🥇 |
| Platino | 500+ | 💎 |

## Tipos de premio

- Botellon gratis
- Descuento 50%
- Termo
- Otro (definido por admin)
