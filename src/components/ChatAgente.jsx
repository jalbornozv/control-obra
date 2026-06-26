import { useState, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'
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

  const gg_pct   = obra.gg_pct  ?? 0
  const util_pct = obra.util_pct ?? 0
  const factor   = 1 + gg_pct / 100 + util_pct / 100
  const presupTotal = obra.presupuesto_neto * factor

  return `Eres el asistente de gestión de la obra "${obra.nombre}".
Hoy es el día ${diaActual} de ${obra.total_dias} días totales.
Costo directo (partidas): ${formatCLP(obra.presupuesto_neto)}.
${gg_pct > 0 || util_pct > 0 ? `Gastos Generales: ${gg_pct}% | Utilidades: ${util_pct}% | Presupuesto total: ${formatCLP(presupTotal)}.
Al proyectar estado de pago o avance financiero, usa el presupuesto total (que incluye GG y utilidades de forma proporcional al avance del costo directo).` : ''}

Estado actual de partidas (usa los IDs exactos para actualizar):
${resumen}

Tienes acceso a la tool "actualizar_partida". Úsala cuando el usuario reporte avance o termine una partida.
Si el usuario hace una pregunta (flujo de caja, proyecciones, estado), responde sin usar la tool.
Si hay ambigüedad sobre qué partida actualizar, pregunta antes de usar la tool.
Responde siempre en español, de forma concisa y práctica.
Usa formato markdown en tus respuestas: **negrita** para valores clave, listas con - para enumerar partidas o puntos, y encabezados ## solo si la respuesta es larga y necesita secciones.`
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
    { role: 'assistant', content: `Hola. Estamos en el día ${diaActual} de ${obra.total_dias}. Puedo responder preguntas sobre la obra y actualizar el avance de partidas — dime cómo va el día.` }
  ])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [grabando, setGrabando] = useState(false)
  const [inputFocus, setInputFocus] = useState(false)
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
            resultados.push(`✓ ${nombre} → ${toolUse.input.avance_pct}%`)
            onAvanceUpdated?.()
          } catch (e) {
            resultados.push(`✗ Error al actualizar ${nombre}: ${e.message}`)
          }
        }

        setMensajes(prev => [...prev, { role: 'assistant', content: resultados.join('\n') }])

      } else {
        const textBlock = response.content.find(b => b.type === 'text')
        setMensajes(prev => [...prev, { role: 'assistant', content: textBlock?.text || '' }])
      }

    } catch (e) {
      setMensajes(prev => [...prev, { role: 'assistant', content: `Error al conectar: ${e.message}` }])
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
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', minHeight: 400, padding: '20px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span className="chat-status-dot" />
        <h2 style={{ fontFamily: 'var(--disp)', fontSize: '1.6rem', letterSpacing: '0.06em', color: 'var(--text-h)', margin: 0, lineHeight: 1 }}>
          AGENTE DE OBRA
        </h2>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          DÍA {diaActual} / {obra.total_dias}
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, paddingRight: 4 }}>
        {mensajes.map((m, i) => (
          m.role === 'user'
            ? (
              <div key={i} style={{
                alignSelf: 'flex-end',
                maxWidth: '75%',
                background: 'var(--gold-bg)',
                border: '1px solid var(--gold-bdr)',
                padding: '10px 14px',
                borderRadius: '12px 12px 4px 12px',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                color: 'var(--text-h)',
                whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            ) : (
              <div key={i} style={{
                alignSelf: 'flex-start',
                maxWidth: '82%',
                background: 'var(--s3)',
                borderLeft: '2px solid var(--gold)',
                padding: '10px 14px 10px 16px',
                borderRadius: '0 10px 10px 0',
              }}>
                <Markdown className="chat-md">{m.content}</Markdown>
              </div>
            )
        ))}

        {cargando && (
          <div style={{ alignSelf: 'flex-start', background: 'var(--s3)', borderLeft: '2px solid var(--gold-bdr)', padding: '12px 18px', borderRadius: '0 10px 10px 0', display: 'flex', gap: 5, alignItems: 'center' }}>
            <span className="chat-dot" style={{ animationDelay: '0s' }} />
            <span className="chat-dot" style={{ animationDelay: '0.2s' }} />
            <span className="chat-dot" style={{ animationDelay: '0.4s' }} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={toggleVoz}
          title={grabando ? 'Detener grabación' : 'Hablar'}
          style={{
            padding: '10px 13px',
            borderRadius: 'var(--r)',
            border: '1px solid',
            borderColor: grabando ? 'var(--rojo)' : 'var(--border-h)',
            background: grabando ? 'var(--rojo-bg)' : 'transparent',
            color: grabando ? 'var(--rojo)' : 'var(--text)',
            cursor: 'pointer',
            fontSize: '1rem',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          {grabando ? '⏹' : '🎙️'}
        </button>

        <input
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar(input)}
          placeholder="Ej: Terminé demolición de pisos, tabiquería va al 60%"
        />

        <button
          onClick={() => enviar(input)}
          disabled={cargando || !input.trim()}
          style={{
            padding: '10px 18px',
            borderRadius: 'var(--r)',
            border: 'none',
            background: cargando || !input.trim() ? 'var(--s3)' : 'var(--gold)',
            color: cargando || !input.trim() ? 'var(--text)' : '#07080F',
            cursor: cargando || !input.trim() ? 'default' : 'pointer',
            fontFamily: 'var(--font)',
            fontSize: '0.875rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
