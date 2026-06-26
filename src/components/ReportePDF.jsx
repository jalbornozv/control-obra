import { useEffect, useState } from 'react'
import { calcAvanceEsperado, calcSemaforo, calcValorizacion, formatCLP } from '../lib/calculations'
import { filtrarPartidasPeriodo } from '../lib/reporte'

const SEMAFORO_LABEL = { verde: '✅ Al día', amarillo: '⚠️ Leve atraso', rojo: '🔴 Atrasado', gris: '⬜ No iniciado' }
const SEMAFORO_COLOR_PRINT = { verde: '#16a34a', amarillo: '#ca8a04', rojo: '#dc2626', gris: '#6b7280' }

function SeccionResumenEjecutivo({ obra, partidas, periodo, diaActual, resumen }) {
  const semaforoGlobal = calcSemaforo(resumen.avanceGlobal, resumen.avanceEsperado)
  const diasRestantes = Math.max(0, obra.total_dias - diaActual + 1)
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: '1.1rem', borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 16 }}>Resumen Ejecutivo</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          ['Día de obra', `${diaActual} / ${obra.total_dias}`],
          ['Días restantes', diasRestantes],
          ['Avance real', `${resumen.avanceGlobal.toFixed(1)}%`],
          ['Estado general', SEMAFORO_LABEL[semaforoGlobal]],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, fontSize: '0.9rem', color: '#374151' }}>
        Periodo: Días {periodo.diaIni} al {periodo.diaFin} &nbsp;|&nbsp;
        Partidas en periodo: {resumen.totalPartidas} &nbsp;|&nbsp;
        Completadas: {resumen.completadasEnPeriodo}
      </div>
    </section>
  )
}

function SeccionTablaPartidas({ partidas, diaActual }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: '1.1rem', borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 16 }}>Tabla de Partidas</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            {['N°', 'Partida', 'Cuadrilla', 'Días', 'Avance %', 'Estado'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', border: '1px solid #e5e7eb', color: '#374151' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {partidas.map((p, i) => {
            const esperado = calcAvanceEsperado(diaActual, p.dia_ini, p.dia_fin)
            const semaforo = calcSemaforo(p.avance_pct || 0, esperado)
            return (
              <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', color: '#6b7280' }}>{p.numero || '-'}</td>
                <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', color: '#111827', fontWeight: 500 }}>{p.nombre}</td>
                <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.75rem' }}>{p.cuadrilla?.split('.')[0]}</td>
                <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', color: '#374151' }}>{p.dia_ini}-{p.dia_fin}</td>
                <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', fontWeight: 700, color: '#111827' }}>{(p.avance_pct || 0).toFixed(0)}%</td>
                <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', color: SEMAFORO_COLOR_PRINT[semaforo], fontWeight: 600, fontSize: '0.75rem' }}>
                  {SEMAFORO_LABEL[semaforo]}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function SeccionGantt({ partidas, periodo, diaActual }) {
  const { diaIni, diaFin } = periodo
  const totalDias = diaFin - diaIni + 1
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: '1.1rem', borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 16 }}>Gantt del Periodo (Días {diaIni}-{diaFin})</h2>
      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 8 }}>
        ▲ Línea naranja = día actual ({diaActual}) &nbsp;|&nbsp; Barra gris = ventana planificada &nbsp;|&nbsp; Barra de color = avance real
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ padding: '6px 10px', textAlign: 'left', border: '1px solid #e5e7eb', width: 220 }}>Partida</th>
            <th style={{ padding: '6px 10px', border: '1px solid #e5e7eb' }}>Progreso</th>
          </tr>
        </thead>
        <tbody>
          {partidas.map((p, i) => {
            const esperado = calcAvanceEsperado(diaActual, p.dia_ini, p.dia_fin)
            const semaforo = calcSemaforo(p.avance_pct || 0, esperado)
            const color = SEMAFORO_COLOR_PRINT[semaforo]
            const iniRel = Math.max(0, p.dia_ini - diaIni)
            const finRel = Math.min(totalDias, p.dia_fin - diaIni + 1)
            const anchoPlan = ((finRel - iniRel) / totalDias) * 100
            const offsetPlan = (iniRel / totalDias) * 100
            const anchoReal = anchoPlan * Math.min((p.avance_pct || 0) / 100, 1)
            const offsetActual = ((Math.min(diaActual, diaFin) - diaIni) / totalDias) * 100
            return (
              <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                <td style={{ padding: '6px 10px', border: '1px solid #e5e7eb', color: '#111827' }}>{p.nombre}</td>
                <td style={{ padding: '6px 10px', border: '1px solid #e5e7eb' }}>
                  <div style={{ position: 'relative', height: 14, background: '#f3f4f6', borderRadius: 3 }}>
                    <div style={{ position: 'absolute', left: `${offsetPlan}%`, width: `${anchoPlan}%`, height: '100%', background: '#d1d5db', borderRadius: 3 }} />
                    <div style={{ position: 'absolute', left: `${offsetPlan}%`, width: `${anchoReal}%`, height: '100%', background: color, borderRadius: 3 }} />
                    {diaActual >= diaIni && diaActual <= diaFin && (
                      <div style={{ position: 'absolute', left: `${offsetActual}%`, width: 2, height: '100%', background: '#f97316' }} />
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function SeccionFinanciero({ partidas, obra }) {
  const { total: totalValorizado } = calcValorizacion(partidas)
  const estadoPago = totalValorizado * 0.85
  const pct = obra.presupuesto_neto > 0 ? (totalValorizado / obra.presupuesto_neto) * 100 : 0
  const top5 = partidas
    .map(p => ({ ...p, monto: ((p.avance_pct || 0) / 100) * (p.subtotal || 0) }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5)
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: '1.1rem', borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 16 }}>Resumen Financiero</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          ['Avance valorizado', formatCLP(totalValorizado)],
          ['% del presupuesto', `${pct.toFixed(1)}%`],
          ['Estado de pago est. (85%)', formatCLP(estadoPago)],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: 8 }}>Top 5 partidas por monto valorizado</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            {['Partida', 'Avance %', 'Monto valorizado'].map(h => (
              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', border: '1px solid #e5e7eb', color: '#374151' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {top5.map((p, i) => (
            <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
              <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', color: '#111827' }}>{p.nombre}</td>
              <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', color: '#374151' }}>{(p.avance_pct || 0).toFixed(0)}%</td>
              <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb', fontWeight: 600, color: '#111827' }}>{formatCLP(p.monto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function ReportePDF() {
  const [config, setConfig] = useState(null)

  useEffect(() => {
    const raw = localStorage.getItem('reporte_preview')
    if (raw) {
      localStorage.removeItem('reporte_preview')
      setConfig(JSON.parse(raw))
    }
  }, [])

  if (!config) return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#374151' }}>
      <p>No hay datos de reporte. Vuelve al dashboard y genera un reporte.</p>
    </div>
  )

  const { obra, partidas, periodo, secciones, diaActual } = config
  const partidasPeriodo = filtrarPartidasPeriodo(partidas, periodo.diaIni, periodo.diaFin)
  const resumen = {
    avanceGlobal: partidasPeriodo.length ? partidasPeriodo.reduce((s, p) => s + (p.avance_pct || 0), 0) / partidasPeriodo.length : 0,
    avanceEsperado: partidasPeriodo.length ? partidasPeriodo.reduce((s, p) => s + calcAvanceEsperado(diaActual, p.dia_ini, p.dia_fin), 0) / partidasPeriodo.length : 0,
    completadasEnPeriodo: partidasPeriodo.filter(p => p.avance_pct >= 100).length,
    totalPartidas: partidasPeriodo.length,
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #111827; }
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          section { page-break-inside: avoid; }
        }
      `}</style>

      {/* Header no-print */}
      <div className="no-print" style={{ background: '#1e293b', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 0 }}>
        <span style={{ color: '#f8fafc', fontWeight: 600 }}>🖨️ Reporte listo para imprimir</span>
        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Presiona Cmd+P (Mac) o Ctrl+P (Windows) → Guardar como PDF</span>
        <button
          onClick={() => window.print()}
          style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 600 }}
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      {/* Contenido del reporte */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 40px' }}>
        {/* Header del reporte */}
        <div style={{ marginBottom: 32, borderBottom: '3px solid #111827', paddingBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Control Obra — Reporte de Avance</div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>{obra.nombre}</h1>
              <div style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 4 }}>
                Periodo: Días {periodo.diaIni} al {periodo.diaFin} &nbsp;·&nbsp;
                Generado: {new Date(config.generadoEn).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        {secciones.resumenEjecutivo && <SeccionResumenEjecutivo obra={obra} partidas={partidasPeriodo} periodo={periodo} diaActual={diaActual} resumen={resumen} />}
        {secciones.tablaPartidas && <SeccionTablaPartidas partidas={partidasPeriodo} diaActual={diaActual} />}
        {secciones.ganttPeriodo && <SeccionGantt partidas={partidasPeriodo} periodo={periodo} diaActual={diaActual} />}
        {secciones.resumenFinanciero && <SeccionFinanciero partidas={partidas} obra={obra} />}
      </div>
    </>
  )
}
