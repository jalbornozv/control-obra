import { useState } from 'react'
import sismiaLogo from './assets/sismia-logo.png'
import sismiaLogoCopia from './assets/sismia-logo-copia.png'
import { useObras } from './hooks/useObras'
import { usePartidas } from './hooks/usePartidas'
import { calcDiaActual, calcAvanceEsperado, calcSemaforo } from './lib/calculations'
import ResumenGeneral from './components/ResumenGeneral'
import GanttView from './components/GanttView'
import FinancieroView from './components/FinancieroView'
import ChatAgente from './components/ChatAgente'
import ReporteView from './components/ReporteView'
import ReportePDF from './components/ReportePDF'
import ProyectoSelector from './components/ProyectoSelector'
import NuevaObra from './components/NuevaObra'
import GestionProyectos from './components/GestionProyectos'
import { getSession } from './lib/auth'
import LoginScreen from './components/LoginScreen'

const IconResumen = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="2" y="2" width="7" height="7" rx="1"/>
    <rect x="11" y="2" width="7" height="7" rx="1"/>
    <rect x="2" y="11" width="7" height="7" rx="1"/>
    <rect x="11" y="11" width="7" height="7" rx="1"/>
  </svg>
)

const IconGantt = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="2" y1="5" x2="13" y2="5"/>
    <line x1="5" y1="10" x2="18" y2="10"/>
    <line x1="2" y1="15" x2="10" y2="15"/>
  </svg>
)

const IconFinanciero = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2,15 6,9 10,12 14,6 18,3"/>
    <line x1="2" y1="18" x2="18" y2="18"/>
  </svg>
)

const IconChat = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3H3a1 1 0 00-1 1v9a1 1 0 001 1h2l2 3 2-3h8a1 1 0 001-1V4a1 1 0 00-1-1z"/>
    <line x1="6" y1="8" x2="14" y2="8"/>
    <line x1="6" y1="11" x2="11" y2="11"/>
  </svg>
)

const IconReporte = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="4" y="2" width="12" height="16" rx="1"/>
    <line x1="7" y1="7" x2="13" y2="7"/>
    <line x1="7" y1="10" x2="13" y2="10"/>
    <line x1="7" y1="13" x2="10" y2="13"/>
  </svg>
)

const IconProyectos = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="11" width="6" height="7" rx="1"/>
    <rect x="12" y="7" width="6" height="11" rx="1"/>
    <rect x="6" y="2" width="8" height="7" rx="1"/>
  </svg>
)

const NAV_ITEMS = [
  { id: 'resumen',    label: 'Resumen',    Icon: IconResumen },
  { id: 'gantt',      label: 'Gantt',      Icon: IconGantt },
  { id: 'financiero', label: 'Financiero', Icon: IconFinanciero },
  { id: 'chat',       label: 'Chat IA',    Icon: IconChat },
  { id: 'reporte',    label: 'Reporte',    Icon: IconReporte },
]

const isPreviewRoute = window.location.pathname === '/reporte-preview'

export default function App() {
  const [tab, setTab] = useState('resumen')
  const [obraSeleccionadaId, setObraSeleccionadaId] = useState(null)
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [sessionState, setSessionState] = useState(() => getSession())

  const { obras, loading: obrasLoading, refetch: refetchObras } = useObras()
  const obraActual = obras.find(o => o.id === obraSeleccionadaId) || (obras.length === 1 ? obras[0] : null)
  const { partidas, loading: partidasLoading, refetch } = usePartidas(obraActual?.id)

  if (isPreviewRoute) return <ReportePDF />

  if (!sessionState) return <LoginScreen onLogin={s => setSessionState(s)} />

  if (sessionState.rol === 'mandante')
    return <div style={{ padding: 24, color: 'var(--text-h)' }}>Panel Mandante — próximamente</div>

  if (sessionState.rol === 'trabajador')
    return <div style={{ padding: 24, color: 'var(--text-h)' }}>Vista Terreno — próximamente</div>

  if (obrasLoading) return <div className="loading">Cargando</div>

  if (mostrarNueva) return (
    <NuevaObra
      onImportada={id => { setObraSeleccionadaId(id); setMostrarNueva(false) }}
      onCancelar={() => setMostrarNueva(false)}
    />
  )

  if (!obraActual) return (
    <ProyectoSelector
      obras={obras}
      onSeleccionar={setObraSeleccionadaId}
      onNueva={() => setMostrarNueva(true)}
    />
  )

  const diaActual = calcDiaActual(obraActual.fecha_inicio)
  const diaLabel  = Math.min(Math.max(1, diaActual), obraActual.total_dias)

  const avanceGlobal   = partidas.length ? partidas.reduce((s, p) => s + (p.avance_pct || 0), 0) / partidas.length : 0
  const avanceEsperado = partidas.length ? partidas.reduce((s, p) => s + calcAvanceEsperado(diaActual, p.dia_ini, p.dia_fin), 0) / partidas.length : 0
  const semGlobal      = partidas.length ? calcSemaforo(avanceGlobal, avanceEsperado) : 'gris'

  return (
    <div className="app">
      <aside className="rail">
        <div
          className={`rail-logo${obras.length > 1 ? ' clickable' : ''}`}
          onClick={() => obras.length > 1 && setObraSeleccionadaId(null)}
          title={obras.length > 1 ? 'Cambiar proyecto' : undefined}
        >
          <img src={sismiaLogoCopia} alt="Sismia" className="rail-logo-img" />
        </div>

        <nav className="rail-nav">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`rail-item${tab === id ? ' active' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon />
              <span className="rail-label">{label}</span>
            </button>
          ))}
        </nav>

        <div className="rail-bottom">
          <button
            className={`rail-item${tab === 'proyectos' ? ' active' : ''}`}
            onClick={() => setTab('proyectos')}
          >
            <IconProyectos />
            <span className="rail-label">Proyectos</span>
          </button>
        </div>
      </aside>

      <div className="app-body">
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-obra">{obraActual.nombre.toUpperCase()}</span>
            <span className="topbar-sep">·</span>
            <span className="topbar-dia">Día {diaLabel} / {obraActual.total_dias}</span>
            <span className={`topbar-sem ${semGlobal}`} />
          </div>
          <div className="topbar-center">
            <img src={sismiaLogo} alt="Sismia" className="topbar-brand-logo" />
            <span className="topbar-brand-name">Gestionador de Obras Sismia</span>
          </div>
          <div className="topbar-right" />
        </header>

        <main className="app-main">
          {tab === 'resumen'    && <ResumenGeneral obra={obraActual} partidas={partidas} loading={partidasLoading} />}
          {tab === 'gantt'      && <GanttView obra={obraActual} partidas={partidas} loading={partidasLoading} />}
          {tab === 'financiero' && <FinancieroView obra={obraActual} partidas={partidas} loading={partidasLoading} />}
          {tab === 'chat'       && <ChatAgente obra={obraActual} partidas={partidas} onAvanceUpdated={refetch} />}
          {tab === 'reporte'    && <ReporteView obra={obraActual} partidas={partidas} />}
          {tab === 'proyectos'  && (
            <GestionProyectos
              obras={obras}
              onCambiarObra={id => { setObraSeleccionadaId(id); setTab('resumen') }}
              onObrasActualizadas={id => { refetchObras(); setObraSeleccionadaId(id); setTab('resumen') }}
            />
          )}
        </main>
      </div>
    </div>
  )
}
