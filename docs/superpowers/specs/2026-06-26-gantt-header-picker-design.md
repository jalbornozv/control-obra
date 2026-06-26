# Gantt Header Picker — Design Spec

**Date:** 2026-06-26  
**Goal:** Hacer el import de Carta Gantt agnóstico al formato xlsx. Cuando el auto-parse falla, mostrar una tabla interactiva para que el usuario indique qué fila es el encabezado, y confirmar las columnas detectadas antes de importar.

---

## Problema

El parser actual busca "Cuadrilla / Especialidad" en columna A para encontrar la fila de encabezados. Formatos alternativos (ej: v2 donde columna A es "Sección") hacen que el parse falle completamente. La solución debe funcionar para cualquier formato futuro sin cambios de código.

---

## Arquitectura

### Flujo principal

```
Subir archivo Gantt
    ↓
parsearGantt() — intento automático
    ↓ éxito                    ↓ falla (GanttFormatError)
estado: auto-ok            estado: necesita-config
"✓ N partidas detectadas"  → mostrar GanttHeaderPicker inline
    ↓                              ↓ usuario selecciona fila + confirma
    └──── partidas en estado ──────┘
    ↓
Botón Importar/Actualizar habilitado
```

### Principio de diseño

El happy path (auto-parse funciona) no tiene interrupciones. El picker solo aparece como fallback.

---

## Cambios en `src/lib/importar.js`

### Nuevas funciones

**`leerFilasGantt(workbook)`**  
Retorna las primeras 20 filas crudas (`array[][]`) de la hoja Gantt. Sin parsear. Usado por el picker para mostrar la tabla al usuario.

**`parsearGanttDesdeHeader(workbook, headerRowIdx)`**  
Versión parametrizada del parser actual. Recibe el índice de fila de encabezado en vez de buscarlo. Reutiliza la detección inteligente de columnas por texto ("dia ini", "nombre", "cuadrilla", etc.).

**Clase `GanttFormatError`**  
Error especial que incluye `filas` (las filas crudas) para que el componente las muestre sin re-leer el archivo:
```js
class GanttFormatError extends Error {
  constructor(message, filas) {
    super(message)
    this.filas = filas
  }
}
```

**`parsearGantt(workbook)` — refactorizado**  
Se convierte en wrapper:
1. Llama `leerFilasGantt(wb)` para obtener filas
2. Busca header row automáticamente (lógica actual)
3. Si encuentra: llama `parsearGanttDesdeHeader(wb, idx)` y retorna
4. Si no encuentra: lanza `GanttFormatError` con las filas crudas

### Sin cambios

`parsearPresupuesto`, `importarObra`, `reimportarObra` — no se tocan. El presupuesto tiene parser robusto (detecta por patrón numérico).

---

## Nuevo componente `src/components/GanttHeaderPicker.jsx`

### Props

```
filas:        array[][]        — filas crudas del xlsx (máx 20)
workbook:     WorkbookObject   — para re-parsear cuando el usuario elige fila
onConfirmar:  (partidas[]) => void
onCancelar:   () => void
```

### Estados internos

| Estado | Descripción |
|--------|-------------|
| `seleccionando` | Tabla interactiva, ninguna fila elegida aún |
| `previewing` | Fila elegida, muestra columnas detectadas + mini-tabla |
| `error-fila` | Fila elegida no produce partidas válidas |

### UI — Estado `seleccionando`

- Instrucción: *"Haz click en la fila que contiene los nombres de columnas"*
- Tabla con las primeras 15 filas del xlsx
- Número de fila visible a la izquierda (1, 2, 3...)
- Celdas con texto truncado a ~20 chars
- Fila seleccionada resaltada en dorado (`var(--gold-bg)`, borde `var(--gold-bdr)`)
- Cada fila es clickeable (cursor pointer, hover sutil)

### UI — Estado `previewing`

Aparece debajo de la tabla al seleccionar una fila. Muestra:

```
Columnas detectadas:
  Nombre de partida  →  columna D
  Día inicio         →  columna I
  Día fin            →  columna J
  Cuadrilla          →  columna A   (o "no detectado")

Primeras 3 partidas:
  N°  | Nombre           | Días    | Cuadrilla
  1   | Demolición muros | 1 - 5   | Eléctrico
  2   | Retiro escombros | 3 - 8   | Civil
  3   | ...
```

Botón **"Confirmar y continuar"** — habilitado solo si hay partidas válidas.  
Botón **"Elegir otra fila"** — vuelve a estado `seleccionando`.

### UI — Estado `error-fila`

Mensaje inline: *"Esta fila no parece ser el encabezado — no se encontraron partidas. Prueba con otra."*  
El usuario puede hacer click en otra fila directamente.

---

## Integración en `NuevaObra.jsx` y `GestionProyectos.jsx`

### Estados del campo Gantt

```
idle            →  input file normal
procesando      →  "Leyendo carta Gantt..."
auto-ok         →  "✓ N partidas detectadas"  (badge verde)
necesita-config →  GanttHeaderPicker expandido inline debajo del input
configurado     →  "✓ N partidas (configurado manualmente)"  (badge verde)
```

### Comportamiento

- Al cambiar el archivo: intentar auto-parse inmediatamente
  - Éxito → `auto-ok`, partidas en estado local
  - `GanttFormatError` → `necesita-config`, pasar `error.filas` y `workbook` al picker
- El `workbook` queda en estado del componente (memoria) desde que se lee — no re-leer disco
- Botón "Importar" / "Actualizar" deshabilitado en estados `idle`, `procesando`, `necesita-config`
- Al confirmar en el picker → estado `configurado`, partidas en estado local
- La función `importarObra` / `reimportarObra` recibe las partidas pre-parseadas (array) como parámetro opcional. Si se pasan, omite el paso de parseo interno del Gantt. Si no se pasan, parsea el archivo normalmente (compatibilidad hacia atrás).

---

## Constraints

- Sin librerías nuevas
- El workbook vive en memoria del componente — no se re-lee el archivo al seleccionar fila
- Mostrar máximo 15 filas en el picker (las primeras 15 de las 20 leídas)
- Celdas truncadas a 20 chars con `…` para que la tabla quepa en el formulario
- El presupuesto no cambia — no tiene picker

---

## Tests

Agregar en `tests/importar.test.js`:
- `leerFilasGantt` retorna array de arrays
- `parsearGanttDesdeHeader` con headerRowIdx explícito parsea correctamente
- `parsearGantt` lanza `GanttFormatError` (con `.filas`) cuando no encuentra header
- `GanttFormatError` es instancia de `Error`
