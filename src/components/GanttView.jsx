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
  const filtradas  = (filtro === 'Todas' ? partidas : partidas.filter(p => p.cuadrilla === filtro))
    .slice().sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0))

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
              <th style={{ width: 36, textAlign: 'center' }}>N°</th>
              <th style={{ width: 280, minWidth: 200 }}>Partida</th>
              <th style={{ width: 60, textAlign: 'center' }}>Ini</th>
              <th style={{ width: 60, textAlign: 'center' }}>Fin</th>
              <th style={{ width: 80, textAlign: 'center' }}>Real</th>
              <th style={{ minWidth: 280 }}>Progreso</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(p => {
              const esperado  = calcAvanceEsperado(diaActual, p.dia_ini, p.dia_fin)
              const semaforo  = calcSemaforo(p.avance_pct, esperado)
              const color     = SEM_COLOR[semaforo]
              const totalDias = obra.total_dias
              const avance    = Math.min(p.avance_pct || 0, 100)
              const pLeft     = ((p.dia_ini - 1) / totalDias) * 100
              const pWidth    = ((p.dia_fin - p.dia_ini + 1) / totalDias) * 100

              return (
                <tr key={p.id}>
                  <td className="m" style={{ textAlign: 'center', color: 'var(--text)', fontSize: '0.72rem' }}>
                    {p.numero}
                  </td>
                  <td>
                    <div style={{ color: 'var(--text-h)', fontWeight: 500, fontSize: '0.875rem' }}>
                      {p.nombre}
                    </div>
                    <div style={{ color: 'var(--text)', fontSize: '0.72rem', marginTop: 2, fontFamily: 'var(--mono)' }}>
                      {p.cuadrilla?.split('.')[0]}
                    </div>
                  </td>
                  <td className="m" style={{ textAlign: 'center', color: 'var(--text)' }}>{p.dia_ini}</td>
                  <td className="m" style={{ textAlign: 'center', color: 'var(--text)' }}>{p.dia_fin}</td>
                  <td className="m" style={{ textAlign: 'center', color, fontWeight: 600 }}>
                    {avance.toFixed(0)}%
                  </td>
                  <td>
                    {/* Track completo */}
                    <div style={{ position: 'relative', height: 22, background: 'var(--s2)', borderRadius: 4, border: '1px solid var(--border)' }}>
                      {/* Ventana planificada */}
                      <div style={{
                        position: 'absolute',
                        left: `${pLeft}%`,
                        width: `${pWidth}%`,
                        height: '100%',
                        background: 'var(--s4)',
                        borderLeft: '1px solid var(--border-h)',
                        borderRight: '1px solid var(--border-h)',
                        boxSizing: 'border-box',
                      }} />
                      {/* Avance real — barra sólida */}
                      <div style={{
                        position: 'absolute',
                        left: `${pLeft}%`,
                        width: `${pWidth * avance / 100}%`,
                        height: '100%',
                        background: color,
                        borderRadius: avance >= 100 ? 3 : '3px 0 0 3px',
                        transition: 'width 0.4s',
                      }} />
                      {/* Línea día actual */}
                      <div style={{
                        position: 'absolute',
                        left: `${(Math.min(diaActual, totalDias) / totalDias) * 100}%`,
                        width: 2,
                        height: '100%',
                        background: 'var(--gold)',
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
