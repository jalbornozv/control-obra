import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { clearSession } from '../lib/auth'
import { calcDiaActual, calcAvanceEsperado, calcSemaforo } from '../lib/calculations'

export default function PanelCliente({ obraId, onLogout }) {
  const [obra, setObra]         = useState(null)
  const [partidas, setPartidas] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function cargar() {
      const [{ data: o }, { data: p }] = await Promise.all([
        supabase.from('obras').select('id, nombre, fecha_inicio, total_dias').eq('id', obraId).single(),
        supabase.from('partidas')
          .select('id, numero, nombre, cuadrilla, dia_ini, dia_fin, avance_pct')
          .eq('obra_id', obraId).order('numero'),
      ])
      setObra(o)
      setPartidas(p || [])
      setLoading(false)
    }
    cargar()
  }, [obraId])

  if (loading) return <div className="loading">Cargando</div>
  if (!obra) return <div className="loading">Obra no encontrada</div>

  const dia          = calcDiaActual(obra.fecha_inicio)
  const diaLabel     = Math.min(Math.max(1, dia), obra.total_dias)
  const avanceGlobal = partidas.length ? partidas.reduce((s, p) => s + (p.avance_pct || 0), 0) / partidas.length : 0
  const avanceEsp    = partidas.length ? partidas.reduce((s, p) => s + calcAvanceEsperado(dia, p.dia_ini, p.dia_fin), 0) / partidas.length : 0
  const sem          = calcSemaforo(avanceGlobal, avanceEsp)

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '28px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <h1 style={{ fontFamily: 'var(--disp)', fontSize: '1.8rem', letterSpacing: '0.06em', color: 'var(--text-h)', lineHeight: 1 }}>
          {obra.nombre.toUpperCase()}
        </h1>
        <button className="btn" onClick={() => { clearSession(); onLogout() }} style={{ flexShrink: 0 }}>
          Salir
        </button>
      </div>

      <p style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 28 }}>
        DÍA {diaLabel} / {obra.total_dias}
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Avance Global
          </span>
          <span className={sem} style={{ fontFamily: 'var(--disp)', fontSize: '2.4rem', lineHeight: 1 }}>
            {avanceGlobal.toFixed(1)}%
          </span>
        </div>
        <div style={{ background: 'var(--s4)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
          <div style={{ background: `var(--${sem})`, height: 8, width: `${avanceGlobal}%`, borderRadius: 4, transition: 'width 0.5s' }} />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Partida</th>
              <th>Cuadrilla</th>
              <th style={{ textAlign: 'right' }}>Avance</th>
            </tr>
          </thead>
          <tbody>
            {partidas.map(p => (
              <tr key={p.id}>
                <td className="m">{p.numero}</td>
                <td>{p.nombre}</td>
                <td style={{ color: 'var(--text)' }}>{p.cuadrilla}</td>
                <td className="m" style={{ textAlign: 'right' }}>{(p.avance_pct || 0).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
