import { useState } from 'react'
import { generarChips, validarPeriodo, filtrarPartidasPeriodo, calcResumenPeriodo } from '../lib/reporte'
import { calcDiaActual, calcValorizacion, formatCLP } from '../lib/calculations'

export default function ReporteView({ obra, partidas }) {
  const diaActual = calcDiaActual(obra.fecha_inicio)
  const chips = generarChips(obra.total_dias)

  const [chipActivo, setChipActivo] = useState(0)
  const [diaIniManual, setDiaIniManual] = useState('')
  const [diaFinManual, setDiaFinManual] = useState('')
  const [modoManual, setModoManual] = useState(false)
  const [errorPeriodo, setErrorPeriodo] = useState('')
  const [secciones, setSecciones] = useState({
    resumenEjecutivo: true,
    tablaPartidas: true,
    ganttPeriodo: true,
    resumenFinanciero: true,
  })

  const periodoActual = modoManual
    ? { diaIni: Number(diaIniManual), diaFin: Number(diaFinManual) }
    : chips[chipActivo]

  const partidasFiltradas = periodoActual?.diaIni && periodoActual?.diaFin
    ? filtrarPartidasPeriodo(partidas, periodoActual.diaIni, periodoActual.diaFin)
    : []

  const resumen = calcResumenPeriodo(partidasFiltradas, periodoActual?.diaIni || 1, periodoActual?.diaFin || obra.total_dias, diaActual)
  const { total: totalValorizado } = calcValorizacion(partidas)
  const ningunaSeccion = !Object.values(secciones).some(Boolean)

  function handlePreview() {
    if (modoManual) {
      const { valido, error } = validarPeriodo(Number(diaIniManual), Number(diaFinManual), obra.total_dias)
      if (!valido) { setErrorPeriodo(error); return }
    }
    setErrorPeriodo('')

    const config = {
      obra,
      partidas,
      periodo: periodoActual,
      secciones,
      diaActual,
      totalValorizado,
      generadoEn: new Date().toISOString(),
    }
    localStorage.setItem('reporte_preview', JSON.stringify(config))
    window.open('/reporte-preview', '_blank')
  }

  const toggleSeccion = key => setSecciones(prev => ({ ...prev, [key]: !prev[key] }))

  const chipStyle = (activo) => ({
    padding: '6px 14px', borderRadius: 20, border: '1px solid',
    borderColor: activo ? '#3b82f6' : '#334155',
    background: activo ? '#3b82f620' : 'transparent',
    color: activo ? '#3b82f6' : '#94a3b8',
    cursor: 'pointer', fontSize: '0.82rem', whiteSpace: 'nowrap',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>
      {/* Selector de periodo */}
      <div className="card">
        <h2>Periodo del reporte</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {chips.map((chip, i) => (
            <button
              key={i}
              style={chipStyle(!modoManual && chipActivo === i)}
              onClick={() => { setChipActivo(i); setModoManual(false); setErrorPeriodo('') }}
            >
              {chip.label}
            </button>
          ))}
          <button
            style={chipStyle(modoManual)}
            onClick={() => { setModoManual(true); setErrorPeriodo('') }}
          >
            Rango manual
          </button>
        </div>

        {modoManual && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Día</span>
            <input
              type="number" min={1} max={obra.total_dias}
              value={diaIniManual}
              onChange={e => setDiaIniManual(e.target.value)}
              style={{ width: 70, padding: '6px 10px', borderRadius: 6, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: '0.85rem' }}
            />
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>al día</span>
            <input
              type="number" min={1} max={obra.total_dias}
              value={diaFinManual}
              onChange={e => setDiaFinManual(e.target.value)}
              style={{ width: 70, padding: '6px 10px', borderRadius: 6, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: '0.85rem' }}
            />
            <span style={{ color: '#64748b', fontSize: '0.82rem' }}>de {obra.total_dias}</span>
          </div>
        )}
        {errorPeriodo && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 8 }}>{errorPeriodo}</div>}
      </div>

      {/* Secciones */}
      <div className="card">
        <h2>Secciones a incluir</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['resumenEjecutivo', '📊 Resumen ejecutivo'],
            ['tablaPartidas', '📋 Tabla de partidas'],
            ['ganttPeriodo', '📅 Gantt del periodo'],
            ['resumenFinanciero', '💰 Resumen financiero'],
          ].map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem', color: '#f1f5f9' }}>
              <input
                type="checkbox"
                checked={secciones[key]}
                onChange={() => toggleSeccion(key)}
                style={{ width: 16, height: 16, accentColor: '#3b82f6' }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Preview de datos del periodo */}
      {partidasFiltradas.length > 0 && (
        <div className="card">
          <h2>Preview del periodo</h2>
          <div className="grid-4" style={{ marginTop: 8 }}>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{partidasFiltradas.length}</div>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Partidas en el periodo</div>
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{resumen.avanceGlobal.toFixed(1)}%</div>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Avance promedio</div>
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{resumen.completadasEnPeriodo}</div>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Partidas completadas</div>
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{formatCLP(totalValorizado)}</div>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Valorizado total</div>
            </div>
          </div>
        </div>
      )}

      {/* Botón */}
      <button
        onClick={handlePreview}
        disabled={ningunaSeccion || partidasFiltradas.length === 0}
        style={{
          padding: '14px 24px', borderRadius: 10, border: 'none',
          background: ningunaSeccion || partidasFiltradas.length === 0 ? '#334155' : '#3b82f6',
          color: 'white', cursor: ningunaSeccion || partidasFiltradas.length === 0 ? 'default' : 'pointer',
          fontSize: '1rem', fontWeight: 600, alignSelf: 'flex-start',
        }}
      >
        🖨️ Vista previa y exportar
      </button>
      {ningunaSeccion && <div style={{ color: '#ef4444', fontSize: '0.82rem' }}>Selecciona al menos una sección.</div>}
    </div>
  )
}
