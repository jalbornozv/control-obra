import { calcDiaActual, calcAvanceEsperado, calcSemaforo } from '../lib/calculations'

const SEM_COLOR = {
  verde:    'var(--verde)',
  amarillo: 'var(--amarillo)',
  rojo:     'var(--rojo)',
  gris:     'var(--gris)',
}

export default function ResumenGeneral({ obra, partidas }) {
  const diaActual          = calcDiaActual(obra.fecha_inicio)
  const diasRestantes      = obra.total_dias - diaActual + 1

  const avanceGlobal = partidas.length
    ? partidas.reduce((s, p) => s + (p.avance_pct || 0), 0) / partidas.length
    : 0

  const avanceEsperado = partidas.length
    ? partidas.reduce((s, p) => s + calcAvanceEsperado(diaActual, p.dia_ini, p.dia_fin), 0) / partidas.length
    : 0

  const semaforo = calcSemaforo(avanceGlobal, avanceEsperado)

  // Cuadrillas
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
      sem: calcSemaforo(p.avance_pct, calcAvanceEsperado(diaActual, p.dia_ini, p.dia_fin)),
    }))
    .filter(p => p.sem === 'rojo')
    .sort((a, b) => (b.esperado - b.avance_pct) - (a.esperado - a.avance_pct))
    .slice(0, 5)

  const diasLabel = diaActual > obra.total_dias ? obra.total_dias : Math.max(1, diaActual)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Page header */}
      <div className="page-header">
        <div className="page-title">Resumen</div>
        <span className="page-tag">
          Día {diasLabel} / {obra.total_dias}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid-4">
        <div className="card">
          <div className="stat-value">{diasLabel}</div>
          <div className="stat-label">Día de obra</div>
        </div>

        <div className="card">
          <div
            className="stat-value"
            style={{ color: diasRestantes <= 10 ? 'var(--rojo)' : 'var(--text-h)' }}
          >
            {Math.max(0, diasRestantes)}
          </div>
          <div className="stat-label">Días restantes</div>
        </div>

        <div className="card">
          <div className="stat-value">{avanceGlobal.toFixed(1)}%</div>
          <div className="stat-label">Avance real</div>
        </div>

        <div className={`card bg-${semaforo}`}>
          <div className="stat-value" style={{ color: SEM_COLOR[semaforo] }}>
            {semaforo.toUpperCase()}
          </div>
          <div className="stat-label">Estado general</div>
        </div>
      </div>

      {/* Barra de progreso global */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ marginBottom: 0 }}>Progreso global</h2>
          <div style={{ display: 'flex', gap: 18, fontSize: '0.68rem', fontFamily: 'var(--mono)', color: 'var(--text)' }}>
            <span>
              Real{' '}
              <strong style={{ color: SEM_COLOR[semaforo] }}>{avanceGlobal.toFixed(1)}%</strong>
            </span>
            <span>
              Plan{' '}
              <strong style={{ color: 'var(--text-m)' }}>{avanceEsperado.toFixed(1)}%</strong>
            </span>
          </div>
        </div>

        {/* Barra */}
        <div style={{ background: 'var(--s3)', borderRadius: 3, height: 10, position: 'relative', overflow: 'hidden' }}>
          {/* Planificado */}
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${Math.min(avanceEsperado, 100)}%`,
            background: 'var(--s4)',
          }} />
          {/* Real */}
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${Math.min(avanceGlobal, 100)}%`,
            background: SEM_COLOR[semaforo],
            transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
          }} />
          {/* Líneas divisorias */}
          {[25, 50, 75].map(pct => (
            <div key={pct} style={{
              position: 'absolute', left: `${pct}%`, top: 0,
              width: 1, height: '100%', background: 'rgba(7,8,15,.5)',
            }} />
          ))}
        </div>

        {/* Ticks de regla — elemento distintivo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          {[0, 25, 50, 75, 100].map(pct => (
            <div key={pct} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: 1, height: 4, background: 'var(--border-h)' }} />
              <span style={{ fontSize: '0.55rem', fontFamily: 'var(--mono)', color: 'var(--text)', letterSpacing: '0.04em' }}>
                {pct}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2">
        {/* Estado por cuadrilla */}
        <div className="card">
          <h2>Cuadrillas</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {Object.entries(cuadrillas).map(([nombre, items]) => {
              const avg    = items.reduce((s, p) => s + (p.avance_pct || 0), 0) / items.length
              const avgEsp = items.reduce((s, p) => s + calcAvanceEsperado(diaActual, p.dia_ini, p.dia_fin), 0) / items.length
              const sem    = calcSemaforo(avg, avgEsp)
              return (
                <div key={nombre} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: SEM_COLOR[sem], flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-m)', lineHeight: 1.3 }}>
                    {nombre}
                  </div>
                  <div style={{ fontSize: '0.68rem', fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                    {avg.toFixed(0)}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Partidas críticas */}
        <div className="card">
          <h2>Partidas críticas</h2>
          {atrasadas.length === 0 ? (
            <p style={{ color: 'var(--verde)', fontSize: '0.78rem', fontFamily: 'var(--mono)' }}>
              Sin atrasos críticos
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {atrasadas.map(p => (
                <div key={p.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 9 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-h)', marginBottom: 4, lineHeight: 1.3 }}>
                    {p.nombre}
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: '0.65rem', fontFamily: 'var(--mono)' }}>
                    <span style={{ color: 'var(--text)' }}>
                      Real{' '}<strong style={{ color: 'var(--rojo)' }}>{(p.avance_pct || 0).toFixed(0)}%</strong>
                    </span>
                    <span style={{ color: 'var(--text)' }}>
                      Plan{' '}<strong style={{ color: 'var(--text-m)' }}>{p.esperado.toFixed(0)}%</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
