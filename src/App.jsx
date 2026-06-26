import { useState } from 'react'
import { useObra } from './hooks/useObra'
import { usePartidas } from './hooks/usePartidas'
import ResumenGeneral from './components/ResumenGeneral'
import GanttView from './components/GanttView'
import FinancieroView from './components/FinancieroView'
import ChatAgente from './components/ChatAgente'

const TABS = [
  { id: 'resumen', label: '📊 Resumen' },
  { id: 'gantt', label: '📅 Gantt' },
  { id: 'financiero', label: '💰 Financiero' },
  { id: 'chat', label: '💬 Chat' },
]

export default function App() {
  const [tab, setTab] = useState('resumen')
  const { obra, loading: obraLoading } = useObra()
  const { partidas, loading: partidasLoading, refetch } = usePartidas(obra?.id)

  if (obraLoading) return <div className="loading">Cargando obra...</div>
  if (!obra) return <div className="loading">No se encontró ninguna obra.</div>

  const props = { obra, partidas, loading: partidasLoading }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏗️ {obra.nombre}</h1>
        <nav className="tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {tab === 'resumen' && <ResumenGeneral {...props} />}
        {tab === 'gantt' && <GanttView {...props} />}
        {tab === 'financiero' && <FinancieroView {...props} />}
        {tab === 'chat' && <ChatAgente {...props} onAvanceUpdated={refetch} />}
      </main>
    </div>
  )
}
