# EPIC-9 — Busqueda y Mapa General

> **Estado**: Pendiente  
> **Historias**: 3  
> **Depende de**: [[03-Clientes|EPIC-3 — Clientes]]  
> **Siguiente**: [[10-PDF-Excel|EPIC-10 — PDF + Excel]]

---

## Descripcion

Busqueda global rapida y mapa con todos los clientes ubicados.

---

## Historias

### HIST-9.1 — Busqueda global

Barra de busqueda en header que busca en clientes por multiples campos.

**AC:**
- [ ] Input con debounce (300ms)
- [ ] Busca por: nombre, telefono, codigo cliente, cedula, negocio, direccion (ILIKE en Postgres)
- [ ] Resultados en dropdown debajo del input
- [ ] Cada resultado: codigo, nombre, negocio, telefono, WhatsApp
- [ ] Click en resultado → ficha del cliente

### HIST-9.2 — Mapa general de clientes

Mapa Leaflet con todos los clientes que tienen coordenadas GPS.

**AC:**
- [ ] Ruta `/mapa` con mapa full-screen
- [ ] Marcadores para cada cliente con coordenadas
- [ ] Si hay +50 marcadores → clusterizacion (Leaflet.markercluster)
- [ ] Click en marcador → popup con: nombre, negocio, direccion, boton "Ver ficha", boton WhatsApp
- [ ] Solo muestra clientes con lat/lng definidas
- [ ] Sin API key (OpenStreetMap tiles gratuitos)

### HIST-9.3 — Busqueda con filtros avanzados

Pagina de busqueda avanzada con filtros combinables.

**AC:**
- [ ] Ruta `/clientes/buscar`
- [ ] Filtros: tipo de cliente, rango de recargas, con/sin actividad reciente, por sector
- [ ] Resultados en tabla con las mismas acciones que la lista de clientes

---

## Stack

| Componente | Libreria |
|---|---|
| Mapas | Leaflet + OpenStreetMap |
| Cluster | Leaflet.markercluster |
| Busqueda | ILIKE en Postgres + debounce (300ms) |
