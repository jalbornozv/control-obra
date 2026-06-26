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
  const { total: valorizadoCD } = calcValorizacion(partidas)

  const gg_pct  = obra.gg_pct  ?? 0
  const util_pct = obra.util_pct ?? 0
  const factor  = 1 + gg_pct / 100 + util_pct / 100

  const cd           = obra.presupuesto_neto
  const presupTotal  = cd * factor
  const valorizadoTotal = valorizadoCD * factor
  const estadoPago   = valorizadoTotal * 0.85
  const pctValorizado = presupTotal > 0 ? (valorizadoTotal / presupTotal) * 100 : 0

  const tieneGGUtil = gg_pct > 0 || util_pct > 0

  const curvaS = generarCurvaS(partidas, obra.total_dias)

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', padding: 12, borderRadius: 8, fontSize: '0.85rem' }}>
        <div style={{ color: 'var(--text)', marginBottom: 6, fontFamily: 'var(--mono)', fontSize: '0.7rem' }}>DÍA {label}</div>
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
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>{formatCLP(valorizadoTotal)}</div>
          <div className="stat-label">Avance valorizado{tieneGGUtil ? ' (c/ GG+Util)' : ''}</div>
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
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>{formatCLP(presupTotal)}</div>
          <div className="stat-label">Presupuesto total{tieneGGUtil ? ` (CD + GG ${gg_pct}% + Util ${util_pct}%)` : ''}</div>
        </div>
      </div>

      {/* Desglose presupuesto si tiene GG/Util */}
      {tieneGGUtil && (
        <div className="card">
          <h2 style={{ marginBottom: 14 }}>Desglose Presupuesto</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Costo Directo (partidas)', monto: cd, sub: true },
              { label: `Gastos Generales (${gg_pct}%)`, monto: cd * gg_pct / 100, sub: true },
              { label: `Utilidades (${util_pct}%)`, monto: cd * util_pct / 100, sub: true },
              { label: 'TOTAL', monto: presupTotal, sub: false },
            ].map(({ label, monto, sub }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '9px 0',
                borderBottom: sub ? '1px solid var(--border)' : 'none',
                borderTop: !sub ? '1px solid var(--gold-bdr)' : 'none',
              }}>
                <span style={{ fontFamily: sub ? 'var(--font)' : 'var(--disp)', fontSize: sub ? '0.85rem' : '1.1rem', color: sub ? 'var(--text-m)' : 'var(--text-h)', letterSpacing: sub ? 0 : '0.05em' }}>
                  {label}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: sub ? '0.85rem' : '0.95rem', color: sub ? 'var(--text-m)' : 'var(--gold)' }}>
                  {formatCLP(monto)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Curva S */}
      <div className="card">
        <h2>Curva S — Avance Financiero Planificado</h2>
        <div style={{ marginBottom: 8, fontSize: '0.85rem', color: 'var(--text)' }}>
          Monto acumulado planificado por día de obra. Línea naranja = día actual.
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={curvaS} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--gold)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--gold)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="dia" stroke="var(--border-h)" tick={{ fill: 'var(--text)', fontSize: 11 }} label={{ value: 'Día', position: 'insideBottomRight', fill: 'var(--text)', fontSize: 11 }} />
            <YAxis stroke="var(--border-h)" tick={{ fill: 'var(--text)', fontSize: 10 }} tickFormatter={v => `$${(v/1000000).toFixed(0)}M`} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={Math.min(diaActual, obra.total_dias)} stroke="var(--amarillo)" strokeDasharray="4 2" label={{ value: `Día ${diaActual}`, fill: 'var(--amarillo)', fontSize: 11 }} />
            <Area type="monotone" dataKey="planificado" name="Planificado" stroke="var(--gold)" fill="url(#colorPlan)" strokeWidth={2} dot={false} />
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
                <div style={{ flex: 1, color: 'var(--text-h)' }}>{p.nombre}</div>
                <div style={{ color: 'var(--text-m)', minWidth: 90, textAlign: 'right', fontFamily: 'var(--mono)' }}>{formatCLP(p.monto)}</div>
                <div style={{ color: 'var(--text)', minWidth: 45, textAlign: 'right', fontFamily: 'var(--mono)' }}>{(p.avance_pct || 0).toFixed(0)}%</div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
