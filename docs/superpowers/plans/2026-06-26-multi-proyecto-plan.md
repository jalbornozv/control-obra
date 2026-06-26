# Multi-proyecto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar soporte multi-proyecto: selector de obras al inicio y formulario para crear nuevas obras subiendo xlsx desde el browser.

**Architecture:** `App.jsx` reemplaza `useObra` (single) por `useObras` (array). Si hay más de 1 obra, muestra `ProyectoSelector`; si solo hay 1, carga directo. `NuevaObra` usa SheetJS (xlsx) para parsear los archivos en el browser y llama Supabase directamente para crear la obra y las partidas. La lógica de parseo vive en `src/lib/importar.js` para mantener los componentes limpios.

**Tech Stack:** React, SheetJS (`xlsx`), Supabase JS client. Sin backend nuevo.

## Global Constraints

- Librería xlsx: `xlsx` (SheetJS), instalar con `npm install xlsx`
- Formato esperado Presupuesto: columnas en orden N°, Partida, Unidad, Cantidad, Precio Unit. (CLP), Subtotal (CLP) — con filas de sección en mayúsculas que empiezan con letra y punto (ej: "A. DEMOLICIONES")
- Formato esperado Gantt: columnas Cuadrilla/Especialidad, Sección, N°, Partida, Unidad, Cantidad, Rendimiento, Cuadrilla-días, Ventana Día Ini, Ventana Día Fin
- Si 1 sola obra en BD: no mostrar selector, cargar directo (sin cambio UX)
- Si 2+ obras: mostrar `ProyectoSelector` antes del dashboard
- `useObra.js` se renombra a `useObras.js` — retorna `{ obras, loading, error }`
- Error de formato xlsx: mostrar mensaje "El archivo no tiene el formato esperado."
- Presupuesto neto calculado como suma de subtotales de partidas (no incluye GG ni utilidades)

---

## File Structure

```
src/
├── lib/
│   └── importar.js              ← CREATE: parseo xlsx + inserción Supabase
├── hooks/
│   ├── useObra.js               ← RENAME+MODIFY → useObras.js (retorna array)
│   └── usePartidas.js           ← no changes
├── components/
│   ├── ProyectoSelector.jsx     ← CREATE: lista de obras + botón nueva obra
│   └── NuevaObra.jsx            ← CREATE: formulario upload xlsx + importación
└── App.jsx                      ← MODIFY: usa useObras, muestra selector o dashboard
```

---

## Task 1: Librería de importación en browser (importar.js)

**Files:**
- Create: `src/lib/importar.js`

**Interfaces:**
- Produces:
  - `parsearPresupuesto(workbook)` → `Map<string, {seccion, nombre, unidad, cantidad, precio_unit, subtotal}>`
  - `parsearGantt(workbook)` → `Array<{cuadrilla, numero, nombre, dia_ini, dia_fin}>`
  - `importarObra(nombre, fechaInicio, presupuestoFile, ganttFile)` → `Promise<string>` (retorna obra_id)

- [ ] **Step 1: Instalar SheetJS**

```bash
cd "/Users/usuario/Desktop/app control obra"
npm install xlsx
```
Esperado: instalación exitosa, `xlsx` aparece en `package.json` dependencies.

- [ ] **Step 2: Crear src/lib/importar.js**

```js
import * as XLSX from 'xlsx'
import { supabase } from './supabase'

export function parsearPresupuesto(workbook) {
  const ws = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const items = new Map()
  let seccionActual = null

  for (const row of rows) {
    const [num, nombre, unidad, cantidad, precio_unit, subtotal] = row
    // Detectar fila de sección: columna A es string con formato "X. NOMBRE"
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

export function parsearGantt(workbook) {
  const ws = workbook.Sheets['Carta Gantt'] || workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const items = []
  let encabezadoVisto = false

  for (const row of rows) {
    const [cuadrilla, , numero, nombre, , , , , dia_ini, dia_fin] = row
    if (!encabezadoVisto) {
      if (cuadrilla === 'Cuadrilla / Especialidad') encabezadoVisto = true
      continue
    }
    if (cuadrilla && nombre && dia_ini) {
      items.push({
        cuadrilla: String(cuadrilla),
        numero: numero != null ? String(numero) : '',
        nombre: String(nombre),
        dia_ini: Number(dia_ini),
        dia_fin: dia_fin != null ? Number(dia_fin) : Number(dia_ini),
      })
    }
  }

  if (items.length === 0) throw new Error('El archivo Gantt no tiene el formato esperado.')
  return items
}

async function leerWorkbook(file) {
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

export async function importarObra(nombre, fechaInicio, presupuestoFile, ganttFile, onProgreso) {
  onProgreso?.('Leyendo presupuesto...')
  const wbPresupuesto = await leerWorkbook(presupuestoFile)
  const presupuesto = parsearPresupuesto(wbPresupuesto)

  onProgreso?.('Leyendo carta Gantt...')
  const wbGantt = await leerWorkbook(ganttFile)
  const gantt = parsearGantt(wbGantt)

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
  if (partidasError) throw new Error(`Error importando partidas: ${partidasError.message}`)

  onProgreso?.('¡Importación completa!')
  return obraId
}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```
Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/importar.js package.json package-lock.json
git commit -m "feat: librería importar.js para parseo xlsx en browser"
```

---

## Task 2: Hook useObras (reemplaza useObra)

**Files:**
- Create: `src/hooks/useObras.js`
- Keep: `src/hooks/useObra.js` (no borrar — App.jsx lo reemplazará en Task 3)

**Interfaces:**
- Produces: `useObras()` → `{ obras: ObraObject[], loading: boolean, error: string | null }`
- `obras` está ordenado por `created_at` descendente (más reciente primero)

- [ ] **Step 1: Crear src/hooks/useObras.js**

```js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useObras() {
  const [obras, setObras] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchObras() {
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) setError(error.message)
      else setObras(data || [])
      setLoading(false)
    }
    fetchObras()
  }, [])

  return { obras, loading, error }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useObras.js
git commit -m "feat: hook useObras para soporte multi-proyecto"
```

---

## Task 3: ProyectoSelector y NuevaObra

**Files:**
- Create: `src/components/ProyectoSelector.jsx`
- Create: `src/components/NuevaObra.jsx`

**Interfaces:**
- `ProyectoSelector` props: `{ obras: ObraObject[], onSeleccionar: (obraId: string) => void, onNueva: () => void }`
- `NuevaObra` props: `{ onImportada: (obraId: string) => void, onCancelar: () => void }`
- Consumes: `importarObra` de `../lib/importar`
- Consumes: `calcDiaActual` de `../lib/calculations`

- [ ] **Step 1: Crear src/components/ProyectoSelector.jsx**

```jsx
import { calcDiaActual } from '../lib/calculations'

export default function ProyectoSelector({ obras, onSeleccionar, onNueva }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>🏗️ Control Obra</h1>
      <p style={{ color: '#64748b', marginBottom: 32 }}>Selecciona un proyecto</p>

      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {obras.map(obra => {
          const diaActual = calcDiaActual(obra.fecha_inicio)
          const diasRestantes = Math.max(0, obra.total_dias - diaActual + 1)
          return (
            <button
              key={obra.id}
              onClick={() => onSeleccionar(obra.id)}
              style={{
                background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
                padding: '16px 20px', cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
            >
              <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: 6 }}>{obra.nombre}</div>
              <div style={{ display: 'flex', gap: 16, fontSize: '0.82rem', color: '#64748b' }}>
                <span>📅 Día {diaActual} / {obra.total_dias}</span>
                <span>⏳ {diasRestantes} días restantes</span>
                <span>📆 Inicio: {obra.fecha_inicio}</span>
              </div>
            </button>
          )
        })}

        <button
          onClick={onNueva}
          style={{
            background: 'transparent', border: '2px dashed #334155', borderRadius: 12,
            padding: '16px 20px', cursor: 'pointer', color: '#64748b',
            fontSize: '0.9rem', transition: 'all 0.15s', marginTop: 8,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#64748b' }}
        >
          ➕ Nueva Obra
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear src/components/NuevaObra.jsx**

```jsx
import { useState } from 'react'
import { importarObra } from '../lib/importar'

export default function NuevaObra({ onImportada, onCancelar }) {
  const [nombre, setNombre] = useState('')
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0])
  const [presupuestoFile, setPresupuestoFile] = useState(null)
  const [ganttFile, setGanttFile] = useState(null)
  const [progreso, setProgreso] = useState('')
  const [error, setError] = useState('')
  const [importando, setImportando] = useState(false)

  async function handleImportar() {
    if (!nombre.trim()) return setError('El nombre del proyecto es requerido.')
    if (!presupuestoFile) return setError('Sube el archivo de presupuesto.')
    if (!ganttFile) return setError('Sube el archivo de carta Gantt.')

    setError('')
    setImportando(true)
    try {
      const obraId = await importarObra(nombre.trim(), fechaInicio, presupuestoFile, ganttFile, setProgreso)
      onImportada(obraId)
    } catch (e) {
      setError(e.message)
      setProgreso('')
    }
    setImportando(false)
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    background: '#0f172a', border: '1px solid #334155',
    color: '#f1f5f9', fontSize: '0.9rem', outline: 'none',
  }

  const labelStyle = { display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#94a3b8' }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 480 }}>
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
              onChange={e => setGanttFile(e.target.files[0] || null)}
              style={{ ...inputStyle, padding: '8px 14px', cursor: 'pointer' }}
            />
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
              disabled={importando}
              style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: importando ? '#334155' : '#3b82f6', color: 'white', cursor: importando ? 'default' : 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
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

- [ ] **Step 3: Commit**

```bash
git add src/components/ProyectoSelector.jsx src/components/NuevaObra.jsx
git commit -m "feat: componentes ProyectoSelector y NuevaObra"
```

---

## Task 4: Cablear todo en App.jsx

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useObras` de `./hooks/useObras`
- Consumes: `usePartidas` de `./hooks/usePartidas`
- Consumes: `ProyectoSelector`, `NuevaObra`
- Estado local: `obraSeleccionadaId` (string | null) — null = mostrar selector

- [ ] **Step 1: Reemplazar src/App.jsx completo**

```jsx
import { useState } from 'react'
import { useObras } from './hooks/useObras'
import { usePartidas } from './hooks/usePartidas'
import ResumenGeneral from './components/ResumenGeneral'
import GanttView from './components/GanttView'
import FinancieroView from './components/FinancieroView'
import ChatAgente from './components/ChatAgente'
import ProyectoSelector from './components/ProyectoSelector'
import NuevaObra from './components/NuevaObra'

const TABS = [
  { id: 'resumen', label: '📊 Resumen' },
  { id: 'gantt', label: '📅 Gantt' },
  { id: 'financiero', label: '💰 Financiero' },
  { id: 'chat', label: '💬 Chat' },
]

export default function App() {
  const [tab, setTab] = useState('resumen')
  const [obraSeleccionadaId, setObraSeleccionadaId] = useState(null)
  const [mostrarNueva, setMostrarNueva] = useState(false)

  const { obras, loading: obrasLoading } = useObras()
  const obraActual = obras.find(o => o.id === obraSeleccionadaId) || (obras.length === 1 ? obras[0] : null)
  const { partidas, loading: partidasLoading, refetch } = usePartidas(obraActual?.id)

  if (obrasLoading) return <div className="loading">Cargando...</div>

  if (mostrarNueva) {
    return (
      <NuevaObra
        onImportada={id => { setObraSeleccionadaId(id); setMostrarNueva(false) }}
        onCancelar={() => setMostrarNueva(false)}
      />
    )
  }

  if (!obraActual) {
    return (
      <ProyectoSelector
        obras={obras}
        onSeleccionar={setObraSeleccionadaId}
        onNueva={() => setMostrarNueva(true)}
      />
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 style={{ cursor: obras.length > 1 ? 'pointer' : 'default' }} onClick={() => obras.length > 1 && setObraSeleccionadaId(null)}>
          🏗️ {obraActual.nombre}
          {obras.length > 1 && <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 8 }}>▼ cambiar</span>}
        </h1>
        <nav className="tabs">
          {TABS.map(t => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {tab === 'resumen' && <ResumenGeneral obra={obraActual} partidas={partidas} loading={partidasLoading} />}
        {tab === 'gantt' && <GanttView obra={obraActual} partidas={partidas} loading={partidasLoading} />}
        {tab === 'financiero' && <FinancieroView obra={obraActual} partidas={partidas} loading={partidasLoading} />}
        {tab === 'chat' && <ChatAgente obra={obraActual} partidas={partidas} loading={partidasLoading} onAvanceUpdated={refetch} />}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build sin errores**

```bash
npm run build
```
Esperado: build exitoso, sin warnings críticos.

- [ ] **Step 3: Probar flujo completo en dev**

```bash
npm run dev
```
1. Como hay 1 sola obra en Supabase, debe cargar directamente el dashboard (sin selector) ✓
2. En Supabase, crear manualmente una segunda obra de prueba (Table Editor → obras → Insert row) con `nombre="Obra Test"`, `fecha_inicio="2026-01-01"`, `total_dias=30`, `presupuesto_neto=1000000`
3. Recargar la app → debe mostrar `ProyectoSelector` con las 2 obras
4. Click en "Doña Carne" → dashboard normal ✓
5. Click en nombre de la obra en el header → vuelve al selector ✓
6. Click en "➕ Nueva Obra" → formulario con campos ✓
7. Cancelar → vuelve al selector ✓
8. Borrar la obra de prueba en Supabase para dejar solo la real

- [ ] **Step 4: Commit y push**

```bash
git add src/App.jsx
git commit -m "feat: multi-proyecto con selector y flujo nueva obra"
git push
```
Netlify auto-despliega. Verificar en https://controobrasismia.netlify.app.

---

## Self-Review

**Spec coverage:**
- ✅ Selector muestra lista con nombre, fecha inicio, días restantes
- ✅ 1 sola obra → carga directo sin selector
- ✅ 2+ obras → muestra ProyectoSelector
- ✅ Botón "Nueva Obra" en selector
- ✅ NuevaObra: nombre, fecha inicio, upload presupuesto xlsx, upload gantt xlsx
- ✅ `importarObra` parsea en browser con SheetJS
- ✅ Error de formato xlsx con mensaje claro
- ✅ Progreso de importación visible
- ✅ `parsearPresupuesto` y `parsearGantt` con formato correcto del piloto

**Placeholders:** Ninguno.

**Type consistency:** `obraId` (string UUID) consistente entre `importarObra` return, `onImportada` callback y `setObraSeleccionadaId`.
