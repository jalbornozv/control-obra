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

const TABS = [
  { id: 'resumen', label: '📊 Resumen' },
  { id: 'gantt', label: '📅 Gantt' },
  { id: 'financiero', label: '💰 Financiero' },
  { id: 'chat', label: '💬 Chat' },
  { id: 'reporte', label: '📄 Reporte' },
]

const isPreviewRoute = window.location.pathname === '/reporte-preview'

export default function App() {
  const [tab, setTab] = useState('resumen')
  const [obraSeleccionadaId, setObraSeleccionadaId] = useState(null)
  const [mostrarNueva, setMostrarNueva] = useState(false)

  const { obras, loading: obrasLoading } = useObras()
  const obraActual = obras.find(o => o.id === obraSeleccionadaId) || (obras.length === 1 ? obras[0] : null)
  const { partidas, loading: partidasLoading, refetch } = usePartidas(obraActual?.id)

  if (isPreviewRoute) return <ReportePDF />

  if (obrasLoading) return <div className="loading">Cargando...</div>

  if (mostrarNueva) {
    return (
      <NuevaObra
        onImportada={id => { setObraSeleccionadaId(id); setMostrarNueva(false) }}
        onCancelar={() => setMostrarNueva(false)}
      />
    )
  }

  if (!obraActual) {
    return (
      <ProyectoSelector
        obras={obras}
        onSeleccionar={setObraSeleccionadaId}
        onNueva={() => setMostrarNueva(true)}
      />
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1
          style={{ cursor: obras.length > 1 ? 'pointer' : 'default' }}
          onClick={() => obras.length > 1 && setObraSeleccionadaId(null)}
        >
          🏗️ {obraActual.nombre}
          {obras.length > 1 && <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 8 }}>▼ cambiar</span>}
        </h1>
        <nav className="tabs">
          {TABS.map(t => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {tab === 'resumen' && <ResumenGeneral obra={obraActual} partidas={partidas} loading={partidasLoading} />}
        {tab === 'gantt' && <GanttView obra={obraActual} partidas={partidas} loading={partidasLoading} />}
        {tab === 'financiero' && <FinancieroView obra={obraActual} partidas={partidas} loading={partidasLoading} />}
        {tab === 'chat' && <ChatAgente obra={obraActual} partidas={partidas} loading={partidasLoading} onAvanceUpdated={refetch} />}
        {tab === 'reporte' && <ReporteView obra={obraActual} partidas={partidas} />}
      </main>
    </div>
  )
}
