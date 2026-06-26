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
    .sort((a, b) => (b.esperado - b.avance_pct) - (a.esperado - a.avance_pct))
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
