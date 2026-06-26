# Gantt Header Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer el import de Carta Gantt agnóstico al formato xlsx — cuando el auto-parse falla, expandir el formulario con una tabla interactiva para que el usuario indique qué fila es el encabezado y confirme las columnas detectadas antes de importar.

**Architecture:** Refactorizar `importar.js` para separar lectura de filas, detección de header y parseo. Crear `GanttHeaderPicker.jsx` como componente UI autónomo. Integrar en `NuevaObra.jsx` y `GestionProyectos.jsx` con un estado de 5 fases para el campo Gantt.

**Tech Stack:** React, XLSX (ya instalado), CSS variables del design system (--gold, --border, --text-m, etc.)

## Global Constraints

- Sin librerías nuevas
- El workbook vive en memoria del componente — no re-leer el archivo al seleccionar fila en el picker
- Mostrar máximo 15 filas en el picker
- Celdas truncadas a 20 chars con `…`
- Usar CSS variables del design system: `var(--gold)`, `var(--gold-bg)`, `var(--gold-bdr)`, `var(--border)`, `var(--text)`, `var(--text-m)`, `var(--text-h)`, `var(--s4)`, `var(--rojo)` — NO colores hardcodeados en el picker
- Estados del campo Gantt: `idle | procesando | auto-ok | necesita-config | configurado`
- `parsearGantt` lanza `GanttFormatError` (no `Error` genérico) cuando no encuentra encabezado — el componente usa `instanceof GanttFormatError` para distinguir

---

## File Structure

```
src/
├── lib/
│   └── importar.js          ← MODIFY: GanttFormatError, leerFilasGantt, parsearGanttDesdeHeader,
│                                       refactorizar parsearGantt, exportar leerWorkbook,
│                                       importarObra + reimportarObra aceptan ganttPartidas opcional
├── components/
│   ├── GanttHeaderPicker.jsx ← CREATE: tabla interactiva + preview columnas detectadas
│   ├── NuevaObra.jsx         ← MODIFY: estado gantt 5 fases + render picker
│   └── GestionProyectos.jsx  ← MODIFY: FormNuevaObra + PanelActualizarObra con mismo patrón
tests/
└── importar.test.js          ← MODIFY: agregar tests para nuevas funciones exportadas
```

---

## Task 1: Refactorizar `importar.js` con TDD

**Files:**
- Modify: `src/lib/importar.js`
- Modify: `tests/importar.test.js`

**Interfaces:**
- Produces:
  - `export class GanttFormatError extends Error` con propiedad `.filas: any[][]`
  - `export function leerFilasGantt(workbook)` → `any[][]` (máx 20 filas)
  - `export function parsearGanttDesdeHeader(workbook, headerRowIdx: number)` → `PartidaGantt[]`
  - `export function leerWorkbook(file)` → `Promise<WorkbookObject>` (ya existía, solo agregar export)
  - `parsearGantt(workbook)` refactorizado — lanza `GanttFormatError` en vez de `Error` genérico
  - `importarObra(nombre, fechaInicio, presupuestoFile, ganttFile, onProgreso, ganttPartidas?)` — si `ganttPartidas` es array, omite parseo del Gantt
  - `reimportarObra(obraId, presupuestoFile, ganttFile, preservarAvance, onProgreso, ganttPartidas?)` — mismo patrón

- [ ] **Step 1: Agregar imports y tests nuevos al inicio de `tests/importar.test.js`**

Agregar al import existente:
```js
import { parsearPresupuesto, parsearGantt, leerFilasGantt, parsearGanttDesdeHeader, GanttFormatError } from '../src/lib/importar'
```

Reemplazar la línea de import actual que solo importa `parsearPresupuesto, parsearGantt`.

Luego agregar estos bloques al final del archivo (después del último `describe`):

```js
describe('leerFilasGantt', () => {
  beforeEach(() => {
    vi.spyOn(XLSX.utils, 'sheet_to_json')
  })

  it('retorna máximo 20 filas como array de arrays', () => {
    const rows = Array.from({ length: 25 }, (_, i) => [`fila${i}`, null, null])
    XLSX.utils.sheet_to_json.mockReturnValue(rows)
    const wb = { SheetNames: ['Carta Gantt'], Sheets: { 'Carta Gantt': {} } }
    const result = leerFilasGantt(wb)
    expect(result).toHaveLength(20)
    expect(result[0][0]).toBe('fila0')
  })

  it('usa la primera hoja si no hay hoja con "gantt" en el nombre', () => {
    XLSX.utils.sheet_to_json.mockReturnValue([['celda', null]])
    const wb = { SheetNames: ['MiHoja'], Sheets: { MiHoja: {} } }
    const result = leerFilasGantt(wb)
    expect(result[0][0]).toBe('celda')
  })
})

describe('parsearGanttDesdeHeader', () => {
  beforeEach(() => {
    vi.spyOn(XLSX.utils, 'sheet_to_json')
  })

  it('parsea partidas desde una fila de encabezado específica', () => {
    XLSX.utils.sheet_to_json.mockReturnValue([
      ['TITULO', null, null, null, null, null, null, null, null, null],
      ['Cuadrilla / Especialidad', null, 'N°', 'Partida', null, null, null, null, 'Día Ini', 'Día Fin'],
      ['Civil', null, '1', 'Excavación', null, null, null, null, 1, 5],
    ])
    const wb = { SheetNames: ['Carta Gantt'], Sheets: { 'Carta Gantt': {} } }
    const result = parsearGanttDesdeHeader(wb, 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ cuadrilla: 'Civil', numero: '1', nombre: 'Excavación', dia_ini: 1, dia_fin: 5 })
  })

  it('lanza error si no hay partidas desde esa fila', () => {
    XLSX.utils.sheet_to_json.mockReturnValue([
      ['Sección', null, 'N°', 'Partida', null, null, null, null, 'Día Ini', 'Día Fin'],
    ])
    const wb = { SheetNames: ['Carta Gantt'], Sheets: { 'Carta Gantt': {} } }
    expect(() => parsearGanttDesdeHeader(wb, 0)).toThrow()
  })
})

describe('GanttFormatError', () => {
  it('es instancia de Error', () => {
    const e = new GanttFormatError('mensaje', [[]])
    expect(e).toBeInstanceOf(Error)
  })

  it('incluye .filas con las filas crudas', () => {
    const filas = [['A', 'B'], ['C', 'D']]
    const e = new GanttFormatError('mensaje', filas)
    expect(e.filas).toBe(filas)
  })
})

describe('parsearGantt — formato desconocido', () => {
  beforeEach(() => {
    vi.spyOn(XLSX.utils, 'sheet_to_json')
  })

  it('lanza GanttFormatError con .filas cuando no encuentra encabezado', () => {
    const rows = [
      ['CARTA GANTT 60 DÍAS', null, null],
      ['Sección', null, null],
      ['A. DEMOLICIONES', null, null],
    ]
    XLSX.utils.sheet_to_json.mockReturnValue(rows)
    const wb = { SheetNames: ['Carta Gantt'], Sheets: { 'Carta Gantt': {} } }
    let caught = null
    try { parsearGantt(wb) } catch (e) { caught = e }
    expect(caught).toBeInstanceOf(GanttFormatError)
    expect(Array.isArray(caught.filas)).toBe(true)
  })
})
```

- [ ] **Step 2: Correr tests — deben fallar**

```bash
cd "/Users/usuario/Desktop/app control obra"
npx vitest run tests/importar.test.js 2>&1 | tail -15
```
Esperado: FAIL — `leerFilasGantt`, `parsearGanttDesdeHeader`, `GanttFormatError` no existen aún.

- [ ] **Step 3: Reemplazar `src/lib/importar.js` completo**

```js
import * as XLSX from 'xlsx'
import { supabase } from './supabase'

export class GanttFormatError extends Error {
  constructor(message, filas) {
    super(message)
    this.name = 'GanttFormatError'
    this.filas = filas
  }
}

export function parsearPresupuesto(workbook) {
  const ws = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const items = new Map()
  let seccionActual = null

  for (const row of rows) {
    const [num, nombre, unidad, cantidad, precio_unit, subtotal] = row
    if (typeof num === 'string' && /^[A-Z]\.\s/.test(num)) {
      seccionActual = num
      continue
    }
    if (typeof num === 'number' && nombre && subtotal) {
      items.set(String(Math.round(num)), {
        seccion: seccionActual || '',
        nombre: String(nombre),
        unidad: unidad ? String(unidad) : '',
        cantidad: Number(cantidad) || 0,
        precio_unit: Number(precio_unit) || 0,
        subtotal: Number(subtotal) || 0,
      })
    }
  }

  if (items.size === 0) throw new Error('El archivo no tiene el formato esperado.')
  return items
}

function _getSheetName(workbook) {
  return workbook.SheetNames.find(n =>
    n.toLowerCase().includes('gantt') || n.toLowerCase().includes('carta')
  ) || workbook.SheetNames[0]
}

export function leerFilasGantt(workbook) {
  const sheetName = _getSheetName(workbook)
  const ws = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  return rows.slice(0, 20)
}

export function parsearGanttDesdeHeader(workbook, headerRowIdx) {
  const sheetName = _getSheetName(workbook)
  const ws = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  const headerRow = rows[headerRowIdx] || []
  let colCuadrilla = 0, colNumero = 2, colNombre = 3, colIni = 8, colFin = 9

  headerRow.forEach((cell, j) => {
    if (cell == null) return
    const s = String(cell).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (/^cuadrilla/.test(s)) colCuadrilla = j
    if (/^n[°o]?$/.test(s.trim()) || s.includes('numero') || s.includes('item')) colNumero = j
    if (s.includes('partida') || s.includes('nombre') || s.includes('actividad') || s.includes('descripcion')) colNombre = j
    if ((s.includes('dia') || s.includes('día') || s.includes('día')) && (s.includes('ini') || s.includes('inicio'))) colIni = j
    if ((s.includes('dia') || s.includes('día') || s.includes('día')) && s.includes('fin')) colFin = j
  })

  const items = []
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const cuadrilla = row[colCuadrilla]
    const nombre    = row[colNombre]
    const numero    = row[colNumero]
    const dia_ini   = row[colIni]
    const dia_fin   = row[colFin]
    const diaIniNum = Number(dia_ini)
    if (cuadrilla && nombre && !isNaN(diaIniNum) && diaIniNum > 0) {
      items.push({
        cuadrilla: String(cuadrilla),
        numero:    numero != null ? String(numero) : '',
        nombre:    String(nombre),
        dia_ini:   diaIniNum,
        dia_fin:   dia_fin != null && !isNaN(Number(dia_fin)) ? Number(dia_fin) : diaIniNum,
      })
    }
  }

  if (items.length === 0) {
    throw new Error(`No se encontraron partidas desde la fila ${headerRowIdx + 1}.`)
  }
  return items
}

export function parsearGantt(workbook) {
  const filas = leerFilasGantt(workbook)

  let headerRowIdx = -1
  for (let i = 0; i < filas.length; i++) {
    const idx = filas[i].findIndex(c =>
      typeof c === 'string' && c.toLowerCase().trim().startsWith('cuadrilla')
    )
    if (idx >= 0) { headerRowIdx = i; break }
  }

  if (headerRowIdx === -1) {
    const muestra = filas.slice(0, 5).map(r => String(r[0] ?? '')).join(' | ')
    throw new GanttFormatError(
      `No se encontró la columna "Cuadrilla / Especialidad" en las primeras 20 filas.\nColumna A encontrada: ${muestra}`,
      filas
    )
  }

  return parsearGanttDesdeHeader(workbook, headerRowIdx)
}

export async function leerWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        resolve(wb)
      } catch {
        reject(new Error('No se pudo leer el archivo. Asegúrate de que sea un .xlsx válido.'))
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo.'))
    reader.readAsArrayBuffer(file)
  })
}

export async function importarObra(nombre, fechaInicio, presupuestoFile, ganttFile, onProgreso, ganttPartidas = null) {
  onProgreso?.('Leyendo presupuesto...')
  const wbPresupuesto = await leerWorkbook(presupuestoFile)
  const presupuesto = parsearPresupuesto(wbPresupuesto)

  let gantt = ganttPartidas
  if (!gantt) {
    onProgreso?.('Leyendo carta Gantt...')
    const wbGantt = await leerWorkbook(ganttFile)
    gantt = parsearGantt(wbGantt)
  }

  const presupuestoNeto = [...presupuesto.values()].reduce((s, p) => s + p.subtotal, 0)

  onProgreso?.('Creando obra en base de datos...')
  const { data: obraData, error: obraError } = await supabase
    .from('obras')
    .insert({ nombre, fecha_inicio: fechaInicio, total_dias: gantt.length > 0 ? Math.max(...gantt.map(g => g.dia_fin)) : 60, presupuesto_neto: presupuestoNeto })
    .select()
    .single()

  if (obraError) throw new Error(`Error creando obra: ${obraError.message}`)
  const obraId = obraData.id

  onProgreso?.(`Importando ${gantt.length} partidas...`)
  const partidas = gantt.map(g => {
    if (!presupuesto.has(g.numero)) {
      console.warn(`importarObra: partida "${g.nombre}" (N° ${g.numero}) no encontrada en presupuesto, se importa sin monto`)
    }
    const ppto = presupuesto.get(g.numero) || {}
    return {
      obra_id: obraId,
      cuadrilla: g.cuadrilla,
      seccion: ppto.seccion || '',
      numero: g.numero,
      nombre: g.nombre,
      unidad: ppto.unidad || '',
      cantidad: ppto.cantidad || 0,
      precio_unit: ppto.precio_unit || 0,
      subtotal: ppto.subtotal || 0,
      dia_ini: g.dia_ini,
      dia_fin: g.dia_fin,
      avance_pct: 0,
    }
  })

  const { error: partidasError } = await supabase.from('partidas').insert(partidas)
  if (partidasError) {
    await supabase.from('obras').delete().eq('id', obraData.id)
    throw new Error(`Error importando partidas: ${partidasError.message}`)
  }

  onProgreso?.('¡Importación completa!')
  return obraId
}

export async function reimportarObra(obraId, presupuestoFile, ganttFile, preservarAvance, onProgreso, ganttPartidas = null) {
  onProgreso?.('Leyendo presupuesto...')
  const wbPresupuesto = await leerWorkbook(presupuestoFile)
  const presupuesto = parsearPresupuesto(wbPresupuesto)

  let gantt = ganttPartidas
  if (!gantt) {
    onProgreso?.('Leyendo carta Gantt...')
    const wbGantt = await leerWorkbook(ganttFile)
    gantt = parsearGantt(wbGantt)
  }

  const presupuestoNeto = [...presupuesto.values()].reduce((s, p) => s + p.subtotal, 0)

  let avancePrevio = {}
  if (preservarAvance) {
    onProgreso?.('Guardando avance actual...')
    const { data } = await supabase.from('partidas').select('numero, avance_pct').eq('obra_id', obraId)
    for (const p of data || []) avancePrevio[p.numero] = p.avance_pct
  }

  onProgreso?.('Eliminando partidas anteriores...')
  const { error: delError } = await supabase.from('partidas').delete().eq('obra_id', obraId)
  if (delError) throw new Error(`Error eliminando partidas: ${delError.message}`)

  onProgreso?.('Actualizando datos de la obra...')
  const totalDias = gantt.length > 0 ? Math.max(...gantt.map(g => g.dia_fin)) : 60
  await supabase.from('obras').update({ presupuesto_neto: presupuestoNeto, total_dias: totalDias }).eq('id', obraId)

  onProgreso?.(`Importando ${gantt.length} partidas...`)
  const partidas = gantt.map(g => {
    if (!presupuesto.has(g.numero)) {
      console.warn(`reimportarObra: partida "${g.nombre}" (N° ${g.numero}) no encontrada en presupuesto, se importa sin monto`)
    }
    const ppto = presupuesto.get(g.numero) || {}
    return {
      obra_id: obraId,
      cuadrilla: g.cuadrilla,
      seccion: ppto.seccion || '',
      numero: g.numero,
      nombre: g.nombre,
      unidad: ppto.unidad || '',
      cantidad: ppto.cantidad || 0,
      precio_unit: ppto.precio_unit || 0,
      subtotal: ppto.subtotal || 0,
      dia_ini: g.dia_ini,
      dia_fin: g.dia_fin,
      avance_pct: preservarAvance ? (avancePrevio[g.numero] ?? 0) : 0,
    }
  })

  const { error: partidasError } = await supabase.from('partidas').insert(partidas)
  if (partidasError) throw new Error(`Error importando partidas: ${partidasError.message}`)

  onProgreso?.('¡Reimportación completa!')
}
```

- [ ] **Step 4: Correr tests — deben pasar**

```bash
cd "/Users/usuario/Desktop/app control obra"
npx vitest run tests/importar.test.js 2>&1 | tail -15
```
Esperado: todos los tests de `importar.test.js` pasan (los 4 nuevos + los 8 existentes = 12 tests).

- [ ] **Step 5: Correr suite completa**

```bash
npx vitest run 2>&1 | tail -10
```
Esperado: 38 tests pasando (30 previos + 8 nuevos).

- [ ] **Step 6: Commit**

```bash
git add src/lib/importar.js tests/importar.test.js
git commit -m "feat: GanttFormatError, leerFilasGantt, parsearGanttDesdeHeader — import agnóstico al formato"
```

---

## Task 2: Crear `GanttHeaderPicker.jsx`

**Files:**
- Create: `src/components/GanttHeaderPicker.jsx`

**Interfaces:**
- Consumes:
  - `filas: any[][]` — filas crudas del xlsx (máx 20)
  - `workbook: WorkbookObject` — para re-parsear cuando el usuario elige fila
  - `onConfirmar: (partidas: PartidaGantt[]) => void`
  - `onCancelar: () => void`
- Consumes de `../lib/importar`: `parsearGanttDesdeHeader`
- Produce: componente React sin estado externo

- [ ] **Step 1: Crear `src/components/GanttHeaderPicker.jsx`**

```jsx
import { useState } from 'react'
import { parsearGanttDesdeHeader } from '../lib/importar'

function colLetra(j) {
  return String.fromCharCode(65 + j)
}

export default function GanttHeaderPicker({ filas, workbook, onConfirmar, onCancelar }) {
  const [filaSeleccionada, setFilaSeleccionada] = useState(null)
  const [partidas, setPartidas] = useState(null)
  const [columnas, setColumnas] = useState(null)
  const [errorFila, setErrorFila] = useState('')

  function handleSeleccionarFila(idx) {
    setFilaSeleccionada(idx)
    setErrorFila('')
    try {
      const result = parsearGanttDesdeHeader(workbook, idx)
      setPartidas(result)
      const headerRow = filas[idx] || []
      const cols = {}
      headerRow.forEach((cell, j) => {
        if (cell == null) return
        const s = String(cell).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        if (/^cuadrilla/.test(s)) cols.cuadrilla = { label: String(cell), col: j }
        if (/^n[°o]?$/.test(s.trim()) || s.includes('numero')) cols.numero = { label: String(cell), col: j }
        if (s.includes('partida') || s.includes('nombre') || s.includes('actividad')) cols.nombre = { label: String(cell), col: j }
        if ((s.includes('dia') || s.includes('día')) && (s.includes('ini') || s.includes('inicio'))) cols.diaIni = { label: String(cell), col: j }
        if ((s.includes('dia') || s.includes('día')) && s.includes('fin')) cols.diaFin = { label: String(cell), col: j }
      })
      setColumnas(cols)
    } catch {
      setPartidas(null)
      setColumnas(null)
      setErrorFila('Esta fila no parece ser el encabezado — no se encontraron partidas. Prueba con otra.')
    }
  }

  const puedeConfirmar = partidas && partidas.length > 0

  return (
    <div style={{
      marginTop: 12,
      border: '1px solid var(--gold-bdr)',
      borderRadius: 8,
      padding: 16,
      background: 'var(--gold-bg)',
    }}>
      <div style={{ fontSize: '0.83rem', color: 'var(--text-m)', marginBottom: 10 }}>
        Haz click en la fila que contiene los nombres de columnas
      </div>

      <div style={{ overflowX: 'auto', marginBottom: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
          <tbody>
            {filas.slice(0, 15).map((fila, i) => (
              <tr
                key={i}
                onClick={() => handleSeleccionarFila(i)}
                style={{
                  cursor: 'pointer',
                  background: filaSeleccionada === i ? 'rgba(196,158,68,0.12)' : 'transparent',
                  outline: filaSeleccionada === i ? '1px solid var(--gold-bdr)' : '1px solid transparent',
                }}
              >
                <td style={{ padding: '3px 8px', color: 'var(--text)', fontSize: '0.7rem', whiteSpace: 'nowrap', userSelect: 'none' }}>
                  {i + 1}
                </td>
                {(fila || []).slice(0, 10).map((cell, j) => (
                  <td
                    key={j}
                    title={cell != null ? String(cell) : ''}
                    style={{
                      padding: '3px 8px',
                      borderLeft: '1px solid var(--border)',
                      color: filaSeleccionada === i ? 'var(--gold)' : 'var(--text-m)',
                      maxWidth: 110,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cell != null ? String(cell).slice(0, 20) : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filaSeleccionada !== null && !errorFila && columnas && partidas && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-m)', fontWeight: 600, marginBottom: 6 }}>
            Columnas detectadas:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 12 }}>
            {[
              ['Nombre de partida', columnas.nombre],
              ['Día inicio', columnas.diaIni],
              ['Día fin', columnas.diaFin],
              ['Cuadrilla', columnas.cuadrilla],
            ].map(([label, col]) => (
              <div key={label} style={{ fontSize: '0.76rem', color: 'var(--text)' }}>
                {label} →{' '}
                <span style={{ color: col ? 'var(--gold)' : 'var(--rojo)', fontWeight: 600 }}>
                  {col ? `col ${colLetra(col.col)}` : 'no detectado'}
                </span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-m)', fontWeight: 600, marginBottom: 6 }}>
            Primeras partidas ({partidas.length} total):
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
            <thead>
              <tr>
                {['N°', 'Nombre', 'Días', 'Cuadrilla'].map(h => (
                  <th key={h} style={{ padding: '3px 8px', textAlign: 'left', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partidas.slice(0, 3).map((p, i) => (
                <tr key={i}>
                  <td style={{ padding: '3px 8px', color: 'var(--text-m)' }}>{p.numero || '-'}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--text-h)' }}>{p.nombre}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--text-m)' }}>{p.dia_ini}–{p.dia_fin}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--text-m)' }}>{(p.cuadrilla || '').split('.')[0] || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {errorFila && (
        <div style={{ color: 'var(--rojo)', fontSize: '0.8rem', marginBottom: 12 }}>{errorFila}</div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => puedeConfirmar && onConfirmar(partidas)}
          disabled={!puedeConfirmar}
          style={{
            padding: '8px 18px', borderRadius: 7, border: 'none',
            background: puedeConfirmar ? 'var(--gold)' : 'var(--s4)',
            color: puedeConfirmar ? '#000' : 'var(--text)',
            cursor: puedeConfirmar ? 'pointer' : 'default',
            fontWeight: 600, fontSize: '0.84rem',
          }}
        >
          Confirmar y continuar
        </button>
        <button
          onClick={onCancelar}
          style={{
            padding: '8px 18px', borderRadius: 7,
            border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-m)',
            cursor: 'pointer', fontSize: '0.84rem',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

```bash
cd "/Users/usuario/Desktop/app control obra"
npm run build 2>&1 | tail -15
```
Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/GanttHeaderPicker.jsx
git commit -m "feat: componente GanttHeaderPicker — selector de fila de encabezado con preview"
```

---

## Task 3: Actualizar `NuevaObra.jsx`

**Files:**
- Modify: `src/components/NuevaObra.jsx`

**Interfaces:**
- Consumes de `../lib/importar`: `importarObra`, `leerWorkbook`, `parsearGantt`, `GanttFormatError`
- Consumes: `GanttHeaderPicker` de `./GanttHeaderPicker`
- Props sin cambios: `{ onImportada, onCancelar }`

- [ ] **Step 1: Reemplazar `src/components/NuevaObra.jsx` completo**

```jsx
import { useState } from 'react'
import { importarObra, leerWorkbook, parsearGantt, GanttFormatError } from '../lib/importar'
import GanttHeaderPicker from './GanttHeaderPicker'

export default function NuevaObra({ onImportada, onCancelar }) {
  const [nombre, setNombre] = useState('')
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0])
  const [presupuestoFile, setPresupuestoFile] = useState(null)
  const [ganttFile, setGanttFile] = useState(null)
  const [ganttWorkbook, setGanttWorkbook] = useState(null)
  const [ganttEstado, setGanttEstado] = useState('idle')
  const [ganttPartidas, setGanttPartidas] = useState(null)
  const [ganttFilas, setGanttFilas] = useState(null)
  const [progreso, setProgreso] = useState('')
  const [error, setError] = useState('')
  const [importando, setImportando] = useState(false)

  async function handleGanttChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setGanttFile(file)
    setGanttEstado('procesando')
    setError('')
    setGanttPartidas(null)
    setGanttFilas(null)
    try {
      const wb = await leerWorkbook(file)
      setGanttWorkbook(wb)
      const partidas = parsearGantt(wb)
      setGanttPartidas(partidas)
      setGanttEstado('auto-ok')
    } catch (e) {
      if (e instanceof GanttFormatError) {
        setGanttFilas(e.filas)
        setGanttEstado('necesita-config')
      } else {
        setError(e.message)
        setGanttEstado('idle')
      }
    }
  }

  async function handleImportar() {
    if (!nombre.trim()) return setError('El nombre del proyecto es requerido.')
    if (!presupuestoFile) return setError('Sube el archivo de presupuesto.')
    if (!ganttPartidas) return setError('Sube el archivo de carta Gantt.')

    setError('')
    setImportando(true)
    try {
      const obraId = await importarObra(nombre.trim(), fechaInicio, presupuestoFile, ganttFile, setProgreso, ganttPartidas)
      onImportada(obraId)
    } catch (e) {
      setError(e.message)
      setProgreso('')
    }
    setImportando(false)
  }

  const puedeImportar = !importando &&
    ganttEstado !== 'necesita-config' &&
    ganttEstado !== 'procesando' &&
    !!ganttPartidas

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    background: '#0f172a', border: '1px solid #334155',
    color: '#f1f5f9', fontSize: '0.9rem', outline: 'none',
  }
  const labelStyle = { display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#94a3b8' }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 560 }}>
        <h2 style={{ marginBottom: 24, color: '#f8fafc' }}>➕ Nueva Obra</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Nombre del proyecto</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} placeholder="Ej: Remodelación Local Centro" />
          </div>

          <div>
            <label style={labelStyle}>Fecha de inicio</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Presupuesto (.xlsx)</label>
            <input
              type="file" accept=".xlsx"
              onChange={e => setPresupuestoFile(e.target.files[0] || null)}
              style={{ ...inputStyle, padding: '8px 14px', cursor: 'pointer' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Carta Gantt (.xlsx)</label>
            <input
              type="file" accept=".xlsx"
              onChange={handleGanttChange}
              style={{ ...inputStyle, padding: '8px 14px', cursor: 'pointer' }}
            />
            {ganttEstado === 'procesando' && (
              <div style={{ color: '#60a5fa', fontSize: '0.82rem', marginTop: 6 }}>Leyendo carta Gantt...</div>
            )}
            {ganttEstado === 'auto-ok' && (
              <div style={{ color: '#22c55e', fontSize: '0.82rem', marginTop: 6 }}>✓ {ganttPartidas?.length} partidas detectadas</div>
            )}
            {ganttEstado === 'configurado' && (
              <div style={{ color: '#22c55e', fontSize: '0.82rem', marginTop: 6 }}>✓ {ganttPartidas?.length} partidas (configurado manualmente)</div>
            )}
            {ganttEstado === 'necesita-config' && ganttFilas && (
              <GanttHeaderPicker
                filas={ganttFilas}
                workbook={ganttWorkbook}
                onConfirmar={partidas => { setGanttPartidas(partidas); setGanttEstado('configurado') }}
                onCancelar={() => { setGanttEstado('idle'); setGanttFile(null); setGanttFilas(null); setGanttWorkbook(null) }}
              />
            )}
          </div>

          {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', padding: '8px 12px', background: '#ef444411', borderRadius: 8 }}>{error}</div>}
          {progreso && <div style={{ color: '#22c55e', fontSize: '0.85rem', padding: '8px 12px', background: '#22c55e11', borderRadius: 8 }}>{progreso}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              onClick={onCancelar}
              disabled={importando}
              style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleImportar}
              disabled={!puedeImportar}
              style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: !puedeImportar ? '#334155' : '#3b82f6', color: 'white', cursor: !puedeImportar ? 'default' : 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
            >
              {importando ? 'Importando...' : 'Importar proyecto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

```bash
cd "/Users/usuario/Desktop/app control obra"
npm run build 2>&1 | tail -15
```
Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/NuevaObra.jsx
git commit -m "feat: NuevaObra con estado 5 fases para Gantt y GanttHeaderPicker inline"
```

---

## Task 4: Actualizar `GestionProyectos.jsx`

**Files:**
- Modify: `src/components/GestionProyectos.jsx`

**Interfaces:**
- Consumes de `../lib/importar`: agregar `leerWorkbook`, `parsearGantt`, `GanttFormatError` al import existente
- Consumes: `GanttHeaderPicker` de `./GanttHeaderPicker`
- Afecta dos sub-componentes: `FormNuevaObra` y `PanelActualizarObra`
- Props del componente raíz sin cambios: `{ obras, onCambiarObra, onObrasActualizadas }`

- [ ] **Step 1: Reemplazar `src/components/GestionProyectos.jsx` completo**

```jsx
import { useState } from 'react'
import { reimportarObra, importarObra, leerWorkbook, parsearGantt, GanttFormatError } from '../lib/importar'
import { calcDiaActual } from '../lib/calculations'
import GanttHeaderPicker from './GanttHeaderPicker'

const CONFIRM_STYLES = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  box: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 28, maxWidth: 420, width: '90%' },
  title: { fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 10 },
  desc: { fontSize: '0.87rem', color: '#94a3b8', marginBottom: 20, lineHeight: 1.5 },
  btns: { display: 'flex', gap: 10 },
  btnPrimary: { flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' },
  btnSecondary: { flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' },
  btnDanger: { flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' },
}

function DialogoPreservarAvance({ obra, onConfirm, onCancel }) {
  return (
    <div style={CONFIRM_STYLES.overlay}>
      <div style={CONFIRM_STYLES.box}>
        <div style={CONFIRM_STYLES.title}>Actualizar datos de {obra.nombre}</div>
        <div style={CONFIRM_STYLES.desc}>
          Vas a re-importar los archivos xlsx. ¿Qué hacer con el avance registrado hasta ahora?
        </div>
        <div style={{ ...CONFIRM_STYLES.btns, flexDirection: 'column', gap: 10 }}>
          <button style={CONFIRM_STYLES.btnPrimary} onClick={() => onConfirm(true)}>
            ✅ Mantener avance actual
          </button>
          <button style={CONFIRM_STYLES.btnDanger} onClick={() => onConfirm(false)}>
            🔄 Reiniciar avance a 0%
          </button>
          <button style={CONFIRM_STYLES.btnSecondary} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

function FilaObra({ obra, onActualizar, onCambiar }) {
  const diaActual = calcDiaActual(obra.fecha_inicio)
  const diasRestantes = Math.max(0, obra.total_dias - diaActual + 1)
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>{obra.nombre}</div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 3 }}>
          Día {diaActual} de {obra.total_dias} &nbsp;·&nbsp; {diasRestantes} días restantes
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onCambiar(obra.id)}
          style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem' }}
        >
          Ir a obra
        </button>
        <button
          onClick={() => onActualizar(obra)}
          style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: '#1d4ed8', color: 'white', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
        >
          🔄 Actualizar xlsx
        </button>
      </div>
    </div>
  )
}

function FormNuevaObra({ onImportada, onCancelar }) {
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState('')
  const [presupuestoFile, setPresupuestoFile] = useState(null)
  const [ganttFile, setGanttFile] = useState(null)
  const [ganttWorkbook, setGanttWorkbook] = useState(null)
  const [ganttEstado, setGanttEstado] = useState('idle')
  const [ganttPartidas, setGanttPartidas] = useState(null)
  const [ganttFilas, setGanttFilas] = useState(null)
  const [progreso, setProgreso] = useState('')
  const [error, setError] = useState('')
  const [importando, setImportando] = useState(false)

  async function handleGanttChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setGanttFile(file)
    setGanttEstado('procesando')
    setError('')
    setGanttPartidas(null)
    setGanttFilas(null)
    try {
      const wb = await leerWorkbook(file)
      setGanttWorkbook(wb)
      const partidas = parsearGantt(wb)
      setGanttPartidas(partidas)
      setGanttEstado('auto-ok')
    } catch (e) {
      if (e instanceof GanttFormatError) {
        setGanttFilas(e.filas)
        setGanttEstado('necesita-config')
      } else {
        setError(e.message)
        setGanttEstado('idle')
      }
    }
  }

  async function handleImportar() {
    if (!nombre || !fecha || !presupuestoFile || !ganttPartidas) { setError('Completa todos los campos.'); return }
    setError(''); setImportando(true)
    try {
      const id = await importarObra(nombre, fecha, presupuestoFile, ganttFile, setProgreso, ganttPartidas)
      onImportada(id)
    } catch (e) {
      setError(e.message)
    } finally {
      setImportando(false)
    }
  }

  const puedeImportar = !importando && ganttEstado !== 'necesita-config' && ganttEstado !== 'procesando' && !!ganttPartidas
  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 7, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: '0.88rem', boxSizing: 'border-box' }
  const labelStyle = { fontSize: '0.82rem', color: '#94a3b8', marginBottom: 5, display: 'block' }

  return (
    <div style={{ background: '#1e293b', border: '1px solid #3b82f6', borderRadius: 10, padding: '20px 24px', marginTop: 20 }}>
      <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 16 }}>➕ Nueva Obra</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Nombre del proyecto</label>
          <input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Edificio Miraflores" />
        </div>
        <div>
          <label style={labelStyle}>Fecha de inicio</label>
          <input type="date" style={inputStyle} value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Presupuesto.xlsx</label>
          <input type="file" accept=".xlsx" onChange={e => setPresupuestoFile(e.target.files[0])} style={{ color: '#94a3b8', fontSize: '0.82rem' }} />
        </div>
        <div>
          <label style={labelStyle}>Carta_Gantt.xlsx</label>
          <input type="file" accept=".xlsx" onChange={handleGanttChange} style={{ color: '#94a3b8', fontSize: '0.82rem' }} />
          {ganttEstado === 'procesando' && <div style={{ color: '#60a5fa', fontSize: '0.76rem', marginTop: 4 }}>Leyendo...</div>}
          {ganttEstado === 'auto-ok' && <div style={{ color: '#22c55e', fontSize: '0.76rem', marginTop: 4 }}>✓ {ganttPartidas?.length} partidas</div>}
          {ganttEstado === 'configurado' && <div style={{ color: '#22c55e', fontSize: '0.76rem', marginTop: 4 }}>✓ {ganttPartidas?.length} partidas (manual)</div>}
        </div>
      </div>
      {ganttEstado === 'necesita-config' && ganttFilas && (
        <GanttHeaderPicker
          filas={ganttFilas}
          workbook={ganttWorkbook}
          onConfirmar={partidas => { setGanttPartidas(partidas); setGanttEstado('configurado') }}
          onCancelar={() => { setGanttEstado('idle'); setGanttFile(null); setGanttFilas(null); setGanttWorkbook(null) }}
        />
      )}
      {progreso && <div style={{ color: '#60a5fa', fontSize: '0.85rem', marginBottom: 10 }}>{progreso}</div>}
      {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button onClick={handleImportar} disabled={!puedeImportar} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: !puedeImportar ? '#334155' : '#3b82f6', color: 'white', cursor: !puedeImportar ? 'default' : 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
          {importando ? 'Importando...' : 'Importar'}
        </button>
        <button onClick={onCancelar} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.88rem' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

function PanelActualizarObra({ obra, onListo, onCancelar }) {
  const [preguntarAvance, setPreguntarAvance] = useState(false)
  const [presupuestoFile, setPresupuestoFile] = useState(null)
  const [ganttFile, setGanttFile] = useState(null)
  const [ganttWorkbook, setGanttWorkbook] = useState(null)
  const [ganttEstado, setGanttEstado] = useState('idle')
  const [ganttPartidas, setGanttPartidas] = useState(null)
  const [ganttFilas, setGanttFilas] = useState(null)
  const [progreso, setProgreso] = useState('')
  const [error, setError] = useState('')
  const [importando, setImportando] = useState(false)

  async function handleGanttChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setGanttFile(file)
    setGanttEstado('procesando')
    setError('')
    setGanttPartidas(null)
    setGanttFilas(null)
    try {
      const wb = await leerWorkbook(file)
      setGanttWorkbook(wb)
      const partidas = parsearGantt(wb)
      setGanttPartidas(partidas)
      setGanttEstado('auto-ok')
    } catch (e) {
      if (e instanceof GanttFormatError) {
        setGanttFilas(e.filas)
        setGanttEstado('necesita-config')
      } else {
        setError(e.message)
        setGanttEstado('idle')
      }
    }
  }

  async function handleReimportar(pres) {
    setError(''); setImportando(true)
    try {
      await reimportarObra(obra.id, presupuestoFile, ganttFile, pres, setProgreso, ganttPartidas)
      onListo()
    } catch (e) {
      setError(e.message)
    } finally {
      setImportando(false)
    }
  }

  const puedeActualizar = !importando && ganttEstado !== 'necesita-config' && ganttEstado !== 'procesando' && !!ganttPartidas && !!presupuestoFile
  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 7, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: '0.88rem', boxSizing: 'border-box' }
  const labelStyle = { fontSize: '0.82rem', color: '#94a3b8', marginBottom: 5, display: 'block' }

  return (
    <>
      <div style={{ background: '#1e293b', border: '1px solid #1d4ed8', borderRadius: 10, padding: '20px 24px', marginTop: 20 }}>
        <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>🔄 Actualizar datos — {obra.nombre}</div>
        <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 16 }}>Sube los archivos xlsx actualizados</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Presupuesto.xlsx</label>
            <input type="file" accept=".xlsx" onChange={e => setPresupuestoFile(e.target.files[0])} style={{ color: '#94a3b8', fontSize: '0.82rem' }} />
          </div>
          <div>
            <label style={labelStyle}>Carta_Gantt.xlsx</label>
            <input type="file" accept=".xlsx" onChange={handleGanttChange} style={{ color: '#94a3b8', fontSize: '0.82rem' }} />
            {ganttEstado === 'procesando' && <div style={{ color: '#60a5fa', fontSize: '0.76rem', marginTop: 4 }}>Leyendo...</div>}
            {ganttEstado === 'auto-ok' && <div style={{ color: '#22c55e', fontSize: '0.76rem', marginTop: 4 }}>✓ {ganttPartidas?.length} partidas</div>}
            {ganttEstado === 'configurado' && <div style={{ color: '#22c55e', fontSize: '0.76rem', marginTop: 4 }}>✓ {ganttPartidas?.length} partidas (manual)</div>}
          </div>
        </div>
        {ganttEstado === 'necesita-config' && ganttFilas && (
          <GanttHeaderPicker
            filas={ganttFilas}
            workbook={ganttWorkbook}
            onConfirmar={partidas => { setGanttPartidas(partidas); setGanttEstado('configurado') }}
            onCancelar={() => { setGanttEstado('idle'); setGanttFile(null); setGanttFilas(null); setGanttWorkbook(null) }}
          />
        )}
        {progreso && <div style={{ color: '#60a5fa', fontSize: '0.85rem', marginBottom: 10 }}>{progreso}</div>}
        {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { if (!puedeActualizar) { setError('Sube ambos archivos xlsx.'); return } setPreguntarAvance(true) }}
            disabled={importando}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: importando ? '#334155' : '#1d4ed8', color: 'white', cursor: importando ? 'default' : 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
          >
            {importando ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button onClick={onCancelar} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.88rem' }}>
            Cancelar
          </button>
        </div>
      </div>
      {preguntarAvance && !importando && (
        <DialogoPreservarAvance
          obra={obra}
          onConfirm={pres => { setPreguntarAvance(false); handleReimportar(pres) }}
          onCancel={() => setPreguntarAvance(false)}
        />
      )}
    </>
  )
}

export default function GestionProyectos({ obras, onCambiarObra, onObrasActualizadas }) {
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [obraActualizando, setObraActualizando] = useState(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Proyectos</h2>
        {!mostrarNueva && !obraActualizando && (
          <button
            onClick={() => setMostrarNueva(true)}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px dashed #3b82f6', background: 'transparent', color: '#3b82f6', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
          >
            ➕ Nueva Obra
          </button>
        )}
      </div>

      {obras.map(o => (
        <FilaObra
          key={o.id}
          obra={o}
          onCambiar={id => onCambiarObra(id)}
          onActualizar={obra => { setMostrarNueva(false); setObraActualizando(obra) }}
        />
      ))}

      {mostrarNueva && (
        <FormNuevaObra
          onImportada={id => { setMostrarNueva(false); onObrasActualizadas(id) }}
          onCancelar={() => setMostrarNueva(false)}
        />
      )}

      {obraActualizando && (
        <PanelActualizarObra
          obra={obraActualizando}
          onListo={() => { setObraActualizando(null); onObrasActualizadas(obraActualizando.id) }}
          onCancelar={() => setObraActualizando(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Correr suite completa de tests**

```bash
cd "/Users/usuario/Desktop/app control obra"
npx vitest run 2>&1 | tail -10
```
Esperado: todos los tests pasan.

- [ ] **Step 3: Verificar build**

```bash
npm run build 2>&1 | tail -15
```
Esperado: sin errores ni warnings críticos.

- [ ] **Step 4: Commit y push**

```bash
git add src/components/GestionProyectos.jsx
git commit -m "feat: GestionProyectos con GanttHeaderPicker en FormNuevaObra y PanelActualizarObra"
git push
```
Netlify auto-despliega en ~1 min. Verificar en https://controobrasismia.netlify.app → Proyectos → Actualizar xlsx → subir un Gantt con formato diferente → debe aparecer el picker.
