# Feature 2: Multi-proyecto — Diseño

**Fecha:** 2026-06-26

## Contexto

Actualmente la app carga siempre la obra más reciente de Supabase. Esta feature agrega soporte para múltiples proyectos: un selector al inicio y la capacidad de crear nuevos proyectos subiendo los xlsx desde el browser.

## Comportamiento

**Al cargar la app:**
- Si hay 1 sola obra → carga directamente (comportamiento actual, sin cambio)
- Si hay 2+ obras → muestra `ProyectoSelector` antes del dashboard

**ProyectoSelector:**
- Lista de obras con: nombre, fecha inicio, días restantes, % avance global (calculado desde partidas)
- Botón "➕ Nueva Obra" → navega a `NuevaObra`
- Click en una obra → carga ese dashboard

**NuevaObra:**
1. Campo: nombre del proyecto (texto)
2. Campo: fecha de inicio (date picker)
3. Upload: archivo Presupuesto.xlsx
4. Upload: archivo Carta_Gantt.xlsx
5. Botón "Importar" → procesa los archivos → muestra progreso → redirige al dashboard del nuevo proyecto

## Arquitectura

```
App.jsx
  └─ si obras.length > 1 → ProyectoSelector
       ├─ click obra → setObraSeleccionada(id) → dashboard normal
       └─ click Nueva Obra → NuevaObra
            ├─ FileReader lee xlsx en browser
            ├─ SheetJS (xlsx) parsea el contenido
            ├─ importar.js cruza presupuesto + gantt
            ├─ POST /rest/v1/obras
            ├─ POST /rest/v1/partidas (batch)
            └─ navega al dashboard de la nueva obra
```

## Nuevos archivos

**`src/lib/importar.js`** — lógica de parseo e importación (equivalente browser del script Python):
- `parsearPresupuesto(workbook)` → Map<numero, {seccion, nombre, unidad, cantidad, precio_unit, subtotal}>
- `parsearGantt(workbook)` → Array<{cuadrilla, numero, nombre, dia_ini, dia_fin}>
- `importarObra(nombre, fechaInicio, presupuestoFile, ganttFile)` → Promise<obraId>

**`src/components/ProyectoSelector.jsx`** — pantalla de selección:
- Lista de obras con stats (% avance, días restantes)
- Botón nueva obra

**`src/components/NuevaObra.jsx`** — formulario de importación:
- Inputs nombre + fecha
- File inputs para los 2 xlsx
- Barra de progreso durante importación
- Manejo de errores si el formato xlsx no coincide

## Cambios en archivos existentes

**`src/App.jsx`:**
- `useObra` reemplazado por `useObras` (plural) que trae todas las obras
- Estado local `obraSeleccionada` (null = mostrar selector, uuid = mostrar dashboard)
- Si `obras.length === 1` → selecciona automáticamente la primera (sin cambio UX)

**`src/hooks/useObra.js`** → renombrar a `useObras.js`:
- Retorna `{ obras, loading, error }` (array en lugar de single)

## Dependencia nueva

`xlsx` (SheetJS) — librería para leer archivos xlsx en el browser:
```bash
npm install xlsx
```

## Formato esperado de los xlsx

La importación asume el mismo formato que los archivos del proyecto piloto:
- **Presupuesto:** columnas N°, Partida, Unidad, Cantidad, Precio Unit., Subtotal — con filas de sección en mayúsculas
- **Gantt:** columnas Cuadrilla/Especialidad, Sección, N°, Partida, Unidad, Cantidad, Rendimiento, Cuadrilla-días, Ventana Día Ini, Ventana Día Fin

Si el formato no coincide, se muestra un error claro: "El archivo no tiene el formato esperado. Verifica que sea un presupuesto/Gantt válido."

## Scope fuera de v1

- Editar nombre/fecha de una obra existente
- Eliminar obra
- Compartir enlace directo a una obra específica (URL con obra_id)
- Importar desde Google Sheets
