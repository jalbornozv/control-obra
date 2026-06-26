import { calcDiaActual } from '../lib/calculations'

export default function ProyectoSelector({ obras, onSeleccionar, onNueva }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    }}>
      {/* Eyebrow */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        fontFamily: 'var(--mono)',
        fontSize: '0.62rem',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'var(--gold)',
      }}>
        <span style={{ display: 'block', width: 36, height: 1, background: 'var(--gold)' }} />
        Sistema de control
      </div>

      {/* Título */}
      <h1 style={{
        fontFamily: 'var(--disp)',
        fontSize: 'clamp(2.8rem, 8vw, 5rem)',
        letterSpacing: '0.05em',
        color: 'var(--text-h)',
        lineHeight: 1,
        marginBottom: 8,
        textAlign: 'center',
        fontWeight: 400,
      }}>
        Control Obra
      </h1>

      <p style={{
        color: 'var(--text)',
        fontSize: '0.75rem',
        marginBottom: 48,
        fontFamily: 'var(--mono)',
        letterSpacing: '0.06em',
      }}>
        Selecciona un proyecto para continuar
      </p>

      {/* Lista de obras */}
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {obras.map(obra => {
          const diaActual      = calcDiaActual(obra.fecha_inicio)
          const diasRestantes  = Math.max(0, obra.total_dias - diaActual + 1)

          return (
            <button
              key={obra.id}
              onClick={() => onSeleccionar(obra.id)}
              style={{
                background: 'var(--s1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--rl)',
                padding: '18px 22px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
                width: '100%',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--gold)'
                e.currentTarget.style.background  = 'var(--gold-bg)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background  = 'var(--s1)'
              }}
            >
              <div style={{
                fontFamily: 'var(--font)',
                fontWeight: 500,
                color: 'var(--text-h)',
                marginBottom: 9,
                fontSize: '0.88rem',
              }}>
                {obra.nombre}
              </div>
              <div style={{
                display: 'flex',
                gap: 20,
                fontSize: '0.65rem',
                color: 'var(--text)',
                fontFamily: 'var(--mono)',
                letterSpacing: '0.04em',
              }}>
                <span>Día {diaActual} / {obra.total_dias}</span>
                <span>{diasRestantes} días restantes</span>
                <span>Inicio {obra.fecha_inicio}</span>
              </div>
            </button>
          )
        })}

        {/* Nueva obra */}
        <button
          onClick={onNueva}
          style={{
            background: 'transparent',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--rl)',
            padding: '15px 22px',
            cursor: 'pointer',
            color: 'var(--text)',
            fontSize: '0.78rem',
            fontFamily: 'var(--font)',
            transition: 'border-color 0.15s, color 0.15s',
            marginTop: 4,
            letterSpacing: '0.02em',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--gold)'
            e.currentTarget.style.color       = 'var(--gold)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color       = 'var(--text)'
          }}
        >
          + Nueva Obra
        </button>
      </div>
    </div>
  )
}
