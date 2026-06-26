# Feature 3: Exportar Reportes PDF — Diseño

**Fecha:** 2026-06-26

## Contexto

El dashboard ya tiene datos de avance, Gantt y financiero. Esta feature agrega una nueva tab "Reporte" donde el usuario selecciona un periodo y las secciones a incluir, luego abre una vista de impresión que usa el print nativo del browser para exportar a PDF.

## Flujo de usuario

1. Click en tab "📄 Reporte"
2. Seleccionar periodo con chips: semanas predefinidas o rango manual (Día X al Día Y)
3. Seleccionar secciones con checkboxes (todas activadas por defecto)
4. Click en "Vista previa y exportar"
5. Se abre ventana nueva con el reporte renderizado
6. Instrucción en pantalla: "Presiona Cmd+P (Mac) o Ctrl+P (Windows) → Guardar como PDF"
7. Botón "🖨️ Imprimir" que llama `window.print()` directamente

## Arquitectura

```
src/components/
  ReporteView.jsx      ← controles: periodo + checkboxes + botón preview
  ReportePDF.jsx       ← HTML del reporte renderizado, CSS @media print
```

`ReporteView` abre una ventana con `window.open()` e inyecta el HTML de `ReportePDF` renderizado. Alternativamente puede abrir una ruta `/reporte` con `window.open('/reporte?...')` pasando parámetros por query string — pero dado que los datos están en Supabase, es más simple pasar los datos serializados directamente al abrir la ventana via localStorage temporal.

**Mecanismo de datos entre ventanas:**
1. `ReporteView` serializa `{ obra, partidas, config }` en `localStorage` con key `reporte_preview`
2. Abre `window.open('/reporte-preview')` — ruta nueva en la app
3. `ReportePDF` lee de `localStorage`, limpia la key, renderiza

**Nueva ruta `/reporte-preview`:** agregada en App.jsx detectando `window.location.pathname`.

## Componente ReporteView

**Selector de periodo (chips):**
- Chips predefinidos generados automáticamente: "Semana 1 (Días 1-7)", "Semana 2 (Días 8-14)", etc. hasta cubrir `obra.total_dias`
- Chip "Todo" = días 1 a `obra.total_dias`
- Inputs manuales: "Día ___ al Día ___" con validación (ini < fin, ambos dentro de 1-total_dias)
- Un solo periodo activo a la vez

**Checkboxes de secciones:**
```
☑ Resumen ejecutivo
☑ Tabla de partidas
☑ Gantt del periodo
☑ Resumen financiero
```

**Botón "Vista previa y exportar":** deshabilitado si no hay ninguna sección seleccionada.

## Componente ReportePDF (ventana de preview)

**Header del reporte:**
- Nombre de la obra
- Periodo: "Días X al Y — Semana Z"
- Fecha de generación
- Logo texto: "Control Obra"

**Sección 1 — Resumen Ejecutivo:**
- Día actual de obra / total días
- % avance global real vs planificado
- Semáforo general (color + texto)
- Días restantes
- Partidas completadas en el periodo (avance pasó a 100%)

**Sección 2 — Tabla de Partidas:**
Columnas: N°, Partida, Cuadrilla, Avance %, Estado, Días planificados
- Filtrada: solo partidas cuya ventana (dia_ini, dia_fin) se intersecta con el periodo
- Color de estado: verde/amarillo/rojo/gris en la columna Estado
- Ordenada por cuadrilla y luego dia_ini

**Sección 3 — Gantt del Periodo:**
- Barras CSS horizontales por partida (no SVG, solo divs)
- Eje X: días del periodo seleccionado
- Barra gris = ventana planificada, barra de color = avance real
- Línea vertical = día actual
- Sin scroll horizontal, escala al ancho de la página

**Sección 4 — Resumen Financiero:**
- Monto total valorizado (avance_pct × subtotal por partida)
- Estimación estado de pago (85% del valorizado)
- % del presupuesto neto total
- Tabla top 5 partidas por monto valorizado

**CSS @media print:**
- Ocultar header con botón de imprimir
- Ocultar instrucción "Presiona Cmd+P"
- Fondo blanco, texto negro
- Colores de semáforo adaptados para impresión (mantener como color o usar íconos)
- Saltos de página automáticos entre secciones si es necesario (`page-break-before: always`)

## Cambios en archivos existentes

**`src/App.jsx`:**
- Detectar `window.location.pathname === '/reporte-preview'` al inicio y renderizar `ReportePDF` en lugar del dashboard normal
- Agregar tab "📄 Reporte" en la navegación (5ta tab)
- Pasar `obra` y `partidas` a `ReporteView`

## Scope fuera de v1

- Historial de reportes guardados
- Envío por email
- Logo personalizado del contratista
- Comparación entre dos periodos
