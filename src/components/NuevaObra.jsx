import { useState } from 'react'
import { importarObra } from '../lib/importar'

export default function NuevaObra({ onImportada, onCancelar }) {
  const [nombre, setNombre] = useState('')
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0])
  const [presupuestoFile, setPresupuestoFile] = useState(null)
  const [ganttFile, setGanttFile] = useState(null)
  const [progreso, setProgreso] = useState('')
  const [error, setError] = useState('')
  const [importando, setImportando] = useState(false)

  async function handleImportar() {
    if (!nombre.trim()) return setError('El nombre del proyecto es requerido.')
    if (!presupuestoFile) return setError('Sube el archivo de presupuesto.')
    if (!ganttFile) return setError('Sube el archivo de carta Gantt.')

    setError('')
    setImportando(true)
    try {
      const obraId = await importarObra(nombre.trim(), fechaInicio, presupuestoFile, ganttFile, setProgreso)
      onImportada(obraId)
    } catch (e) {
      setError(e.message)
      setProgreso('')
    }
    setImportando(false)
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    background: '#0f172a', border: '1px solid #334155',
    color: '#f1f5f9', fontSize: '0.9rem', outline: 'none',
  }

  const labelStyle = { display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#94a3b8' }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 480 }}>
        <h2 style={{ marginBottom: 24, color: '#f8fafc' }}>➕ Nueva Obra</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Nombre del proyecto</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} placeholder="Ej: Remodelación Local Centro" />
          </div>

          <div>
            <label style={labelStyle}>Fecha de inicio</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Presupuesto (.xlsx)</label>
            <input
              type="file" accept=".xlsx"
              onChange={e => setPresupuestoFile(e.target.files[0] || null)}
              style={{ ...inputStyle, padding: '8px 14px', cursor: 'pointer' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Carta Gantt (.xlsx)</label>
            <input
              type="file" accept=".xlsx"
              onChange={e => setGanttFile(e.target.files[0] || null)}
              style={{ ...inputStyle, padding: '8px 14px', cursor: 'pointer' }}
            />
          </div>

          {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', padding: '8px 12px', background: '#ef444411', borderRadius: 8 }}>{error}</div>}
          {progreso && <div style={{ color: '#22c55e', fontSize: '0.85rem', padding: '8px 12px', background: '#22c55e11', borderRadius: 8 }}>{progreso}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              onClick={onCancelar}
              disabled={importando}
              style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleImportar}
              disabled={importando}
              style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: importando ? '#334155' : '#3b82f6', color: 'white', cursor: importando ? 'default' : 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
            >
              {importando ? 'Importando...' : 'Importar proyecto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
