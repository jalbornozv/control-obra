import { calcDiaActual } from '../lib/calculations'

export default function ProyectoSelector({ obras, onSeleccionar, onNueva }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>🏗️ Control Obra</h1>
      <p style={{ color: '#64748b', marginBottom: 32 }}>Selecciona un proyecto</p>

      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {obras.map(obra => {
          const diaActual = calcDiaActual(obra.fecha_inicio)
          const diasRestantes = Math.max(0, obra.total_dias - diaActual + 1)
          return (
            <button
              key={obra.id}
              onClick={() => onSeleccionar(obra.id)}
              style={{
                background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
                padding: '16px 20px', cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
            >
              <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: 6 }}>{obra.nombre}</div>
              <div style={{ display: 'flex', gap: 16, fontSize: '0.82rem', color: '#64748b' }}>
                <span>📅 Día {diaActual} / {obra.total_dias}</span>
                <span>⏳ {diasRestantes} días restantes</span>
                <span>📆 Inicio: {obra.fecha_inicio}</span>
              </div>
            </button>
          )
        })}

        <button
          onClick={onNueva}
          style={{
            background: 'transparent', border: '2px dashed #334155', borderRadius: 12,
            padding: '16px 20px', cursor: 'pointer', color: '#64748b',
            fontSize: '0.9rem', transition: 'all 0.15s', marginTop: 8,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#64748b' }}
        >
          ➕ Nueva Obra
        </button>
      </div>
    </div>
  )
}
