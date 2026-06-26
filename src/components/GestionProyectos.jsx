import { useState } from 'react'
import { reimportarObra, importarObra, leerWorkbook, parsearGantt, GanttFormatError } from '../lib/importar'
import { calcDiaActual } from '../lib/calculations'
import GanttHeaderPicker from './GanttHeaderPicker'

const CONFIRM_STYLES = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  box: { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 28, maxWidth: 420, width: '90%' },
  title: { fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 10 },
  desc: { fontSize: '0.87rem', color: '#94a3b8', marginBottom: 20, lineHeight: 1.5 },
  btns: { display: 'flex', gap: 10 },
  btnPrimary: { flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' },
  btnSecondary: { flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' },
  btnDanger: { flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' },
}

function DialogoPreservarAvance({ obra, onConfirm, onCancel }) {
  return (
    <div style={CONFIRM_STYLES.overlay}>
      <div style={CONFIRM_STYLES.box}>
        <div style={CONFIRM_STYLES.title}>Actualizar datos de {obra.nombre}</div>
        <div style={CONFIRM_STYLES.desc}>
          Vas a re-importar los archivos xlsx. ¿Qué hacer con el avance registrado hasta ahora?
        </div>
        <div style={{ ...CONFIRM_STYLES.btns, flexDirection: 'column', gap: 10 }}>
          <button style={CONFIRM_STYLES.btnPrimary} onClick={() => onConfirm(true)}>
            ✅ Mantener avance actual
          </button>
          <button style={CONFIRM_STYLES.btnDanger} onClick={() => onConfirm(false)}>
            🔄 Reiniciar avance a 0%
          </button>
          <button style={CONFIRM_STYLES.btnSecondary} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

function FilaObra({ obra, onActualizar, onCambiar }) {
  const diaActual = calcDiaActual(obra.fecha_inicio)
  const diasRestantes = Math.max(0, obra.total_dias - diaActual + 1)
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>{obra.nombre}</div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 3 }}>
          Día {diaActual} de {obra.total_dias} &nbsp;·&nbsp; {diasRestantes} días restantes
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onCambiar(obra.id)}
          style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem' }}
        >
          Ir a obra
        </button>
        <button
          onClick={() => onActualizar(obra)}
          style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: '#1d4ed8', color: 'white', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
        >
          🔄 Actualizar xlsx
        </button>
      </div>
    </div>
  )
}

function FormNuevaObra({ onImportada, onCancelar }) {
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState('')
  const [presupuestoFile, setPresupuestoFile] = useState(null)
  const [ganttFile, setGanttFile] = useState(null)
  const [ganttWorkbook, setGanttWorkbook] = useState(null)
  const [ganttEstado, setGanttEstado] = useState('idle')
  const [ganttPartidas, setGanttPartidas] = useState(null)
  const [ganttFilas, setGanttFilas] = useState(null)
  const [progreso, setProgreso] = useState('')
  const [error, setError] = useState('')
  const [importando, setImportando] = useState(false)

  async function handleGanttChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setGanttFile(file)
    setGanttEstado('procesando')
    setError('')
    setGanttPartidas(null)
    setGanttFilas(null)
    try {
      const wb = await leerWorkbook(file)
      setGanttWorkbook(wb)
      const partidas = parsearGantt(wb)
      setGanttPartidas(partidas)
      setGanttEstado('auto-ok')
    } catch (e) {
      if (e instanceof GanttFormatError) {
        setGanttFilas(e.filas)
        setGanttEstado('necesita-config')
      } else {
        setError(e.message)
        setGanttEstado('idle')
      }
    }
  }

  async function handleImportar() {
    if (!nombre || !fecha || !presupuestoFile || !ganttPartidas) { setError('Completa todos los campos.'); return }
    setError(''); setImportando(true)
    try {
      const id = await importarObra(nombre, fecha, presupuestoFile, ganttFile, setProgreso, ganttPartidas)
      onImportada(id)
    } catch (e) {
      setError(e.message)
    } finally {
      setImportando(false)
    }
  }

  const puedeImportar = !importando && ganttEstado !== 'necesita-config' && ganttEstado !== 'procesando' && !!ganttPartidas
  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 7, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: '0.88rem', boxSizing: 'border-box' }
  const labelStyle = { fontSize: '0.82rem', color: '#94a3b8', marginBottom: 5, display: 'block' }

  return (
    <div style={{ background: '#1e293b', border: '1px solid #3b82f6', borderRadius: 10, padding: '20px 24px', marginTop: 20 }}>
      <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 16 }}>➕ Nueva Obra</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Nombre del proyecto</label>
          <input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Edificio Miraflores" />
        </div>
        <div>
          <label style={labelStyle}>Fecha de inicio</label>
          <input type="date" style={inputStyle} value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Presupuesto.xlsx</label>
          <input type="file" accept=".xlsx" onChange={e => setPresupuestoFile(e.target.files[0])} style={{ color: '#94a3b8', fontSize: '0.82rem' }} />
        </div>
        <div>
          <label style={labelStyle}>Carta_Gantt.xlsx</label>
          <input type="file" accept=".xlsx" onChange={handleGanttChange} style={{ color: '#94a3b8', fontSize: '0.82rem' }} />
          {ganttEstado === 'procesando' && <div style={{ color: '#60a5fa', fontSize: '0.76rem', marginTop: 4 }}>Leyendo...</div>}
          {ganttEstado === 'auto-ok' && <div style={{ color: '#22c55e', fontSize: '0.76rem', marginTop: 4 }}>✓ {ganttPartidas?.length} partidas</div>}
          {ganttEstado === 'configurado' && <div style={{ color: '#22c55e', fontSize: '0.76rem', marginTop: 4 }}>✓ {ganttPartidas?.length} partidas (manual)</div>}
        </div>
      </div>
      {ganttEstado === 'necesita-config' && ganttFilas && (
        <GanttHeaderPicker
          filas={ganttFilas}
          workbook={ganttWorkbook}
          onConfirmar={partidas => { setGanttPartidas(partidas); setGanttEstado('configurado') }}
          onCancelar={() => { setGanttEstado('idle'); setGanttFile(null); setGanttFilas(null); setGanttWorkbook(null) }}
        />
      )}
      {progreso && <div style={{ color: '#60a5fa', fontSize: '0.85rem', marginBottom: 10 }}>{progreso}</div>}
      {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button onClick={handleImportar} disabled={!puedeImportar} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: !puedeImportar ? '#334155' : '#3b82f6', color: 'white', cursor: !puedeImportar ? 'default' : 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
          {importando ? 'Importando...' : 'Importar'}
        </button>
        <button onClick={onCancelar} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.88rem' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

function PanelActualizarObra({ obra, onListo, onCancelar }) {
  const [preguntarAvance, setPreguntarAvance] = useState(false)
  const [presupuestoFile, setPresupuestoFile] = useState(null)
  const [ganttFile, setGanttFile] = useState(null)
  const [ganttWorkbook, setGanttWorkbook] = useState(null)
  const [ganttEstado, setGanttEstado] = useState('idle')
  const [ganttPartidas, setGanttPartidas] = useState(null)
  const [ganttFilas, setGanttFilas] = useState(null)
  const [progreso, setProgreso] = useState('')
  const [error, setError] = useState('')
  const [importando, setImportando] = useState(false)

  async function handleGanttChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setGanttFile(file)
    setGanttEstado('procesando')
    setError('')
    setGanttPartidas(null)
    setGanttFilas(null)
    try {
      const wb = await leerWorkbook(file)
      setGanttWorkbook(wb)
      const partidas = parsearGantt(wb)
      setGanttPartidas(partidas)
      setGanttEstado('auto-ok')
    } catch (e) {
      if (e instanceof GanttFormatError) {
        setGanttFilas(e.filas)
        setGanttEstado('necesita-config')
      } else {
        setError(e.message)
        setGanttEstado('idle')
      }
    }
  }

  async function handleReimportar(pres) {
    setError(''); setImportando(true)
    try {
      await reimportarObra(obra.id, presupuestoFile, ganttFile, pres, setProgreso, ganttPartidas)
      onListo()
    } catch (e) {
      setError(e.message)
    } finally {
      setImportando(false)
    }
  }

  const puedeActualizar = !importando && ganttEstado !== 'necesita-config' && ganttEstado !== 'procesando' && !!ganttPartidas && !!presupuestoFile
  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 7, background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', fontSize: '0.88rem', boxSizing: 'border-box' }
  const labelStyle = { fontSize: '0.82rem', color: '#94a3b8', marginBottom: 5, display: 'block' }

  return (
    <>
      <div style={{ background: '#1e293b', border: '1px solid #1d4ed8', borderRadius: 10, padding: '20px 24px', marginTop: 20 }}>
        <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>🔄 Actualizar datos — {obra.nombre}</div>
        <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 16 }}>Sube los archivos xlsx actualizados</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Presupuesto.xlsx</label>
            <input type="file" accept=".xlsx" onChange={e => setPresupuestoFile(e.target.files[0])} style={{ color: '#94a3b8', fontSize: '0.82rem' }} />
          </div>
          <div>
            <label style={labelStyle}>Carta_Gantt.xlsx</label>
            <input type="file" accept=".xlsx" onChange={handleGanttChange} style={{ color: '#94a3b8', fontSize: '0.82rem' }} />
            {ganttEstado === 'procesando' && <div style={{ color: '#60a5fa', fontSize: '0.76rem', marginTop: 4 }}>Leyendo...</div>}
            {ganttEstado === 'auto-ok' && <div style={{ color: '#22c55e', fontSize: '0.76rem', marginTop: 4 }}>✓ {ganttPartidas?.length} partidas</div>}
            {ganttEstado === 'configurado' && <div style={{ color: '#22c55e', fontSize: '0.76rem', marginTop: 4 }}>✓ {ganttPartidas?.length} partidas (manual)</div>}
          </div>
        </div>
        {ganttEstado === 'necesita-config' && ganttFilas && (
          <GanttHeaderPicker
            filas={ganttFilas}
            workbook={ganttWorkbook}
            onConfirmar={partidas => { setGanttPartidas(partidas); setGanttEstado('configurado') }}
            onCancelar={() => { setGanttEstado('idle'); setGanttFile(null); setGanttFilas(null); setGanttWorkbook(null) }}
          />
        )}
        {progreso && <div style={{ color: '#60a5fa', fontSize: '0.85rem', marginBottom: 10 }}>{progreso}</div>}
        {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { if (!puedeActualizar) { setError('Sube ambos archivos xlsx.'); return } setPreguntarAvance(true) }}
            disabled={importando}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: importando ? '#334155' : '#1d4ed8', color: 'white', cursor: importando ? 'default' : 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
          >
            {importando ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button onClick={onCancelar} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.88rem' }}>
            Cancelar
          </button>
        </div>
      </div>
      {preguntarAvance && !importando && (
        <DialogoPreservarAvance
          obra={obra}
          onConfirm={pres => { setPreguntarAvance(false); handleReimportar(pres) }}
          onCancel={() => setPreguntarAvance(false)}
        />
      )}
    </>
  )
}

export default function GestionProyectos({ obras, onCambiarObra, onObrasActualizadas }) {
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [obraActualizando, setObraActualizando] = useState(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Proyectos</h2>
        {!mostrarNueva && !obraActualizando && (
          <button
            onClick={() => setMostrarNueva(true)}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px dashed #3b82f6', background: 'transparent', color: '#3b82f6', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
          >
            ➕ Nueva Obra
          </button>
        )}
      </div>

      {obras.map(o => (
        <FilaObra
          key={o.id}
          obra={o}
          onCambiar={id => onCambiarObra(id)}
          onActualizar={obra => { setMostrarNueva(false); setObraActualizando(obra) }}
        />
      ))}

      {mostrarNueva && (
        <FormNuevaObra
          onImportada={id => { setMostrarNueva(false); onObrasActualizadas(id) }}
          onCancelar={() => setMostrarNueva(false)}
        />
      )}

      {obraActualizando && (
        <PanelActualizarObra
          obra={obraActualizando}
          onListo={() => { setObraActualizando(null); onObrasActualizadas(obraActualizando.id) }}
          onCancelar={() => setObraActualizando(null)}
        />
      )}
    </div>
  )
}
