import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { calcValorizacion, calcDiaActual, formatCLP } from '../lib/calculations'

function generarCurvaS(partidas, totalDias) {
  const datos = []
  for (let dia = 1; dia <= totalDias; dia++) {
    const planificado = partidas.reduce((sum, p) => {
      if (dia < p.dia_ini) return sum
      if (dia >= p.dia_fin) return sum + (p.subtotal || 0)
      const fraccion = (dia - p.dia_ini) / (p.dia_fin - p.dia_ini)
      return sum + (p.subtotal || 0) * fraccion
    }, 0)
    datos.push({ dia, planificado })
  }
  return datos
}

export default function FinancieroView({ obra, partidas }) {
  const diaActual = calcDiaActual(obra.fecha_inicio)
  const { total: totalValorizado } = calcValorizacion(partidas)
  const presupuestoNeto = obra.presupuesto_neto
  const pctValorizado = presupuestoNeto > 0 ? (totalValorizado / presupuestoNeto) * 100 : 0

  // Estado de pago: 85% de lo valorizado (margen de retención típico)
  const estadoPago = totalValorizado * 0.85

  const curvaS = generarCurvaS(partidas, obra.total_dias)

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 8, fontSize: '0.85rem' }}>
        <div style={{ color: '#94a3b8', marginBottom: 6 }}>Día {label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color }}>{p.name}: {formatCLP(p.value)}</div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs financieros */}
      <div className="grid-4">
        <div className="card">
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>{formatCLP(totalValorizado)}</div>
          <div className="stat-label">Avance valorizado</div>
        </div>
        <div className="card">
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>{pctValorizado.toFixed(1)}%</div>
          <div className="stat-label">% del presupuesto</div>
        </div>
        <div className="card bg-verde">
          <div className="stat-value verde" style={{ fontSize: '1.4rem' }}>{formatCLP(estadoPago)}</div>
          <div className="stat-label">Estado de pago estimado (85%)</div>
        </div>
        <div className="card">
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>{formatCLP(presupuestoNeto)}</div>
          <div className="stat-label">Presupuesto neto total</div>
        </div>
      </div>

      {/* Curva S */}
      <div className="card">
        <h2>Curva S — Avance Financiero Planificado</h2>
        <div style={{ marginBottom: 8, fontSize: '0.85rem', color: '#64748b' }}>
          Monto acumulado planificado por día de obra. Línea naranja = día actual.
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={curvaS} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="dia" stroke="#475569" tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: 'Día', position: 'insideBottomRight', fill: '#64748b', fontSize: 11 }} />
            <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `$${(v/1000000).toFixed(0)}M`} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={Math.min(diaActual, obra.total_dias)} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: `Día ${diaActual}`, fill: '#f59e0b', fontSize: 11 }} />
            <Area type="monotone" dataKey="planificado" name="Planificado" stroke="#3b82f6" fill="url(#colorPlan)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top partidas por monto valorizado */}
      <div className="card">
        <h2>Top 10 — Partidas por Monto Valorizado</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {partidas
            .map(p => ({ ...p, monto: (p.avance_pct / 100) * (p.subtotal || 0) }))
            .sort((a, b) => b.monto - a.monto)
            .slice(0, 10)
            .map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.85rem' }}>
                <div style={{ flex: 1, color: '#f1f5f9' }}>{p.nombre}</div>
                <div style={{ color: '#94a3b8', minWidth: 90, textAlign: 'right' }}>{formatCLP(p.monto)}</div>
                <div style={{ color: '#64748b', minWidth: 45, textAlign: 'right' }}>{(p.avance_pct || 0).toFixed(0)}%</div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
