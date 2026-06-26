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
                          width: `${((p.dia_fin - p.dia_ini + 1) / totalDias) * 100 * (Math.min(p.avance_pct, 100) / 100)}%`,
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
