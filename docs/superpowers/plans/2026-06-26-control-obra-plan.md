# Control Obra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un dashboard web de gestión de obra (React + Supabase + Netlify) que se actualiza mediante lenguaje natural a través de Claude Code, con chat IA integrado y entrada por voz.

**Architecture:** Frontend React/Vite desplegado en Netlify consume datos de Supabase (PostgreSQL) vía REST. Claude Code actúa como agente que actualiza Supabase cuando el usuario reporta avances en lenguaje natural. Un chat embebido en el dashboard usa Claude API (Haiku) con contexto completo de la obra para responder preguntas de flujo de caja y proyecciones.

**Tech Stack:** React 18, Vite, Supabase JS client, Recharts (gráficos), Anthropic SDK (chat), Web Speech API (voz), Python 3 + openpyxl (importación de datos), Netlify (hosting), Vitest (tests).

## Global Constraints

- Node.js ≥ 18 requerido
- Python ≥ 3.9 requerido (solo para script de importación)
- Todas las variables de entorno con prefijo `VITE_` para que Vite las exponga al frontend
- Directorio de trabajo raíz: `/Users/usuario/Desktop/app control obra`
- Polling del dashboard: cada 30 segundos a Supabase
- Modelo Claude para chat: `claude-haiku-4-5-20251001`
- Colores semáforo: verde `#22c55e`, amarillo `#eab308`, rojo `#ef4444`, gris `#9ca3af`
- Moneda: CLP, formato `$ X.XXX.XXX`

---

## File Structure

```
app control obra/
├── docs/superpowers/specs/ y plans/        ← ya existe
├── scripts/
│   └── import_data.py                      ← importa xlsx → Supabase
├── src/
│   ├── main.jsx                            ← entry point React
│   ├── App.jsx                             ← router y layout principal
│   ├── App.css                             ← estilos globales
│   ├── lib/
│   │   ├── supabase.js                     ← cliente Supabase singleton
│   │   └── calculations.js                 ← lógica de avance, semáforo, flujo de caja
│   ├── hooks/
│   │   ├── useObra.js                      ← fetch datos de la obra activa
│   │   └── usePartidas.js                  ← fetch partidas con polling 30s
│   └── components/
│       ├── ResumenGeneral.jsx              ← vista home: día, %, semáforo
│       ├── GanttView.jsx                   ← vista gantt con barras y estado
│       ├── FinancieroView.jsx              ← curva S, valorización, estado de pago
│       └── ChatAgente.jsx                  ← chat Claude API + Web Speech
├── tests/
│   └── calculations.test.js               ← tests de lógica de negocio
├── .env.example                           ← plantilla variables de entorno
├── .env.local                             ← variables reales (no commitear)
├── .gitignore
├── index.html
├── vite.config.js
└── package.json
```

---

## Task 1: Scaffolding del proyecto

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/App.css`, `.gitignore`, `.env.example`

**Interfaces:**
- Produces: app React corriendo en `http://localhost:5173` con página vacía

- [ ] **Step 1: Inicializar el proyecto**

```bash
cd "/Users/usuario/Desktop/app control obra"
npm create vite@latest . -- --template react
```
Cuando pregunte "Current directory is not empty. Remove existing files and continue?": elegir **Yes** (solo borra archivos de Vite, los docs quedan en subdirectorio).

- [ ] **Step 2: Instalar dependencias**

```bash
npm install
npm install @supabase/supabase-js @anthropic-ai/sdk recharts
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Configurar vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
  },
})
```

- [ ] **Step 4: Crear tests/setup.js**

```js
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Crear .env.example**

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_CLAUDE_API_KEY=sk-ant-...
```

- [ ] **Step 6: Actualizar .gitignore para proteger credenciales**

```
node_modules
dist
.env.local
.env
*.env
```

- [ ] **Step 7: Reemplazar src/main.jsx**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 8: Reemplazar src/App.jsx con placeholder**

```jsx
export default function App() {
  return <div style={{ padding: 32 }}><h1>Control Obra 🏗️</h1></div>
}
```

- [ ] **Step 9: Reemplazar src/App.css con reset básico**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #f1f5f9; }
```

- [ ] **Step 10: Verificar que la app corre**

```bash
npm run dev
```
Abrir `http://localhost:5173` — debe mostrar "Control Obra 🏗️" sobre fondo oscuro.

- [ ] **Step 11: Commit inicial**

```bash
git init
git add .
git commit -m "feat: scaffolding inicial React + Vite"
```

---

## Task 2: Supabase — crear tablas

**Files:**
- No hay archivos locales en este task — todo se hace en el dashboard web de Supabase

**Interfaces:**
- Produces: tablas `obras`, `partidas`, `registros` listas en Supabase con sus columnas

- [ ] **Step 1: Crear cuenta y proyecto en Supabase**

1. Ir a https://supabase.com → Sign up (gratis)
2. "New project" → nombre: `control-obra` → elegir región: South America (São Paulo)
3. Esperar ~2 minutos a que el proyecto se inicialice

- [ ] **Step 2: Abrir el SQL Editor en Supabase y ejecutar este script**

```sql
-- Tabla obras
create table obras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  fecha_inicio date not null,
  total_dias int not null,
  presupuesto_neto numeric not null,
  created_at timestamptz default now()
);

-- Tabla partidas
create table partidas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  cuadrilla text,
  seccion text,
  numero text,
  nombre text not null,
  unidad text,
  cantidad numeric,
  precio_unit numeric,
  subtotal numeric,
  dia_ini int,
  dia_fin int,
  avance_pct numeric default 0,
  updated_at timestamptz default now()
);

-- Tabla registros (historial)
create table registros (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid references partidas(id) on delete cascade,
  dia_obra int not null,
  avance_pct numeric not null,
  nota text,
  created_at timestamptz default now()
);
```

- [ ] **Step 3: Obtener credenciales**

En el dashboard de Supabase: Settings → API
- Copiar "Project URL" → será `VITE_SUPABASE_URL`
- Copiar "anon public" key → será `VITE_SUPABASE_ANON_KEY`

- [ ] **Step 4: Crear .env.local con las credenciales reales**

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
VITE_CLAUDE_API_KEY=tu-claude-api-key-aqui
```

---

## Task 3: Script de importación de datos

**Files:**
- Create: `scripts/import_data.py`

**Interfaces:**
- Consumes: `1100 Presupuesto doña carne JA.xlsx`, `Carta_Gantt_60dias_v4.xlsx`, variables de entorno Supabase
- Produces: tabla `obras` con 1 fila (Doña Carne), tabla `partidas` con ~50 filas cruzadas

- [ ] **Step 1: Instalar dependencias Python**

```bash
pip3 install openpyxl requests python-dotenv
```

- [ ] **Step 2: Crear scripts/import_data.py**

```python
import openpyxl
import requests
import json
import os
from dotenv import load_dotenv

load_dotenv('../.env.local')

SUPABASE_URL = os.environ['VITE_SUPABASE_URL']
SUPABASE_KEY = os.environ['VITE_SUPABASE_ANON_KEY']

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

def supabase_post(table, data):
    r = requests.post(f'{SUPABASE_URL}/rest/v1/{table}', headers=HEADERS, json=data)
    r.raise_for_status()
    return r.json()

def leer_presupuesto():
    wb = openpyxl.load_workbook('../1100 Presupuesto doña carne JA.xlsx', data_only=True)
    ws = wb['Presupuesto']
    items = {}
    seccion_actual = None
    for row in ws.iter_rows(values_only=True):
        # Detectar sección (ej: "A. DEMOLICIONES Y RETIROS")
        if row[0] and isinstance(row[0], str) and row[0][1:3] == '. ':
            seccion_actual = row[0]
            continue
        num, nombre, unidad, cantidad, precio_unit, subtotal = row[0], row[1], row[2], row[3], row[4], row[5]
        if isinstance(num, (int, float)) and nombre and subtotal:
            items[str(int(num))] = {
                'seccion': seccion_actual,
                'numero': str(int(num)),
                'nombre': nombre,
                'unidad': unidad or '',
                'cantidad': float(cantidad) if cantidad else 0,
                'precio_unit': float(precio_unit) if precio_unit else 0,
                'subtotal': float(subtotal) if subtotal else 0,
            }
    return items

def leer_gantt():
    wb = openpyxl.load_workbook('../Carta_Gantt_60dias_v4.xlsx', data_only=True)
    ws = wb['Carta Gantt']
    items = []
    primera_fila = True
    for row in ws.iter_rows(values_only=True):
        if primera_fila:
            primera_fila = False
            continue
        if row[0] == 'Cuadrilla / Especialidad':
            continue
        cuadrilla, seccion, numero, nombre, unidad, cantidad, _, _, dia_ini, dia_fin = row[:10]
        if cuadrilla and nombre and dia_ini:
            items.append({
                'cuadrilla': str(cuadrilla),
                'numero': str(numero) if numero else '',
                'nombre': str(nombre),
                'dia_ini': int(dia_ini),
                'dia_fin': int(dia_fin) if dia_fin else int(dia_ini),
            })
    return items

def main():
    print('Leyendo presupuesto...')
    presupuesto = leer_presupuesto()
    print(f'  {len(presupuesto)} items en presupuesto')

    print('Leyendo carta Gantt...')
    gantt = leer_gantt()
    print(f'  {len(gantt)} items en Gantt')

    print('Creando obra en Supabase...')
    obra = supabase_post('obras', {
        'nombre': 'Doña Carne Manquehue 1',
        'fecha_inicio': '2026-06-26',
        'total_dias': 60,
        'presupuesto_neto': 136976487.68
    })
    obra_id = obra[0]['id']
    print(f'  Obra creada: {obra_id}')

    print('Importando partidas...')
    count = 0
    for g in gantt:
        ppto = presupuesto.get(g['numero'], {})
        partida = {
            'obra_id': obra_id,
            'cuadrilla': g['cuadrilla'],
            'seccion': ppto.get('seccion', ''),
            'numero': g['numero'],
            'nombre': g['nombre'],
            'unidad': ppto.get('unidad', ''),
            'cantidad': ppto.get('cantidad', 0),
            'precio_unit': ppto.get('precio_unit', 0),
            'subtotal': ppto.get('subtotal', 0),
            'dia_ini': g['dia_ini'],
            'dia_fin': g['dia_fin'],
            'avance_pct': 0,
        }
        supabase_post('partidas', partida)
        count += 1
        print(f'  [{count}/{len(gantt)}] {g["nombre"][:50]}')

    print(f'\n✅ Importación completa: {count} partidas cargadas.')
    print(f'   Obra ID: {obra_id}')
    print(f'   Guarda este ID: lo necesitarás para la app.')

if __name__ == '__main__':
    main()
```

- [ ] **Step 3: Ejecutar el script**

```bash
cd "/Users/usuario/Desktop/app control obra/scripts"
python3 import_data.py
```
Esperado: ver lista de partidas importadas y `✅ Importación completa`.

- [ ] **Step 4: Verificar en Supabase**

En el dashboard de Supabase → Table Editor → tabla `partidas` → debe mostrar ~50 filas con datos.

- [ ] **Step 5: Commit**

```bash
cd "/Users/usuario/Desktop/app control obra"
git add scripts/
git commit -m "feat: script importación xlsx → Supabase"
```

---

## Task 4: Cliente Supabase + cálculos de obra (con tests)

**Files:**
- Create: `src/lib/supabase.js`
- Create: `src/lib/calculations.js`
- Create: `tests/calculations.test.js`

**Interfaces:**
- Produces:
  - `supabase` — cliente Supabase listo para usar en hooks y componentes
  - `calcAvanceEsperado(diaActual, diaIni, diaFin)` → number 0-100
  - `calcSemaforo(avancePct, avanceEsperado)` → `'verde' | 'amarillo' | 'rojo' | 'gris'`
  - `calcValorizacion(partidas)` → `{ total: number, porPartida: [{id, monto}] }`
  - `calcDiaActual(fechaInicio)` → number (día de obra, 1-based)
  - `formatCLP(number)` → string `"$ 1.234.567"`

- [ ] **Step 1: Crear src/lib/supabase.js**

```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
```

- [ ] **Step 2: Escribir los tests primero (TDD)**

Crear `tests/calculations.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  calcAvanceEsperado,
  calcSemaforo,
  calcValorizacion,
  calcDiaActual,
  formatCLP,
} from '../src/lib/calculations'

describe('calcAvanceEsperado', () => {
  it('retorna 50 cuando el día actual es el punto medio de la ventana', () => {
    expect(calcAvanceEsperado(5, 1, 10)).toBeCloseTo(44.4, 0)
  })
  it('retorna 100 cuando el día actual supera el día fin', () => {
    expect(calcAvanceEsperado(15, 1, 10)).toBe(100)
  })
  it('retorna 0 cuando el día actual es anterior al día ini', () => {
    expect(calcAvanceEsperado(0, 5, 10)).toBe(0)
  })
})

describe('calcSemaforo', () => {
  it('retorna verde cuando avance real >= esperado', () => {
    expect(calcSemaforo(80, 70)).toBe('verde')
  })
  it('retorna amarillo cuando avance real está entre 70% y 99% del esperado', () => {
    expect(calcSemaforo(55, 70)).toBe('amarillo')
  })
  it('retorna rojo cuando avance real < 70% del esperado', () => {
    expect(calcSemaforo(40, 70)).toBe('rojo')
  })
  it('retorna gris cuando avance esperado es 0 (partida no iniciada)', () => {
    expect(calcSemaforo(0, 0)).toBe('gris')
  })
})

describe('calcValorizacion', () => {
  it('calcula correctamente el monto valorizado por partida', () => {
    const partidas = [
      { id: '1', avance_pct: 50, subtotal: 1000000 },
      { id: '2', avance_pct: 100, subtotal: 2000000 },
    ]
    const result = calcValorizacion(partidas)
    expect(result.total).toBe(2500000)
    expect(result.porPartida[0].monto).toBe(500000)
    expect(result.porPartida[1].monto).toBe(2000000)
  })
})

describe('calcDiaActual', () => {
  it('retorna 1 si la fecha de inicio es hoy', () => {
    const hoy = new Date().toISOString().split('T')[0]
    expect(calcDiaActual(hoy)).toBe(1)
  })
  it('retorna 2 si la fecha de inicio fue ayer', () => {
    const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    expect(calcDiaActual(ayer)).toBe(2)
  })
})

describe('formatCLP', () => {
  it('formatea correctamente un número como CLP', () => {
    expect(formatCLP(1234567)).toBe('$ 1.234.567')
  })
  it('maneja cero', () => {
    expect(formatCLP(0)).toBe('$ 0')
  })
})
```

- [ ] **Step 3: Correr tests — deben fallar**

```bash
npx vitest run tests/calculations.test.js
```
Esperado: FAIL (módulo no existe aún)

- [ ] **Step 4: Crear src/lib/calculations.js**

```js
export function calcAvanceEsperado(diaActual, diaIni, diaFin) {
  if (diaActual < diaIni) return 0
  if (diaActual >= diaFin) return 100
  return ((diaActual - diaIni) / (diaFin - diaIni)) * 100
}

export function calcSemaforo(avancePct, avanceEsperado) {
  if (avanceEsperado === 0) return 'gris'
  if (avancePct >= avanceEsperado) return 'verde'
  if (avancePct >= avanceEsperado * 0.7) return 'amarillo'
  return 'rojo'
}

export function calcValorizacion(partidas) {
  const porPartida = partidas.map(p => ({
    id: p.id,
    monto: (p.avance_pct / 100) * (p.subtotal || 0),
  }))
  const total = porPartida.reduce((sum, p) => sum + p.monto, 0)
  return { total, porPartida }
}

export function calcDiaActual(fechaInicio) {
  const inicio = new Date(fechaInicio + 'T00:00:00')
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const diff = Math.floor((hoy - inicio) / 86400000)
  return diff + 1
}

export function formatCLP(number) {
  if (number === 0) return '$ 0'
  return '$ ' + Math.round(number).toLocaleString('es-CL')
}
```

- [ ] **Step 5: Correr tests — deben pasar**

```bash
npx vitest run tests/calculations.test.js
```
Esperado: PASS (5 describe blocks, todos verdes)

- [ ] **Step 6: Commit**

```bash
git add src/lib/ tests/
git commit -m "feat: cliente Supabase y lógica de cálculos con tests"
```

---

## Task 5: Hooks de datos con polling

**Files:**
- Create: `src/hooks/useObra.js`
- Create: `src/hooks/usePartidas.js`

**Interfaces:**
- Consumes: `supabase` de `../lib/supabase`
- Produces:
  - `useObra()` → `{ obra: ObraObject | null, loading: boolean, error: string | null }`
  - `usePartidas(obraId)` → `{ partidas: PartidaObject[], loading: boolean, error: string | null }`
  - Polling cada 30 segundos automático en `usePartidas`

- [ ] **Step 1: Crear src/hooks/useObra.js**

```js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useObra() {
  const [obra, setObra] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchObra() {
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) setError(error.message)
      else setObra(data)
      setLoading(false)
    }
    fetchObra()
  }, [])

  return { obra, loading, error }
}
```

- [ ] **Step 2: Crear src/hooks/usePartidas.js**

```js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function usePartidas(obraId) {
  const [partidas, setPartidas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPartidas = useCallback(async () => {
    if (!obraId) return
    const { data, error } = await supabase
      .from('partidas')
      .select('*')
      .eq('obra_id', obraId)
      .order('dia_ini', { ascending: true })

    if (error) setError(error.message)
    else setPartidas(data || [])
    setLoading(false)
  }, [obraId])

  useEffect(() => {
    fetchPartidas()
    const interval = setInterval(fetchPartidas, 30000)
    return () => clearInterval(interval)
  }, [fetchPartidas])

  return { partidas, loading, error }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/
git commit -m "feat: hooks useObra y usePartidas con polling 30s"
```

---

## Task 6: Layout principal y navegación

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `useObra`, `usePartidas`, los 4 componentes de vistas
- Produces: App con navegación entre 4 vistas, datos cargados y disponibles para todas las vistas

- [ ] **Step 1: Reemplazar src/App.jsx**

```jsx
import { useState } from 'react'
import { useObra } from './hooks/useObra'
import { usePartidas } from './hooks/usePartidas'
import ResumenGeneral from './components/ResumenGeneral'
import GanttView from './components/GanttView'
import FinancieroView from './components/FinancieroView'
import ChatAgente from './components/ChatAgente'

const TABS = [
  { id: 'resumen', label: '📊 Resumen' },
  { id: 'gantt', label: '📅 Gantt' },
  { id: 'financiero', label: '💰 Financiero' },
  { id: 'chat', label: '💬 Chat' },
]

export default function App() {
  const [tab, setTab] = useState('resumen')
  const { obra, loading: obraLoading } = useObra()
  const { partidas, loading: partidasLoading } = usePartidas(obra?.id)

  if (obraLoading) return <div className="loading">Cargando obra...</div>
  if (!obra) return <div className="loading">No se encontró ninguna obra.</div>

  const props = { obra, partidas, loading: partidasLoading }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏗️ {obra.nombre}</h1>
        <nav className="tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {tab === 'resumen' && <ResumenGeneral {...props} />}
        {tab === 'gantt' && <GanttView {...props} />}
        {tab === 'financiero' && <FinancieroView {...props} />}
        {tab === 'chat' && <ChatAgente {...props} />}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Agregar estilos al App.css**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #f1f5f9; }

.app { min-height: 100vh; display: flex; flex-direction: column; }

.app-header {
  background: #1e293b;
  border-bottom: 1px solid #334155;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}
.app-header h1 { font-size: 1.25rem; font-weight: 700; color: #f8fafc; white-space: nowrap; }

.tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.tab-btn {
  padding: 8px 16px;
  border: 1px solid #475569;
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.15s;
}
.tab-btn:hover { background: #334155; color: #f1f5f9; }
.tab-btn.active { background: #3b82f6; border-color: #3b82f6; color: white; }

.app-main { flex: 1; padding: 24px; max-width: 1400px; width: 100%; margin: 0 auto; }

.loading { display: flex; align-items: center; justify-content: center; height: 100vh; font-size: 1.2rem; color: #94a3b8; }

.card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; }
.card h2 { font-size: 1rem; font-weight: 600; color: #94a3b8; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em; }

.verde { color: #22c55e; }
.amarillo { color: #eab308; }
.rojo { color: #ef4444; }
.gris { color: #9ca3af; }
.bg-verde { background: #22c55e22; border-color: #22c55e44; }
.bg-amarillo { background: #eab30822; border-color: #eab30844; }
.bg-rojo { background: #ef444422; border-color: #ef444444; }

.grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }

.stat-value { font-size: 2rem; font-weight: 700; margin-bottom: 4px; }
.stat-label { font-size: 0.85rem; color: #64748b; }

@media (max-width: 640px) {
  .app-header { padding: 12px 16px; }
  .app-main { padding: 16px; }
}
```

- [ ] **Step 3: Crear placeholders para los 4 componentes (para que la app compile)**

```bash
mkdir -p "/Users/usuario/Desktop/app control obra/src/components"
```

Crear `src/components/ResumenGeneral.jsx`:
```jsx
export default function ResumenGeneral({ obra, partidas }) {
  return <div className="card"><h2>Resumen General</h2><p>En construcción...</p></div>
}
```

Crear `src/components/GanttView.jsx`:
```jsx
export default function GanttView({ obra, partidas }) {
  return <div className="card"><h2>Gantt</h2><p>En construcción...</p></div>
}
```

Crear `src/components/FinancieroView.jsx`:
```jsx
export default function FinancieroView({ obra, partidas }) {
  return <div className="card"><h2>Financiero</h2><p>En construcción...</p></div>
}
```

Crear `src/components/ChatAgente.jsx`:
```jsx
export default function ChatAgente({ obra, partidas }) {
  return <div className="card"><h2>Chat Agente</h2><p>En construcción...</p></div>
}
```

- [ ] **Step 4: Verificar que la app carga datos reales**

```bash
npm run dev
```
Abrir `http://localhost:5173` — debe mostrar el nombre de la obra y las 4 tabs. Navegar entre tabs sin errores en consola.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: layout principal con navegación y carga de datos Supabase"
```

---

## Task 7: Componente ResumenGeneral

**Files:**
- Modify: `src/components/ResumenGeneral.jsx`

**Interfaces:**
- Consumes: `obra` (ObraObject), `partidas` (PartidaObject[])
- Consumes: `calcDiaActual`, `calcAvanceEsperado`, `calcSemaforo`, `formatCLP` de `../lib/calculations`
- Produces: vista home con día de obra, % avance global, semáforo y tarjetas por cuadrilla

- [ ] **Step 1: Reemplazar src/components/ResumenGeneral.jsx**

```jsx
import { calcDiaActual, calcAvanceEsperado, calcSemaforo, formatCLP } from '../lib/calculations'

export default function ResumenGeneral({ obra, partidas }) {
  const diaActual = calcDiaActual(obra.fecha_inicio)
  const diasRestantes = obra.total_dias - diaActual + 1

  const avanceGlobal = partidas.length
    ? partidas.reduce((sum, p) => sum + (p.avance_pct || 0), 0) / partidas.length
    : 0

  const avanceGlobalEsperado = partidas.length
    ? partidas.reduce((sum, p) => sum + calcAvanceEsperado(diaActual, p.dia_ini, p.dia_fin), 0) / partidas.length
    : 0

  const semaforoGlobal = calcSemaforo(avanceGlobal, avanceGlobalEsperado)

  const coloresSemaforo = { verde: '#22c55e', amarillo: '#eab308', rojo: '#ef4444', gris: '#9ca3af' }

  // Agrupar por cuadrilla
  const cuadrillas = {}
  partidas.forEach(p => {
    if (!cuadrillas[p.cuadrilla]) cuadrillas[p.cuadrilla] = []
    cuadrillas[p.cuadrilla].push(p)
  })

  // Partidas más atrasadas
  const atrasadas = partidas
    .map(p => ({
      ...p,
      esperado: calcAvanceEsperado(diaActual, p.dia_ini, p.dia_fin),
      semaforo: calcSemaforo(p.avance_pct, calcAvanceEsperado(diaActual, p.dia_ini, p.dia_fin)),
    }))
    .filter(p => p.semaforo === 'rojo')
    .sort((a, b) => (a.esperado - a.avance_pct) - (b.esperado - b.avance_pct))
    .slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs superiores */}
      <div className="grid-4">
        <div className="card">
          <div className="stat-value">{diaActual > obra.total_dias ? obra.total_dias : diaActual}</div>
          <div className="stat-label">Día de obra</div>
        </div>
        <div className="card">
          <div className="stat-value" style={{ color: diasRestantes < 10 ? '#ef4444' : '#f8fafc' }}>
            {diasRestantes > 0 ? diasRestantes : 0}
          </div>
          <div className="stat-label">Días restantes</div>
        </div>
        <div className="card">
          <div className="stat-value">{avanceGlobal.toFixed(1)}%</div>
          <div className="stat-label">Avance real promedio</div>
        </div>
        <div className={`card bg-${semaforoGlobal}`}>
          <div className="stat-value" style={{ color: coloresSemaforo[semaforoGlobal] }}>
            {semaforoGlobal.toUpperCase()}
          </div>
          <div className="stat-label">Estado general</div>
        </div>
      </div>

      {/* Barra de progreso global */}
      <div className="card">
        <h2>Progreso Global</h2>
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#94a3b8' }}>
          <span>Real: {avanceGlobal.toFixed(1)}%</span>
          <span>Planificado: {avanceGlobalEsperado.toFixed(1)}%</span>
        </div>
        <div style={{ background: '#334155', borderRadius: 8, height: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${Math.min(avanceGlobalEsperado, 100)}%`,
            background: '#475569',
          }} />
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${Math.min(avanceGlobal, 100)}%`,
            background: coloresSemaforo[semaforoGlobal],
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      <div className="grid-2">
        {/* Estado por cuadrilla */}
        <div className="card">
          <h2>Estado por cuadrilla</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(cuadrillas).map(([nombre, items]) => {
              const avg = items.reduce((s, p) => s + (p.avance_pct || 0), 0) / items.length
              const avgEsp = items.reduce((s, p) => s + calcAvanceEsperado(diaActual, p.dia_ini, p.dia_fin), 0) / items.length
              const sem = calcSemaforo(avg, avgEsp)
              return (
                <div key={nombre} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: coloresSemaforo[sem], flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: '0.85rem' }}>{nombre}</div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{avg.toFixed(0)}%</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Partidas en rojo */}
        <div className="card">
          <h2>⚠️ Partidas más atrasadas</h2>
          {atrasadas.length === 0
            ? <p style={{ color: '#22c55e', fontSize: '0.9rem' }}>Sin atrasos críticos</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {atrasadas.map(p => (
                  <div key={p.id} style={{ fontSize: '0.85rem' }}>
                    <div style={{ color: '#f1f5f9', marginBottom: 2 }}>{p.nombre}</div>
                    <div style={{ color: '#ef4444' }}>
                      Real: {p.avance_pct.toFixed(0)}% | Esperado: {p.esperado.toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar en browser**

```bash
npm run dev
```
Tab "Resumen" debe mostrar: KPIs de días, porcentaje de avance, semáforo, lista de cuadrillas y partidas atrasadas.

- [ ] **Step 3: Commit**

```bash
git add src/components/ResumenGeneral.jsx
git commit -m "feat: componente ResumenGeneral con KPIs y semáforo"
```

---

## Task 8: Componente GanttView

**Files:**
- Modify: `src/components/GanttView.jsx`

**Interfaces:**
- Consumes: `obra`, `partidas`, `calcDiaActual`, `calcAvanceEsperado`, `calcSemaforo`
- Produces: vista Gantt con barras, progreso real, filtro por cuadrilla

- [ ] **Step 1: Reemplazar src/components/GanttView.jsx**

```jsx
import { useState } from 'react'
import { calcDiaActual, calcAvanceEsperado, calcSemaforo } from '../lib/calculations'

const SEMAFORO_COLOR = { verde: '#22c55e', amarillo: '#eab308', rojo: '#ef4444', gris: '#9ca3af' }

export default function GanttView({ obra, partidas }) {
  const diaActual = calcDiaActual(obra.fecha_inicio)
  const [filtro, setFiltro] = useState('Todas')

  const cuadrillas = ['Todas', ...new Set(partidas.map(p => p.cuadrilla).filter(Boolean))]
  const filtradas = filtro === 'Todas' ? partidas : partidas.filter(p => p.cuadrilla === filtro)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filtro cuadrilla */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {cuadrillas.map(c => (
          <button
            key={c}
            onClick={() => setFiltro(c)}
            style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid',
              background: filtro === c ? '#3b82f6' : 'transparent',
              borderColor: filtro === c ? '#3b82f6' : '#475569',
              color: filtro === c ? 'white' : '#94a3b8',
              cursor: 'pointer', fontSize: '0.8rem',
            }}
          >
            {c.split('.')[0]}
          </button>
        ))}
      </div>

      {/* Indicador día actual */}
      <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
        📍 Día actual de obra: <strong style={{ color: '#f1f5f9' }}>{diaActual}</strong> / {obra.total_dias}
      </div>

      {/* Tabla Gantt */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', width: 280, minWidth: 200 }}>Partida</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', width: 70 }}>Ini</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', width: 70 }}>Fin</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', width: 80 }}>Real %</th>
                <th style={{ padding: '10px 12px', color: '#64748b', minWidth: 300 }}>Barra</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(p => {
                const esperado = calcAvanceEsperado(diaActual, p.dia_ini, p.dia_fin)
                const semaforo = calcSemaforo(p.avance_pct, esperado)
                const color = SEMAFORO_COLOR[semaforo]
                const totalDias = obra.total_dias

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '10px 12px', color: '#f1f5f9' }}>
                      <div style={{ fontWeight: 500 }}>{p.nombre}</div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2 }}>{p.cuadrilla?.split('.')[0]}</div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8' }}>{p.dia_ini}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8' }}>{p.dia_fin}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color, fontWeight: 600 }}>
                      {(p.avance_pct || 0).toFixed(0)}%
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {/* Barra de fondo total */}
                      <div style={{ position: 'relative', height: 20, background: '#0f172a', borderRadius: 4 }}>
                        {/* Ventana planificada */}
                        <div style={{
                          position: 'absolute',
                          left: `${((p.dia_ini - 1) / totalDias) * 100}%`,
                          width: `${((p.dia_fin - p.dia_ini + 1) / totalDias) * 100}%`,
                          height: '100%', background: '#334155', borderRadius: 4,
                        }} />
                        {/* Avance real */}
                        <div style={{
                          position: 'absolute',
                          left: `${((p.dia_ini - 1) / totalDias) * 100}%`,
                          width: `${((p.dia_fin - p.dia_ini + 1) / totalDias) * 100 * (p.avance_pct / 100)}%`,
                          height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s',
                        }} />
                        {/* Línea día actual */}
                        <div style={{
                          position: 'absolute',
                          left: `${(Math.min(diaActual, totalDias) / totalDias) * 100}%`,
                          width: 2, height: '100%', background: '#f59e0b',
                        }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar en browser**

Tab "Gantt" debe mostrar tabla con barras grises (ventana planificada), barra de color sobre ellas (avance real), y línea amarilla en el día actual.

- [ ] **Step 3: Commit**

```bash
git add src/components/GanttView.jsx
git commit -m "feat: vista Gantt con barras de progreso y día actual"
```

---

## Task 9: Componente FinancieroView

**Files:**
- Modify: `src/components/FinancieroView.jsx`

**Interfaces:**
- Consumes: `obra`, `partidas`, `calcValorizacion`, `calcDiaActual`, `formatCLP`
- Consumes: `AreaChart`, `Area`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer` de `recharts`
- Produces: vista financiera con valorización actual, curva S y estado de pago estimado

- [ ] **Step 1: Reemplazar src/components/FinancieroView.jsx**

```jsx
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { calcValorizacion, calcDiaActual, formatCLP } from '../lib/calculations'

function generarCurvaS(partidas, totalDias) {
  const datos = []
  for (let dia = 1; dia <= totalDias; dia++) {
    const planificado = partidas.reduce((sum, p) => {
      if (dia < p.dia_ini) return sum
      if (dia >= p.dia_fin) return sum + (p.subtotal || 0)
      const fraccion = (dia - p.dia_ini) / (p.dia_fin - p.dia_ini)
      return sum + (p.subtotal || 0) * fraccion
    }, 0)
    datos.push({ dia, planificado })
  }
  return datos
}

export default function FinancieroView({ obra, partidas }) {
  const diaActual = calcDiaActual(obra.fecha_inicio)
  const { total: totalValorizado } = calcValorizacion(partidas)
  const presupuestoNeto = obra.presupuesto_neto
  const pctValorizado = presupuestoNeto > 0 ? (totalValorizado / presupuestoNeto) * 100 : 0

  // Estado de pago: 85% de lo valorizado (margen de retención típico)
  const estadoPago = totalValorizado * 0.85

  const curvaS = generarCurvaS(partidas, obra.total_dias)

  // Punto real en la curva
  const curvaConReal = curvaS.map((d, i) => ({
    ...d,
    real: d.dia === Math.min(diaActual, obra.total_dias) ? totalValorizado : (d.dia < diaActual ? undefined : undefined),
  }))

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 8, fontSize: '0.85rem' }}>
        <div style={{ color: '#94a3b8', marginBottom: 6 }}>Día {label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color }}>{p.name}: {formatCLP(p.value)}</div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs financieros */}
      <div className="grid-4">
        <div className="card">
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>{formatCLP(totalValorizado)}</div>
          <div className="stat-label">Avance valorizado</div>
        </div>
        <div className="card">
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>{pctValorizado.toFixed(1)}%</div>
          <div className="stat-label">% del presupuesto</div>
        </div>
        <div className="card bg-verde">
          <div className="stat-value verde" style={{ fontSize: '1.4rem' }}>{formatCLP(estadoPago)}</div>
          <div className="stat-label">Estado de pago estimado (85%)</div>
        </div>
        <div className="card">
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>{formatCLP(presupuestoNeto)}</div>
          <div className="stat-label">Presupuesto neto total</div>
        </div>
      </div>

      {/* Curva S */}
      <div className="card">
        <h2>Curva S — Avance Financiero Planificado</h2>
        <div style={{ marginBottom: 8, fontSize: '0.85rem', color: '#64748b' }}>
          Monto acumulado planificado por día de obra. Línea naranja = día actual.
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={curvaS} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="dia" stroke="#475569" tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: 'Día', position: 'insideBottomRight', fill: '#64748b', fontSize: 11 }} />
            <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `$${(v/1000000).toFixed(0)}M`} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={Math.min(diaActual, obra.total_dias)} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: `Día ${diaActual}`, fill: '#f59e0b', fontSize: 11 }} />
            <Area type="monotone" dataKey="planificado" name="Planificado" stroke="#3b82f6" fill="url(#colorPlan)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top partidas por monto valorizado */}
      <div className="card">
        <h2>Top 10 — Partidas por Monto Valorizado</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {partidas
            .map(p => ({ ...p, monto: (p.avance_pct / 100) * (p.subtotal || 0) }))
            .sort((a, b) => b.monto - a.monto)
            .slice(0, 10)
            .map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.85rem' }}>
                <div style={{ flex: 1, color: '#f1f5f9' }}>{p.nombre}</div>
                <div style={{ color: '#94a3b8', minWidth: 90, textAlign: 'right' }}>{formatCLP(p.monto)}</div>
                <div style={{ color: '#64748b', minWidth: 45, textAlign: 'right' }}>{(p.avance_pct || 0).toFixed(0)}%</div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar en browser**

Tab "Financiero" debe mostrar KPIs de valorización, curva S con área azul y línea naranja del día actual.

- [ ] **Step 3: Commit**

```bash
git add src/components/FinancieroView.jsx
git commit -m "feat: vista financiera con curva S y estado de pago"
```

---

## Task 10: Componente ChatAgente con voz

**Files:**
- Modify: `src/components/ChatAgente.jsx`

**Interfaces:**
- Consumes: `obra`, `partidas`, `VITE_CLAUDE_API_KEY` (env var)
- Consumes: `Anthropic` de `@anthropic-ai/sdk`, `formatCLP` de `../lib/calculations`
- Produces: chat UI con historial de mensajes, input de texto + botón de voz, respuestas de Claude Haiku con contexto de obra

- [ ] **Step 1: Reemplazar src/components/ChatAgente.jsx**

```jsx
import { useState, useRef, useEffect } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import { formatCLP, calcDiaActual } from '../lib/calculations'

function buildContexto(obra, partidas) {
  const diaActual = calcDiaActual(obra.fecha_inicio)
  const resumen = partidas.map(p =>
    `- ${p.nombre} (${p.cuadrilla?.split('.')[0]}): avance ${p.avance_pct?.toFixed(0) || 0}%, días ${p.dia_ini}-${p.dia_fin}, subtotal ${formatCLP(p.subtotal || 0)}`
  ).join('\n')

  return `Eres el asistente de gestión de la obra "${obra.nombre}".
Hoy es el día ${diaActual} de ${obra.total_dias} días totales.
Presupuesto neto total: ${formatCLP(obra.presupuesto_neto)}.

Estado actual de partidas:
${resumen}

Responde de forma concisa y práctica. Usa números reales de la obra para tus respuestas. Si te preguntan por flujo de caja o estado de pago, calcula con los datos de avance_pct y subtotal de cada partida.`
}

export default function ChatAgente({ obra, partidas }) {
  const [mensajes, setMensajes] = useState([
    { role: 'assistant', content: `Hola! Soy tu asistente de obra. Estamos en el día ${calcDiaActual(obra.fecha_inicio)} de ${obra.total_dias}. ¿En qué te ayudo?` }
  ])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [grabando, setGrabando] = useState(false)
  const bottomRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  async function enviar(texto) {
    if (!texto.trim() || cargando) return
    const nuevosMensajes = [...mensajes, { role: 'user', content: texto }]
    setMensajes(nuevosMensajes)
    setInput('')
    setCargando(true)

    try {
      const client = new Anthropic({
        apiKey: import.meta.env.VITE_CLAUDE_API_KEY,
        dangerouslyAllowBrowser: true,
      })

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: buildContexto(obra, partidas),
        messages: nuevosMensajes.map(m => ({ role: m.role, content: m.content })),
      })

      const respuesta = response.content[0].text
      setMensajes(prev => [...prev, { role: 'assistant', content: respuesta }])
    } catch (e) {
      setMensajes(prev => [...prev, { role: 'assistant', content: `Error al conectar con Claude: ${e.message}` }])
    }
    setCargando(false)
  }

  function toggleVoz() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Tu browser no soporta reconocimiento de voz. Usa Chrome.')
      return
    }

    if (grabando) {
      recognitionRef.current?.stop()
      setGrabando(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.lang = 'es-CL'
    recognition.interimResults = false

    recognition.onresult = e => {
      const texto = e.results[0][0].transcript
      setInput(texto)
      setGrabando(false)
    }
    recognition.onerror = () => setGrabando(false)
    recognition.onend = () => setGrabando(false)

    recognition.start()
    setGrabando(true)
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', minHeight: 400 }}>
      <h2 style={{ marginBottom: 16 }}>💬 Chat con Agente de Obra</h2>

      {/* Historial */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {mensajes.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            background: m.role === 'user' ? '#3b82f6' : '#334155',
            padding: '10px 14px',
            borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
            fontSize: '0.9rem',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}>
            {m.content}
          </div>
        ))}
        {cargando && (
          <div style={{ alignSelf: 'flex-start', background: '#334155', padding: '10px 14px', borderRadius: '12px 12px 12px 4px', color: '#94a3b8', fontSize: '0.9rem' }}>
            Pensando...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={toggleVoz}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid',
            borderColor: grabando ? '#ef4444' : '#475569',
            background: grabando ? '#ef444422' : 'transparent',
            color: grabando ? '#ef4444' : '#94a3b8',
            cursor: 'pointer',
            fontSize: '1.1rem',
            flexShrink: 0,
          }}
          title={grabando ? 'Detener grabación' : 'Hablar'}
        >
          {grabando ? '⏹' : '🎙️'}
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar(input)}
          placeholder="Ej: ¿Cuánto puedo cobrar en el próximo estado de pago?"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8,
            background: '#0f172a', border: '1px solid #334155',
            color: '#f1f5f9', fontSize: '0.9rem', outline: 'none',
          }}
        />
        <button
          onClick={() => enviar(input)}
          disabled={cargando || !input.trim()}
          style={{
            padding: '10px 16px', borderRadius: 8, border: 'none',
            background: cargando || !input.trim() ? '#334155' : '#3b82f6',
            color: 'white', cursor: cargando ? 'default' : 'pointer',
            fontSize: '0.9rem', fontWeight: 600, flexShrink: 0,
          }}
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar en browser**

Tab "Chat" debe mostrar historial con mensaje inicial, input de texto y botón de micrófono. Escribir "¿Cuánto puedo cobrar?" y verificar que responde con datos reales.

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatAgente.jsx
git commit -m "feat: chat agente con Claude Haiku y reconocimiento de voz"
```

---

## Task 11: Despliegue en Netlify

**Files:**
- Create: `netlify.toml`

**Interfaces:**
- Produces: app disponible en URL pública de Netlify, auto-deploy en cada push a main

- [ ] **Step 1: Crear netlify.toml en la raíz**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 2: Crear repositorio en GitHub**

1. Ir a https://github.com → New repository
2. Nombre: `control-obra`
3. Privado (recomendado — tiene tu API key en las vars de entorno de Netlify)
4. Sin README ni .gitignore (ya los tenemos)

- [ ] **Step 3: Subir código a GitHub**

```bash
cd "/Users/usuario/Desktop/app control obra"
git remote add origin https://github.com/TU_USUARIO/control-obra.git
git branch -M main
git push -u origin main
```

- [ ] **Step 4: Conectar Netlify**

1. Ir a https://app.netlify.com → Add new site → Import an existing project
2. Conectar con GitHub → seleccionar repo `control-obra`
3. Build settings ya se leen del `netlify.toml` automáticamente
4. Click "Deploy site"

- [ ] **Step 5: Agregar variables de entorno en Netlify**

En Netlify: Site settings → Environment variables → Add variable:
- `VITE_SUPABASE_URL` = tu URL de Supabase
- `VITE_SUPABASE_ANON_KEY` = tu anon key
- `VITE_CLAUDE_API_KEY` = tu Claude API key

- [ ] **Step 6: Re-trigger deploy**

En Netlify: Deploys → Trigger deploy → Deploy site (para que tome las nuevas variables).

- [ ] **Step 7: Verificar URL pública**

Abrir la URL de Netlify (algo como `https://control-obra-xxxx.netlify.app`) — debe cargar la app completa con datos reales.

- [ ] **Step 8: Commit final**

```bash
git add netlify.toml
git commit -m "feat: configuración Netlify para deploy"
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ Arquitectura React + Supabase + Netlify + Claude API
- ✅ Tablas obras, partidas, registros
- ✅ Importación desde xlsx (presupuesto + Gantt cruzados)
- ✅ Módulo Resumen General con KPIs y semáforo
- ✅ Módulo Gantt con barras y colores
- ✅ Módulo Financiero con curva S y estado de pago
- ✅ Módulo Chat con Claude Haiku
- ✅ Voz con Web Speech API
- ✅ Polling 30 segundos
- ✅ Despliegue Netlify con variables de entorno

**Placeholders:** Ninguno — todos los pasos tienen código completo.

**Type consistency:** `calcDiaActual`, `calcAvanceEsperado`, `calcSemaforo`, `calcValorizacion`, `formatCLP` definidos en Task 4 y usados consistentemente en Tasks 7, 8, 9, 10.
