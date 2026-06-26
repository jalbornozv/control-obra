import { useState } from 'react'
import { calcDiaActual, calcAvanceEsperado, calcSemaforo } from '../lib/calculations'

const SEM_COLOR = {
  verde:    'var(--verde)',
  amarillo: 'var(--amarillo)',
  rojo:     'var(--rojo)',
  gris:     'var(--gris)',
}

export default function GanttView({ obra, partidas }) {
  const diaActual  = calcDiaActual(obra.fecha_inicio)
  const [filtro, setFiltro] = useState('Todas')

  const cuadrillas = ['Todas', ...new Set(partidas.map(p => p.cuadrilla).filter(Boolean))]
  const filtradas  = filtro === 'Todas' ? partidas : partidas.filter(p => p.cuadrilla === filtro)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Page header */}
      <div className="page-header">
        <div className="page-title">Gantt</div>
        <span className="page-tag">
          Día {Math.min(diaActual, obra.total_dias)} / {obra.total_dias}
        </span>
      </div>

      {/* Filtros */}
      <div className="filter-pills">
        {cuadrillas.map(c => (
          <button
            key={c}
            className={`pill${filtro === c ? ' active' : ''}`}
            onClick={() => setFiltro(c)}
          >
            {c.split('.')[0]}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 280, minWidth: 200 }}>Partida</th>
              <th style={{ width: 60, textAlign: 'center' }}>Ini</th>
              <th style={{ width: 60, textAlign: 'center' }}>Fin</th>
              <th style={{ width: 80, textAlign: 'center' }}>Real</th>
              <th style={{ minWidth: 280 }}>Progreso</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(p => {
              const esperado = calcAvanceEsperado(diaActual, p.dia_ini, p.dia_fin)
              const semaforo = calcSemaforo(p.avance_pct, esperado)
              const color    = SEM_COLOR[semaforo]
              const totalDias = obra.total_dias

              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ color: 'var(--text-h)', fontWeight: 500, fontSize: '0.8rem' }}>
                      {p.nombre}
                    </div>
                    <div style={{ color: 'var(--text)', fontSize: '0.65rem', marginTop: 2, fontFamily: 'var(--mono)' }}>
                      {p.cuadrilla?.split('.')[0]}
                    </div>
                  </td>
                  <td className="m" style={{ textAlign: 'center', color: 'var(--text)' }}>{p.dia_ini}</td>
                  <td className="m" style={{ textAlign: 'center', color: 'var(--text)' }}>{p.dia_fin}</td>
                  <td className="m" style={{ textAlign: 'center', color, fontWeight: 600 }}>
                    {(p.avance_pct || 0).toFixed(0)}%
                  </td>
                  <td>
                    <div style={{ position: 'relative', height: 18, background: 'var(--bg)', borderRadius: 3 }}>
                      {/* Ventana planificada */}
                      <div style={{
                        position: 'absolute',
                        left: `${((p.dia_ini - 1) / totalDias) * 100}%`,
                        width: `${((p.dia_fin - p.dia_ini + 1) / totalDias) * 100}%`,
                        height: '100%',
                        background: 'var(--s4)',
                        borderRadius: 3,
                      }} />
                      {/* Avance real */}
                      <div style={{
                        position: 'absolute',
                        left: `${((p.dia_ini - 1) / totalDias) * 100}%`,
                        width: `${((p.dia_fin - p.dia_ini + 1) / totalDias) * 100 * (Math.min(p.avance_pct || 0, 100) / 100)}%`,
                        height: '100%',
                        background: color,
                        borderRadius: 3,
                        transition: 'width 0.4s',
                        opacity: 0.85,
                      }} />
                      {/* Línea día actual */}
                      <div style={{
                        position: 'absolute',
                        left: `${(Math.min(diaActual, totalDias) / totalDias) * 100}%`,
                        width: 1,
                        height: '100%',
                        background: 'var(--gold)',
                        opacity: 0.7,
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
  )
}
