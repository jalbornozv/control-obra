import { useState } from 'react'
import sismiaLogo from '../assets/sismia-logo.png'
import { loginAdmin, loginTrabajador, loginMandante, setSession } from '../lib/auth'

const ROLES = [
  { id: 'admin',      label: 'Administrador' },
  { id: 'trabajador', label: 'Trabajador'     },
  { id: 'mandante',   label: 'Mandante'       },
]

export default function LoginScreen({ onLogin }) {
  const [rol, setRol]       = useState(null)
  const [nombre, setNombre] = useState('')
  const [pin, setPin]       = useState('')
  const [error, setError]   = useState('')
  const [cargando, setCargando] = useState(false)

  function volver() { setRol(null); setNombre(''); setPin(''); setError('') }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      let session = null
      if (rol === 'admin')      session = await loginAdmin(pin)
      if (rol === 'trabajador') session = await loginTrabajador(nombre.trim(), pin)
      if (rol === 'mandante')   session = await loginMandante(pin)
      if (!session) { setError('PIN incorrecto'); return }
      setSession(session)
      onLogin(session)
    } catch {
      setError('Error al conectar. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src={sismiaLogo} alt="Sismia" style={{ height: 48, opacity: 0.9 }} />
        <p className="login-title">CONTROL OBRA</p>

        {!rol
          ? (
            <div className="login-roles">
              {ROLES.map(r => (
                <button key={r.id} className="login-rol-btn" onClick={() => setRol(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
          ) : (
            <>
              <button className="login-back" onClick={volver}>← Volver</button>
              <form className="login-form" onSubmit={handleSubmit}>
                {rol === 'trabajador' && (
                  <input
                    className="login-input"
                    placeholder="Tu nombre"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    required
                    autoComplete="off"
                  />
                )}
                <input
                  className="login-input"
                  type="password"
                  inputMode="numeric"
                  placeholder="PIN"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  required
                />
                {error && <p className="login-error">{error}</p>}
                <button className="login-submit" type="submit" disabled={cargando}>
                  {cargando ? 'Verificando...' : 'Entrar'}
                </button>
              </form>
            </>
          )
        }
      </div>
    </div>
  )
}
