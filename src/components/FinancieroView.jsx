import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import { calcValorizacion, calcDiaActual, formatCLP } from '../lib/calculations'

function generarDatos(partidas, totalDias, diaActual) {
  const datos = []
  for (let dia = 1; dia <= totalDias; dia++) {
    const planificado = partidas.reduce((sum, p) => {
      if (dia < p.dia_ini) return sum
      if (dia >= p.dia_fin) return sum + (p.subtotal || 0)
      return sum + (p.subtotal || 0) * (dia - p.dia_ini) / (p.dia_fin - p.dia_ini)
    }, 0)

    const real = dia <= diaActual
      ? partidas.reduce((sum, p) => {
          if (dia <= p.dia_ini) return sum
          if (dia >= p.dia_fin) return sum + (p.subtotal || 0) * (p.avance_pct || 0) / 100
          const fraccion = (dia - p.dia_ini) / (p.dia_fin - p.dia_ini)
          return sum + (p.subtotal || 0) * (p.avance_pct || 0) / 100 * fraccion
        }, 0)
      : null

    datos.push({ dia, planificado, real })
  }
  return datos
}

const IVA = 0.19

export default function FinancieroView({ obra, partidas }) {
  const diaActual = calcDiaActual(obra.fecha_inicio)
  const { total: valorizadoCD } = calcValorizacion(partidas)

  const gg_pct   = obra.gg_pct  ?? 0
  const util_pct = obra.util_pct ?? 0
  const factor   = 1 + gg_pct / 100 + util_pct / 100

  const cd             = obra.presupuesto_neto
  const presupNeto     = cd * factor
  const presupTotal    = presupNeto * (1 + IVA)
  const valorizadoTotal = valorizadoCD * factor
  const estadoPago     = valorizadoTotal * 0.85
  const pctValorizado  = presupNeto > 0 ? (valorizadoTotal / presupNeto) * 100 : 0

  const tieneGGUtil = gg_pct > 0 || util_pct > 0

  const datos = generarDatos(partidas, obra.total_dias, diaActual)

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', padding: 12, borderRadius: 8, fontSize: '0.85rem' }}>
        <div style={{ color: 'var(--text)', marginBottom: 6, fontFamily: 'var(--mono)', fontSize: '0.7rem' }}>DÍA {label}</div>
        {payload.filter(p => p.value != null).map(p => (
          <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>{p.name}: {formatCLP(p.value)}</div>
        ))}
      </div>
    )
  }

  const desgloseRows = [
    { label: 'Costo Directo (partidas)', monto: cd, tipo: 'sub' },
    ...(tieneGGUtil ? [
      { label: `Gastos Generales (${gg_pct}%)`, monto: cd * gg_pct / 100, tipo: 'sub' },
      { label: `Utilidades (${util_pct}%)`, monto: cd * util_pct / 100, tipo: 'sub' },
    ] : []),
    { label: 'Subtotal Neto', monto: presupNeto, tipo: 'total' },
    { label: 'IVA (19%)', monto: presupNeto * IVA, tipo: 'sub' },
    { label: 'TOTAL CON IVA', monto: presupTotal, tipo: 'grand' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div className="grid-4">
        <div className="card">
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>{formatCLP(valorizadoTotal)}</div>
          <div className="stat-label">Avance valorizado neto</div>
        </div>
        <div className="card">
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>{pctValorizado.toFixed(1)}%</div>
          <div className="stat-label">% del presupuesto neto</div>
        </div>
        <div className="card bg-verde">
          <div className="stat-value verde" style={{ fontSize: '1.4rem' }}>{formatCLP(estadoPago)}</div>
          <div className="stat-label">Estado de pago estimado (85%)</div>
        </div>
        <div className="card">
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>{formatCLP(presupTotal)}</div>
          <div className="stat-label">Presupuesto total c/ IVA</div>
        </div>
      </div>

      {/* Desglose presupuesto */}
      <div className="card">
        <h2 style={{ marginBottom: 14 }}>Desglose Presupuesto</h2>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {desgloseRows.map(({ label, monto, tipo }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 0',
              borderBottom: tipo === 'sub' ? '1px solid var(--border)' : 'none',
              borderTop: tipo === 'total' ? '1px solid var(--gold-bdr)' : tipo === 'grand' ? '1px solid var(--gold-bdr)' : 'none',
              marginTop: tipo === 'grand' ? 4 : 0,
            }}>
              <span style={{
                fontFamily: tipo === 'sub' ? 'var(--font)' : 'var(--disp)',
                fontSize: tipo === 'sub' ? '0.875rem' : tipo === 'total' ? '1rem' : '1.2rem',
                color: tipo === 'sub' ? 'var(--text-m)' : 'var(--text-h)',
                letterSpacing: tipo === 'sub' ? 0 : '0.05em',
              }}>
                {label}
              </span>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: tipo === 'sub' ? '0.875rem' : tipo === 'total' ? '0.95rem' : '1rem',
                color: tipo === 'grand' ? 'var(--gold)' : tipo === 'total' ? 'var(--text-h)' : 'var(--text-m)',
                fontWeight: tipo !== 'sub' ? 600 : 400,
              }}>
                {formatCLP(monto)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Curva S — Planificado vs Real */}
      <div className="card">
        <h2>Curva S — Planificado vs Avance Real</h2>
        <div style={{ marginBottom: 12, fontSize: '0.82rem', color: 'var(--text)' }}>
          Monto acumulado por día. <span style={{ color: 'var(--gold)' }}>━</span> Planificado &nbsp; <span style={{ color: 'var(--verde)' }}>━</span> Real &nbsp; <span style={{ color: 'var(--amarillo)' }}>╌</span> Hoy
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={datos} margin={{ top: 10, right: 16, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPlan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--gold)"  stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--gold)"  stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--verde)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--verde)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="dia" stroke="var(--border-h)" tick={{ fill: 'var(--text)', fontSize: 11 }} label={{ value: 'Día', position: 'insideBottomRight', fill: 'var(--text)', fontSize: 11 }} />
            <YAxis stroke="var(--border-h)" tick={{ fill: 'var(--text)', fontSize: 10 }} tickFormatter={v => `$${(v/1000000).toFixed(0)}M`} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={Math.min(diaActual, obra.total_dias)} stroke="var(--amarillo)" strokeDasharray="4 2" label={{ value: `Día ${diaActual}`, fill: 'var(--amarillo)', fontSize: 11 }} />
            <Area type="monotone" dataKey="planificado" name="Planificado" stroke="var(--gold)"  fill="url(#gradPlan)" strokeWidth={2} dot={false} connectNulls />
            <Area type="monotone" dataKey="real"        name="Real"        stroke="var(--verde)" fill="url(#gradReal)" strokeWidth={2} dot={false} connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top partidas */}
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
