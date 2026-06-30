import { useState } from 'react'
import { reimportarObra, importarObra, leerWorkbook, parsearGantt, GanttFormatError } from '../lib/importar'
import { calcDiaActual } from '../lib/calculations'
import { supabase } from '../lib/supabase'
import { hashPin } from '../lib/auth'
import GanttHeaderPicker from './GanttHeaderPicker'

const CONFIRM_STYLES = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  box: { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: 28, maxWidth: 420, width: '90%' },
  title: { fontSize: '1rem', fontWeight: 700, color: 'var(--text-h)', marginBottom: 10 },
  desc: { fontSize: '0.87rem', color: 'var(--text-m)', marginBottom: 20, lineHeight: 1.5 },
  btns: { display: 'flex', gap: 10 },
  btnPrimary: { flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--gold)', color: '#07080F', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' },
  btnSecondary: { flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border-h)', background: 'transparent', color: 'var(--text-m)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' },
  btnDanger: { flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--rojo-bdr)', background: 'var(--rojo-bg)', color: 'var(--rojo)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' },
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
            Mantener avance actual
          </button>
          <button style={CONFIRM_STYLES.btnDanger} onClick={() => onConfirm(false)}>
            Reiniciar avance a 0%
          </button>
          <button style={CONFIRM_STYLES.btnSecondary} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 7, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text-h)', fontSize: '0.88rem', boxSizing: 'border-box' }
const labelStyle = { fontSize: '0.82rem', color: 'var(--text-m)', marginBottom: 5, display: 'block' }
const fileInputStyle = { color: 'var(--text-m)', fontSize: '0.82rem' }

function FilaObra({ obra, onActualizar, onCambiar, onFechaActualizada }) {
  const diaActual = calcDiaActual(obra.fecha_inicio)
  const diasRestantes = Math.max(0, obra.total_dias - diaActual + 1)
  const [nuevaFecha, setNuevaFecha] = useState(obra.fecha_inicio)
  const [nuevaRet, setNuevaRet] = useState(obra.retencion_pct ?? 15)
  const [guardando, setGuardando] = useState(false)
  const [ok, setOk] = useState(false)

  async function aplicarFecha() {
    if (sinCambio) return
    setGuardando(true)
    const { error } = await supabase.from('obras')
      .update({ fecha_inicio: nuevaFecha, retencion_pct: Number(nuevaRet) })
      .eq('id', obra.id)
    setGuardando(false)
    if (!error) { setOk(true); setTimeout(() => setOk(false), 2000); onFechaActualizada() }
  }

  const sinCambio = nuevaFecha === obra.fecha_inicio && Number(nuevaRet) === (obra.retencion_pct ?? 15)

  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: '0.95rem' }}>{obra.nombre}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text)', marginTop: 3, fontFamily: 'var(--mono)' }}>
            Día {diaActual} de {obra.total_dias} &nbsp;·&nbsp; {diasRestantes} días restantes
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onCambiar(obra.id)}
            style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border-h)', background: 'transparent', color: 'var(--text-m)', cursor: 'pointer', fontSize: '0.82rem' }}
          >
            Ir a obra
          </button>
          <button
            onClick={() => onActualizar(obra)}
            style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--gold-bdr)', background: 'var(--gold-bg)', color: 'var(--gold)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
          >
            Actualizar xlsx
          </button>
        </div>
      </div>

      {/* Fecha de inicio y retención editables */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text)', whiteSpace: 'nowrap' }}>Fecha de inicio</span>
        <input
          type="date"
          value={nuevaFecha}
          onChange={e => { setNuevaFecha(e.target.value); setOk(false) }}
          style={{ padding: '5px 10px', borderRadius: 6, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text-h)', fontSize: '0.82rem', fontFamily: 'var(--mono)' }}
        />
        <span style={{ fontSize: '0.78rem', color: 'var(--text)', whiteSpace: 'nowrap', marginLeft: 8 }}>Retención %</span>
        <input
          type="number"
          min="0" max="100" step="0.5"
          value={nuevaRet}
          onChange={e => { setNuevaRet(e.target.value); setOk(false) }}
          style={{ width: 64, padding: '5px 10px', borderRadius: 6, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text-h)', fontSize: '0.82rem', fontFamily: 'var(--mono)' }}
        />
        <button
          onClick={aplicarFecha}
          disabled={guardando || sinCambio}
          style={{
            padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: '0.82rem', fontWeight: 600, cursor: guardando || sinCambio ? 'default' : 'pointer',
            background: ok ? 'var(--verde-bg)' : sinCambio ? 'var(--s3)' : 'var(--gold)',
            color: ok ? 'var(--verde)' : sinCambio ? 'var(--text)' : '#07080F',
            transition: 'all 0.2s',
          }}
        >
          {guardando ? '...' : ok ? '✓ Aplicado' : 'Aplicar'}
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

  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--gold-bdr)', borderRadius: 10, padding: '20px 24px', marginTop: 20 }}>
      <div style={{ fontWeight: 700, color: 'var(--text-h)', marginBottom: 16 }}>Nueva Obra</div>
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
          <input type="file" accept=".xlsx" onChange={e => setPresupuestoFile(e.target.files[0])} style={fileInputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Carta_Gantt.xlsx</label>
          <input type="file" accept=".xlsx" onChange={handleGanttChange} style={fileInputStyle} />
          {ganttEstado === 'procesando' && <div style={{ color: 'var(--text-m)', fontSize: '0.76rem', marginTop: 4 }}>Leyendo...</div>}
          {ganttEstado === 'auto-ok' && <div style={{ color: 'var(--verde)', fontSize: '0.76rem', marginTop: 4 }}>✓ {ganttPartidas?.length} partidas</div>}
          {ganttEstado === 'configurado' && <div style={{ color: 'var(--verde)', fontSize: '0.76rem', marginTop: 4 }}>✓ {ganttPartidas?.length} partidas (manual)</div>}
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
      {progreso && <div style={{ color: 'var(--gold)', fontSize: '0.85rem', marginBottom: 10 }}>{progreso}</div>}
      {error && <div style={{ color: 'var(--rojo)', fontSize: '0.85rem', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button onClick={handleImportar} disabled={!puedeImportar} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: !puedeImportar ? 'var(--s3)' : 'var(--gold)', color: !puedeImportar ? 'var(--text)' : '#07080F', cursor: !puedeImportar ? 'default' : 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
          {importando ? 'Importando...' : 'Importar'}
        </button>
        <button onClick={onCancelar} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-h)', background: 'transparent', color: 'var(--text-m)', cursor: 'pointer', fontSize: '0.88rem' }}>
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

  return (
    <>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--gold-bdr)', borderRadius: 10, padding: '20px 24px', marginTop: 20 }}>
        <div style={{ fontWeight: 700, color: 'var(--text-h)', marginBottom: 4 }}>Actualizar datos — {obra.nombre}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text)', marginBottom: 16 }}>Sube los archivos xlsx actualizados</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Presupuesto.xlsx</label>
            <input type="file" accept=".xlsx" onChange={e => setPresupuestoFile(e.target.files[0])} style={fileInputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Carta_Gantt.xlsx</label>
            <input type="file" accept=".xlsx" onChange={handleGanttChange} style={fileInputStyle} />
            {ganttEstado === 'procesando' && <div style={{ color: 'var(--text-m)', fontSize: '0.76rem', marginTop: 4 }}>Leyendo...</div>}
            {ganttEstado === 'auto-ok' && <div style={{ color: 'var(--verde)', fontSize: '0.76rem', marginTop: 4 }}>✓ {ganttPartidas?.length} partidas</div>}
            {ganttEstado === 'configurado' && <div style={{ color: 'var(--verde)', fontSize: '0.76rem', marginTop: 4 }}>✓ {ganttPartidas?.length} partidas (manual)</div>}
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
        {progreso && <div style={{ color: 'var(--gold)', fontSize: '0.85rem', marginBottom: 10 }}>{progreso}</div>}
        {error && <div style={{ color: 'var(--rojo)', fontSize: '0.85rem', marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { if (!puedeActualizar) { setError('Sube ambos archivos xlsx.'); return } setPreguntarAvance(true) }}
            disabled={importando}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: importando ? 'var(--s3)' : 'var(--gold)', color: importando ? 'var(--text)' : '#07080F', cursor: importando ? 'default' : 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
          >
            {importando ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button onClick={onCancelar} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-h)', background: 'transparent', color: 'var(--text-m)', cursor: 'pointer', fontSize: '0.88rem' }}>
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

function SeccionAccesos({ obras }) {
  const [obraId, setObraId]           = useState(null)
  const [trabajadores, setTrabajadores] = useState([])
  const [nuevoNombre, setNuevoNombre]   = useState('')
  const [nuevoPin, setNuevoPin]         = useState('')
  const [pinCliente, setPinCliente]     = useState('')
  const [adminPin, setAdminPin]         = useState('')
  const [adminPinNuevo, setAdminPinNuevo] = useState('')
  const [adminPinConf, setAdminPinConf]   = useState('')
  const [msg, setMsg]     = useState('')
  const [msgAdmin, setMsgAdmin] = useState('')

  async function abrirObra(obra) {
    if (obraId === obra.id) { setObraId(null); return }
    setObraId(obra.id)
    setPinCliente(obra.pin_cliente || '')
    setMsg('')
    const { data } = await supabase.from('usuarios').select('id, nombre').eq('obra_id', obra.id).eq('rol', 'trabajador')
    setTrabajadores(data || [])
  }

  async function crearTrabajador() {
    if (!nuevoNombre.trim() || nuevoPin.length < 4) { setMsg('Nombre y PIN mínimo 4 dígitos'); return }
    const pin_hash = await hashPin(nuevoPin)
    const { error } = await supabase.from('usuarios').insert({ nombre: nuevoNombre.trim(), pin_hash, rol: 'trabajador', obra_id: obraId })
    if (error) { setMsg('Error: ' + error.message); return }
    const { data } = await supabase.from('usuarios').select('id, nombre').eq('obra_id', obraId).eq('rol', 'trabajador')
    setTrabajadores(data || [])
    setNuevoNombre(''); setNuevoPin(''); setMsg('Trabajador creado')
  }

  async function borrarTrabajador(id) {
    await supabase.from('usuarios').delete().eq('id', id)
    setTrabajadores(prev => prev.filter(t => t.id !== id))
  }

  async function guardarPinCliente() {
    if (!pinCliente.trim()) { setMsg('Ingresa un PIN'); return }
    const { error } = await supabase.from('obras').update({ pin_cliente: pinCliente }).eq('id', obraId)
    setMsg(error ? 'Error: ' + error.message : 'PIN mandante guardado')
  }

  async function cambiarPinAdmin() {
    if (adminPinNuevo.length < 4) { setMsgAdmin('PIN mínimo 4 dígitos'); return }
    if (adminPinNuevo !== adminPinConf) { setMsgAdmin('Los PINs no coinciden'); return }
    const hashActual = await hashPin(adminPin)
    const { data } = await supabase.from('usuarios').select('id').eq('rol', 'admin').eq('pin_hash', hashActual).single()
    if (!data) { setMsgAdmin('PIN actual incorrecto'); return }
    const nuevoHash = await hashPin(adminPinNuevo)
    await supabase.from('usuarios').update({ pin_hash: nuevoHash }).eq('rol', 'admin')
    setAdminPin(''); setAdminPinNuevo(''); setAdminPinConf('')
    setMsgAdmin('PIN de administrador actualizado')
  }

  const inStyle = { padding: '8px 12px', borderRadius: 'var(--r)', background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text-h)', fontSize: 16, fontFamily: 'var(--font)', boxSizing: 'border-box', width: '100%' }

  return (
    <div style={{ marginTop: 40 }}>
      <h2 style={{ marginBottom: 16 }}>ACCESOS</h2>

      {obras.map(obra => (
        <div key={obra.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-h)', fontWeight: 500 }}>{obra.nombre}</span>
            <button className="btn" onClick={() => abrirObra(obra)}>
              {obraId === obra.id ? 'Cerrar' : 'Gestionar'}
            </button>
          </div>

          {obraId === obra.id && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* PIN mandante */}
              <div>
                <p style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>PIN Mandante</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...inStyle, maxWidth: 180 }} placeholder="PIN para el mandante" value={pinCliente} onChange={e => setPinCliente(e.target.value)} />
                  <button className="btn btn-gold" onClick={guardarPinCliente}>Guardar</button>
                </div>
              </div>

              {/* Trabajadores */}
              <div>
                <p style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Trabajadores</p>
                {trabajadores.length === 0
                  ? <p style={{ color: 'var(--text)', fontSize: '0.82rem', marginBottom: 8 }}>Sin trabajadores asignados</p>
                  : trabajadores.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-h)' }}>{t.nombre}</span>
                      <button className="btn" onClick={() => borrarTrabajador(t.id)} style={{ color: 'var(--rojo)', borderColor: 'var(--rojo-bdr)', fontSize: '0.72rem' }}>Eliminar</button>
                    </div>
                  ))
                }
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input style={{ ...inStyle, flex: 1 }} placeholder="Nombre" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
                  <input style={{ ...inStyle, width: 90, flex: 'none' }} type="password" inputMode="numeric" placeholder="PIN" value={nuevoPin} onChange={e => setNuevoPin(e.target.value)} />
                  <button className="btn btn-gold" onClick={crearTrabajador}>Agregar</button>
                </div>
              </div>

              {msg && <p style={{ color: 'var(--gold)', fontFamily: 'var(--mono)', fontSize: '0.72rem' }}>{msg}</p>}
            </div>
          )}
        </div>
      ))}

      {/* Cambiar PIN admin */}
      <div className="card" style={{ marginTop: 24 }}>
        <p style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
          Cambiar PIN Administrador
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 280 }}>
          <input style={inStyle} type="password" inputMode="numeric" placeholder="PIN actual" value={adminPin} onChange={e => setAdminPin(e.target.value)} />
          <input style={inStyle} type="password" inputMode="numeric" placeholder="PIN nuevo" value={adminPinNuevo} onChange={e => setAdminPinNuevo(e.target.value)} />
          <input style={inStyle} type="password" inputMode="numeric" placeholder="Confirmar PIN nuevo" value={adminPinConf} onChange={e => setAdminPinConf(e.target.value)} />
          <button className="btn btn-gold" onClick={cambiarPinAdmin}>Cambiar PIN</button>
        </div>
        {msgAdmin && <p style={{ color: 'var(--gold)', fontFamily: 'var(--mono)', fontSize: '0.72rem', marginTop: 10 }}>{msgAdmin}</p>}
      </div>
    </div>
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
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px dashed var(--gold-bdr)', background: 'transparent', color: 'var(--gold)', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
          >
            + Nueva Obra
          </button>
        )}
      </div>

      {obras.map(o => (
        <FilaObra
          key={o.id}
          obra={o}
          onCambiar={id => onCambiarObra(id)}
          onActualizar={obra => { setMostrarNueva(false); setObraActualizando(obra) }}
          onFechaActualizada={() => onObrasActualizadas(o.id)}
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

      <SeccionAccesos obras={obras} />
    </div>
  )
}
