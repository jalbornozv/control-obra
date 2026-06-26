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

  const { error: regError } = await supabase.from('registros').insert({
    partida_id,
    dia_obra: diaActual,
    avance_pct,
    nota,
  })
  if (regError) console.warn('Error registrando avance en historial:', regError.message)
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

        for (const toolUse of toolUses) {
          const partida = partidas.find(p => p.id === toolUse.input.partida_id)
          const nombre = partida?.nombre || toolUse.input.partida_id
          try {
            await ejecutarActualizacion(toolUse, diaActual)
            resultados.push(`✅ Actualizado: ${nombre} → ${toolUse.input.avance_pct}%`)
            onAvanceUpdated?.()
          } catch (e) {
            resultados.push(`❌ Error al actualizar ${nombre}: ${e.message}`)
          }
        }

        const confirmacion = resultados.join('\n')
        setMensajes(prev => [...prev, { role: 'assistant', content: confirmacion }])

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
