# Chat que actualiza BD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender el ChatAgente existente para que pueda actualizar el avance de partidas en Supabase directamente desde el browser usando Claude tool use.

**Architecture:** Se agrega una tool `actualizar_partida` al llamado de Claude API. Cuando el usuario reporta avances en lenguaje natural, Claude invoca la tool con el partida_id y avance_pct. La app ejecuta el PATCH a Supabase y un INSERT en registros, luego muestra confirmación en el chat y dispara un re-fetch inmediato de partidas.

**Tech Stack:** React, Anthropic SDK (tool use), Supabase JS client, todo en archivos existentes.

## Global Constraints

- Modelo Claude: `claude-haiku-4-5-20251001`
- Supabase URL: `https://smeqmbgnsvdssewkvgzr.supabase.co`
- Tool name: `actualizar_partida` (exacto, el system prompt la referencia)
- `avance_pct` debe ser 0–100 (validado en el schema de la tool)
- Mensaje de confirmación en verde: `✅ Actualizado: [nombre] → [X]%`
- Mensaje de error en rojo: `❌ Error al actualizar [nombre]: [mensaje]`
- El system prompt debe incluir el ID de cada partida junto a su nombre (para que Claude pueda referenciarlos)
- `calcDiaActual` importado de `../lib/calculations`

---

## File Structure

```
src/
├── hooks/
│   └── usePartidas.js        ← MODIFY: exponer fetchPartidas como refetch
├── App.jsx                   ← MODIFY: pasar refetch como onAvanceUpdated a ChatAgente
└── components/
    └── ChatAgente.jsx        ← MODIFY: tool definition + tool_use handling
```

---

## Task 1: Exponer refetch desde usePartidas y cablear prop en App.jsx

**Files:**
- Modify: `src/hooks/usePartidas.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Produces: `usePartidas()` retorna `{ partidas, loading, error, refetch }` donde `refetch` es la función `fetchPartidas`
- Produces: `<ChatAgente onAvanceUpdated={refetch} />` prop disponible

- [ ] **Step 1: Modificar src/hooks/usePartidas.js para exponer refetch**

Reemplazar el return de la función:

```js
// Antes:
return { partidas, loading, error }

// Después:
return { partidas, loading, error, refetch: fetchPartidas }
```

El archivo completo queda así:

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

  return { partidas, loading, error, refetch: fetchPartidas }
}
```

- [ ] **Step 2: Modificar src/App.jsx para pasar onAvanceUpdated a ChatAgente**

Reemplazar el archivo completo:

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
  const { partidas, loading: partidasLoading, refetch } = usePartidas(obra?.id)

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
        {tab === 'chat' && <ChatAgente {...props} onAvanceUpdated={refetch} />}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verificar que la app compila sin errores**

```bash
cd "/Users/usuario/Desktop/app control obra"
npm run build
```
Esperado: build exitoso, sin errores de TypeScript/lint.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePartidas.js src/App.jsx
git commit -m "feat: exponer refetch desde usePartidas, cablear onAvanceUpdated en App"
```

---

## Task 2: Tool use en ChatAgente — definición, ejecución y confirmación

**Files:**
- Modify: `src/components/ChatAgente.jsx`

**Interfaces:**
- Consumes: `onAvanceUpdated` prop (función, llamar después de actualizar Supabase)
- Consumes: `supabase` de `../lib/supabase`
- Consumes: `calcDiaActual` de `../lib/calculations`
- Consumes: `partidas` prop — array de objetos con `{id, nombre, avance_pct, ...}`

- [ ] **Step 1: Reemplazar src/components/ChatAgente.jsx completo**

```jsx
import { useState, useRef, useEffect } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import { formatCLP, calcDiaActual } from '../lib/calculations'
import { supabase } from '../lib/supabase'

const anthropicClient = new Anthropic({
  apiKey: import.meta.env.VITE_CLAUDE_API_KEY,
  dangerouslyAllowBrowser: true,
})

const TOOL_ACTUALIZAR = {
  name: 'actualizar_partida',
  description: 'Actualiza el porcentaje de avance de una partida de obra en la base de datos. Úsala cuando el usuario reporte avance o termine una partida.',
  input_schema: {
    type: 'object',
    properties: {
      partida_id: {
        type: 'string',
        description: 'UUID de la partida a actualizar (usar el id exacto de la lista)',
      },
      avance_pct: {
        type: 'number',
        description: 'Porcentaje de avance entre 0 y 100',
        minimum: 0,
        maximum: 100,
      },
      nota: {
        type: 'string',
        description: 'Observación opcional sobre el avance',
      },
    },
    required: ['partida_id', 'avance_pct'],
  },
}

function buildContexto(obra, partidas) {
  const diaActual = calcDiaActual(obra.fecha_inicio)
  const resumen = partidas.map(p =>
    `- [ID:${p.id}] ${p.nombre} (${p.cuadrilla?.split('.')[0]}): avance ${(p.avance_pct || 0).toFixed(0)}%, días ${p.dia_ini}-${p.dia_fin}, subtotal ${formatCLP(p.subtotal || 0)}`
  ).join('\n')

  return `Eres el asistente de gestión de la obra "${obra.nombre}".
Hoy es el día ${diaActual} de ${obra.total_dias} días totales.
Presupuesto neto total: ${formatCLP(obra.presupuesto_neto)}.

Estado actual de partidas (usa los IDs exactos para actualizar):
${resumen}

Tienes acceso a la tool "actualizar_partida". Úsala cuando el usuario reporte avance o termine una partida.
Si el usuario hace una pregunta (flujo de caja, proyecciones, estado), responde sin usar la tool.
Si hay ambigüedad sobre qué partida actualizar, pregunta antes de usar la tool.
Responde siempre en español, de forma concisa y práctica.`
}

async function ejecutarActualizacion(tool_use, diaActual) {
  const { partida_id, avance_pct, nota = '' } = tool_use.input

  const { error: patchError } = await supabase
    .from('partidas')
    .update({ avance_pct, updated_at: new Date().toISOString() })
    .eq('id', partida_id)

  if (patchError) throw new Error(patchError.message)

  await supabase.from('registros').insert({
    partida_id,
    dia_obra: diaActual,
    avance_pct,
    nota,
  })
}

export default function ChatAgente({ obra, partidas, onAvanceUpdated }) {
  const diaActual = calcDiaActual(obra.fecha_inicio)
  const [mensajes, setMensajes] = useState([
    { role: 'assistant', content: `Hola! Soy tu asistente de obra. Estamos en el día ${diaActual} de ${obra.total_dias}. Puedo responder preguntas y también actualizar el avance de partidas si me dices cómo va la obra.` }
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
      const response = await anthropicClient.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: buildContexto(obra, partidas),
        tools: [TOOL_ACTUALIZAR],
        messages: nuevosMensajes.map(m => ({ role: m.role, content: m.content })),
      })

      if (response.stop_reason === 'tool_use') {
        const toolUses = response.content.filter(b => b.type === 'tool_use')
        const resultados = []
        let huboError = false

        for (const toolUse of toolUses) {
          const partida = partidas.find(p => p.id === toolUse.input.partida_id)
          const nombre = partida?.nombre || toolUse.input.partida_id
          try {
            await ejecutarActualizacion(toolUse, diaActual)
            resultados.push(`✅ ${nombre} → ${toolUse.input.avance_pct}%`)
          } catch (e) {
            resultados.push(`❌ Error al actualizar ${nombre}: ${e.message}`)
            huboError = true
          }
        }

        const confirmacion = resultados.join('\n')
        setMensajes(prev => [...prev, { role: 'assistant', content: confirmacion }])
        if (!huboError) onAvanceUpdated?.()

      } else {
        const textBlock = response.content.find(b => b.type === 'text')
        setMensajes(prev => [...prev, { role: 'assistant', content: textBlock?.text || '' }])
      }

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
      setInput(e.results[0][0].transcript)
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

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={toggleVoz}
          style={{
            padding: '10px 14px', borderRadius: 8, border: '1px solid',
            borderColor: grabando ? '#ef4444' : '#475569',
            background: grabando ? '#ef444422' : 'transparent',
            color: grabando ? '#ef4444' : '#94a3b8',
            cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0,
          }}
          title={grabando ? 'Detener grabación' : 'Hablar'}
        >
          {grabando ? '⏹' : '🎙️'}
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar(input)}
          placeholder="Ej: Terminé demolición de pisos, tabiquería va al 60%"
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

- [ ] **Step 2: Verificar build sin errores**

```bash
cd "/Users/usuario/Desktop/app control obra"
npm run build
```
Esperado: build exitoso.

- [ ] **Step 3: Probar manualmente en dev server**

```bash
npm run dev
```
1. Abrir `http://localhost:5173` → tab Chat
2. Escribir: `"Terminé el retiro de piso flotante 1er nivel"`
3. Esperado: chat muestra `✅ Retiro de piso flotante existente 1er Nivel → 100%`
4. Verificar en Supabase Table Editor → partidas → esa partida tiene `avance_pct = 100`
5. Verificar en tabla `registros` → hay un nuevo registro para esa partida

- [ ] **Step 4: Commit**

```bash
git add src/components/ChatAgente.jsx
git commit -m "feat: chat actualiza BD via Claude tool use"
```

- [ ] **Step 5: Push y verificar deploy en Netlify**

```bash
git push
```
Netlify auto-despliega (~1 min). Verificar en https://controobrasismia.netlify.app que el chat funciona igual que en local.

---

## Self-Review

**Spec coverage:**
- ✅ Tool `actualizar_partida` con schema JSON definido
- ✅ System prompt incluye ID de cada partida
- ✅ Detecta `stop_reason === 'tool_use'`
- ✅ PATCH a `partidas` con nuevo `avance_pct`
- ✅ INSERT en `registros` con `dia_obra`, `avance_pct`, `nota`
- ✅ Mensaje confirmación `✅ [nombre] → [X]%`
- ✅ Mensaje error `❌ Error al actualizar [nombre]: [mensaje]`
- ✅ `onAvanceUpdated` llamado después de actualizaciones exitosas
- ✅ Si es pregunta (stop_reason === 'end_turn'), responde normalmente sin tocar BD

**Placeholders:** Ninguno.

**Type consistency:** `partida_id` (string UUID), `avance_pct` (number 0-100), `nota` (string opcional) — consistente entre schema de tool y función `ejecutarActualizacion`.
