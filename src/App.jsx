import { useState } from 'react'
import { useObras } from './hooks/useObras'
import { usePartidas } from './hooks/usePartidas'
import ResumenGeneral from './components/ResumenGeneral'
import GanttView from './components/GanttView'
import FinancieroView from './components/FinancieroView'
import ChatAgente from './components/ChatAgente'
import ReporteView from './components/ReporteView'
import ReportePDF from './components/ReportePDF'
import ProyectoSelector from './components/ProyectoSelector'
import NuevaObra from './components/NuevaObra'
import GestionProyectos from './components/GestionProyectos'

const NAV_PRINCIPAL = [
  { id: 'resumen',    label: 'Resumen' },
  { id: 'gantt',      label: 'Gantt' },
  { id: 'financiero', label: 'Financiero' },
  { id: 'chat',       label: 'Chat IA' },
  { id: 'reporte',    label: 'Reporte' },
]

const NAV_GESTION = [
  { id: 'proyectos', label: 'Proyectos' },
]

const isPreviewRoute = window.location.pathname === '/reporte-preview'

export default function App() {
  const [tab, setTab] = useState('resumen')
  const [obraSeleccionadaId, setObraSeleccionadaId] = useState(null)
  const [mostrarNueva, setMostrarNueva] = useState(false)

  const { obras, loading: obrasLoading, refetch: refetchObras } = useObras()
  const obraActual = obras.find(o => o.id === obraSeleccionadaId) || (obras.length === 1 ? obras[0] : null)
  const { partidas, loading: partidasLoading, refetch } = usePartidas(obraActual?.id)

  if (isPreviewRoute) return <ReportePDF />

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

  const NavItem = ({ id, label }) => (
    <button
      className={`nav-item${tab === id ? ' active' : ''}`}
      onClick={() => setTab(id)}
    >
      <span className="nav-dot" />
      {label}
    </button>
  )

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">Control Obra</div>
          <div
            className={`sidebar-obra${obras.length > 1 ? ' clickable' : ''}`}
            onClick={() => obras.length > 1 && setObraSeleccionadaId(null)}
            title={obras.length > 1 ? 'Cambiar proyecto' : undefined}
          >
            {obraActual.nombre}
            {obras.length > 1 && (
              <span style={{ color: 'var(--gold)', marginLeft: 5 }}>↓</span>
            )}
          </div>
        </div>

        <div className="nav-section-label">Obra</div>
        {NAV_PRINCIPAL.map(n => <NavItem key={n.id} {...n} />)}

        <div className="sidebar-divider" />

        <div className="nav-section-label">Gestión</div>
        {NAV_GESTION.map(n => <NavItem key={n.id} {...n} />)}

        <div className="sidebar-footer">
          Control Obra<br />
          Supabase · Netlify
        </div>
      </aside>

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
  )
}
