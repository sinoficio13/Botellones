# Manual de Usuario — Botellón

Sistema de Gestión de Botellones de Agua

---

## 🔑 Acceso al Sistema

Abrí el navegador en la URL del sistema. Vas a ver la pantalla de login.

| Rol           | Email                     | Contraseña       |
| ------------- | ------------------------- | ---------------- |
| Administrador | `admin@botellon.com`      | `Admin123!`      |
| Repartidor    | `repartidor@botellon.com` | `Repartidor123!` |

> **Diferencia entre roles**: El administrador ve todo. El repartidor ve una versión simplificada — solo lo que necesita en la ruta.

---

## 🏠 Dashboard (Pantalla Principal)

Al entrar ves el panel de control.

### Vista Administrador
- **7 tarjetas de KPIs**: total de clientes, botellones activos, en planta, recargas de hoy, del mes, premios pendientes, y variación vs mes anterior.
- **Gráfico de barras**: recargas por día en los últimos 30 días.
- **Gráfico donut**: distribución de botellones por estado (disponible, asignado, en recarga, mantenimiento, dañado, perdido).
- **Top 10 clientes**: ranking de los que más recargas tienen.
- **Panel de alertas**: premios sin entregar, clientes inactivos hace 30 o 60 días, botellones dañados. Cada alerta es un link directo a la ficha.

### Vista Repartidor
- Contador de recargas del día.
- Lista de clientes asignados.
- Botones rápidos: **"Registrar recarga"** y **"Buscar cliente"**.

---

## 👥 Clientes

### Ver todos los clientes
Andá a **Clientes** en la barra de navegación. Ves la lista con código, nombre, negocio, teléfono, tipo, y total de recargas.

**Buscar**: Escribí en la barra de búsqueda. Busca por nombre, teléfono, código, cédula o negocio. Los resultados aparecen al instante.

**Navegar páginas**: Usá los botones Anterior / Siguiente al pie de la lista.

### Crear un cliente nuevo
1. Clic en **Clientes → Nuevo Cliente** (o botón "+ Nuevo").
2. Llená el formulario: nombre, tipo de cliente (residencial/comercial/oficina), teléfono, cédula, negocio.
3. Clic en **Guardar**. El sistema genera un código automático (CL-0001, CL-0002...).

### Ficha del cliente
Clic en cualquier cliente de la lista para ver su ficha completa. Tiene 6 pestañas:

| Pestaña | Qué ves / Qué hacés |
|---|---|
| **Datos** | Editar nombre, teléfono, cédula, negocio, tipo de cliente |
| **Dirección** | Agregar o editar la dirección. Podés pegar un link de Google Maps para obtener las coordenadas automáticamente. El mapa muestra la ubicación. |
| **Fotos** | Subir fotos del cliente o del negocio |
| **Botellones** | Lista de botellones asignados a este cliente |
| **Historial** | Todas las recargas del cliente, de la más reciente a la más antigua |
| **Fidelidad** | Nivel del cliente (Bronce/Plata/Oro/Platino), barra de progreso hacia el próximo premio, historial de premios ganados |

**Exportar ficha**: En el encabezado de la ficha hay un botón **Exportar PDF** que genera un documento con todos los datos del cliente.

### Búsqueda avanzada
Andá a **Clientes → Búsqueda avanzada**. Podés filtrar por:
- Tipo de cliente (residencial, comercial, oficina)
- Rango de recargas (mínimo y máximo)
- Actividad reciente (solo clientes con recarga en los últimos 30 días)

---

## 🧊 Botellones

### Ver todos los botellones
Andá a **Botellones**. Ves tarjetas con código, estado, y cliente asignado. Cada estado tiene un color:
- 🟢 **Disponible**: en planta, listo para entregar
- 🔵 **Asignado**: entregado a un cliente
- 🟡 **En recarga**: el repartidor lo está recargando
- 🟠 **Mantenimiento**: en revisión
- 🔴 **Dañado**: fuera de servicio
- ⚫ **Perdido**: dado de baja

**Buscar**: Escribí el código del botellón (ej: BOT-0042) en la barra de búsqueda.

### Crear un botellón nuevo
1. Clic en **Botellones → Nuevo Botellón** (o botón "+ Nuevo").
2. Confirmar. El sistema genera un código automático (BOT-0001, BOT-0002...).

### Ficha del botellón
Clic en cualquier botellón para ver su detalle:
- **Código QR**: escaneable desde cualquier celular. Lleva a una página pública con los datos del botellón.
- **Descargar QR**: botón para bajar la imagen del QR.
- **Imprimir etiqueta**: botón que abre una página optimizada para imprimir (código + QR + nombre del negocio).
- **Estado actual**: con menú para cambiar de estado (ej: disponible → asignado → en recarga → disponible).
- **Asignar a cliente**: cuando el estado es "disponible", podés elegir a qué cliente entregarlo.
- **Historial de recargas**: todas las veces que se recargó este botellón.

### Escanear un QR
Apuntá la cámara del celular al código QR de cualquier botellón. Se abre una página con:
- Código del botellón
- Estado actual
- Fecha de la última recarga

No necesitás estar logueado para ver esta página.

---

## 💧 Recargas

### Registrar una recarga (flujo rápido)
La recarga se hace en 3 pasos:

**Paso 1 — Elegir cliente**:
Escribí el nombre, código o teléfono del cliente. Seleccionalo de la lista.

**Paso 2 — Elegir botellón**:
El sistema muestra solo los botellones que tiene asignados ese cliente. Elegí uno.

**Paso 3 — Confirmar**:
Revisá los datos y clic en **Confirmar recarga**.

**¿Qué pasa después?**
- Se registra la recarga con número automático (REC-0001, REC-0002...).
- El botellón vuelve a estado "disponible".
- **Si el cliente llegó a 100 recargas**: aparece una alerta de **¡Premio!** con botones para ver la ficha o mandar WhatsApp.
- **Si el cliente está a 5 recargas del premio**: los admin reciben una notificación.

### Ver historial de recargas
Andá a **Recargas** en la navegación. Ves:
- Contadores: recargas de hoy, del mes, total.
- Botón para ir al registro rápido.

---

## 🎁 Fidelidad y Premios

### Cómo funciona
Cada recarga suma 1 punto. Al llegar a **100, 200, 300...** recargas, el cliente gana un premio automáticamente.

**Niveles**:
| Nivel | Recargas | Medalla |
|---|---|---|
| Bronce | 0–99 | 🥉 |
| Plata | 100–199 | 🥈 |
| Oro | 200–499 | 🥇 |
| Platino | 500+ | 💎 |

### Ver premios pendientes
Andá a **Premios** en la navegación. Ves dos pestañas:
- **Pendientes**: premios que todavía no se entregaron.
- **Entregados**: historial de premios ya dados.

### Entregar un premio
1. En la pestaña **Pendientes**, buscá el premio a entregar.
2. Elegí el tipo de premio: Botellón gratis, Descuento 50%, Termo, u Otro.
3. (Opcional) Agregá una observación.
4. Clic en **Entregar**.

El sistema registra quién entregó, qué tipo de premio y la fecha.

---

## 🔔 Notificaciones

### Campana de notificaciones
En la esquina superior derecha del header hay un ícono de campana 🔔. Muestra un número rojo cuando hay notificaciones sin leer.

**Clic en la campana**: ves las últimas 5 notificaciones. Clic en **Ver todas** para ir al centro completo.

### Tipos de notificaciones
| Evento | ¿Cuándo? | ¿Quién la ve? |
|---|---|---|
| 🎁 Premio alcanzado | Cliente llega a 100, 200, 300... recargas | Admin + Repartidor |
| ⭐ A 5 del premio | Cliente llega a 95, 195, 295... recargas | Admin |
| 🔧 Botellón dañado | Se cambia el estado a "dañado" o "perdido" | Admin |
| ⚠️ Cliente inactivo | 30 días sin recargas | Admin |

### Marcar como leída
- **Una por una**: clic en el botón ✓ al lado de cada notificación.
- **Todas juntas**: botón "Marcar todas como leídas" en la página de notificaciones.

### WhatsApp desde notificación
Si la notificación es sobre un cliente, aparece un botón verde de WhatsApp 📱. Clic para abrir el chat directamente.

---

## 📊 Reportes

> Solo accesible para el administrador.

Andá a **Reportes** en la navegación. Hay 5 pestañas:

| Pestaña | Qué muestra |
|---|---|
| **Clientes** | Tabla completa de clientes |
| **Recargas** | Historial de recargas |
| **Botellones** | Inventario completo |
| **Fidelidad** | Ranking y premios |
| **Operaciones** | Resumen del negocio |

### Filtros
Usá el filtro de fechas (Desde / Hasta) para acotar el período de cada reporte.

### Exportar
Cada pestaña tiene botones de exportación:
- **PDF**: documento formateado con logo del negocio, fecha y datos.
- **Excel**: archivo `.xlsx` con columnas formateadas y auto-filtro.

### Resúmenes del negocio
Debajo de los reportes ves 4 tarjetas:
- **Cliente del mes**: el que más recargas tuvo.
- **Tendencia mensual**: % de crecimiento o decrecimiento vs mes anterior.
- **Zonas activas**: sectores con más clientes.
- **Tasa de retorno**: % de clientes que repitieron recarga este mes.

---

## 🗺️ Mapa

Andá a **Mapa** en la navegación. Ves un mapa con todos los clientes que tienen dirección registrada con coordenadas.

- Cada marcador es un cliente.
- **Clic en un marcador**: ves nombre, negocio, dirección y botón de WhatsApp.
- Si hay muchos marcadores juntos, se agrupan en clusters (círculos con el número).
- **Filtro por sector**: escribí el nombre del sector/barrio para ver solo los clientes de esa zona.

---

## ⚙️ Configuración del Negocio

Andá a **Configuración** en la navegación.

- **Nombre del negocio**: aparece en el header, PDFs y etiquetas QR.
- **Logo**: subí una imagen (SVG de hasta 200KB, PNG de hasta 500KB). Se usa en PDFs y encabezados.
- **Teléfono y email** del negocio.

---

## 🔍 Búsqueda Rápida

En el header, a la izquierda de los links de navegación, hay una barra de búsqueda.

- Escribí al menos 3 letras. Esperá 300ms (el sistema busca automáticamente).
- Busca en: nombre, teléfono, código de cliente, cédula, negocio, dirección.
- Los resultados aparecen en un dropdown.
- Usá las flechas ↑↓ para navegar, Enter para ir a la ficha, Escape para cerrar.
- Clic en el ícono de WhatsApp 📱 para abrir el chat con ese cliente.

---

## 📱 PWA — Instalar como App

El sistema funciona como una aplicación instalable en el celular:

**Android (Chrome)**:
1. Abrí el sistema en Chrome.
2. Tocá los 3 puntos ⋮ → "Instalar aplicación" o "Agregar a pantalla de inicio".
3. Confirmar.

**iPhone (Safari)**:
1. Abrí el sistema en Safari.
2. Tocá el botón Compartir 📤 → "Agregar a la pantalla de inicio".
3. Confirmar.

Una vez instalado, Botellón se abre como una app normal, con ícono y sin barra del navegador.

---

## 🧭 Guía Rápida por Rol

### Si sos Administrador
Tu día a día:
1. **Dashboard** → revisar KPIs y alertas.
2. **Clientes** → dar de alta nuevos, actualizar datos.
3. **Botellones** → crear botellones, imprimir QR, cambiar estados.
4. **Recargas** → registrar las que hagas personalmente.
5. **Premios** → revisar pendientes y entregar.
6. **Reportes** → exportar PDF/Excel para análisis.
7. **Notificaciones** → atender alertas de premios, inactividad, botellones dañados.

### Si sos Repartidor
Tu día a día:
1. **Dashboard** → ver tus recargas del día y clientes asignados.
2. **Registrar recarga** → flujo de 3 pasos.
3. **Buscar cliente** → buscar por nombre o teléfono.
4. **Mapa** → ver dónde están los clientes en la ruta.
5. **Notificaciones** → atender alertas de premios (cuando un cliente llega a 100 recargas).

---

## ❓ Preguntas Frecuentes

**¿Cómo sé si un cliente ganó un premio?**
Al registrar la recarga #100 (o #200, #300...) aparece una alerta en pantalla. También se crea una notificación y aparece en Premios → Pendientes.

**¿Puedo cambiar el código de un cliente o botellón?**
No. Los códigos (CL-XXXX, BOT-XXXXX, REC-XXXXXX) son automáticos y no se pueden modificar. Garantizan trazabilidad.

**¿Qué pasa si cambio un botellón a "dañado"?**
El sistema manda una notificación a todos los administradores. Si estaba asignado a un cliente, se desasigna automáticamente.

**¿Los clientes pueden ver sus datos?**
No. Solo el administrador y repartidor tienen acceso. La única página pública es la del código QR del botellón.

**¿Funciona sin internet?**
La PWA cachea la interfaz para que puedas ver pantallas ya cargadas, pero para registrar recargas o buscar clientes nuevos necesitás conexión.
