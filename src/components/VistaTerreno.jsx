import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { clearSession } from '../lib/auth'
import { calcDiaActual } from '../lib/calculations'

async function subirFoto(file, obraId, partidaId) {
  const ext  = file.name.split('.').pop() || 'jpg'
  const path = `${obraId}/${partidaId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('fotos-obra').upload(path, file, { contentType: file.type })
  if (error) throw error
  return supabase.storage.from('fotos-obra').getPublicUrl(path).data.publicUrl
}

export default function VistaTerreno({ obraId, usuario, onLogout }) {
  const [obra, setObra]           = useState(null)
  const [partidas, setPartidas]   = useState([])
  const [avances, setAvances]     = useState({})  // { [id]: number }
  const [fotos, setFotos]         = useState({})  // { [id]: File }
  const [loading, setLoading]     = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado]   = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')

  useEffect(() => {
    async function cargar() {
      const [{ data: o }, { data: p }] = await Promise.all([
        supabase.from('obras').select('id, nombre, fecha_inicio, total_dias').eq('id', obraId).single(),
        supabase.from('partidas')
          .select('id, numero, nombre, cuadrilla, dia_ini, dia_fin, avance_pct')
          .eq('obra_id', obraId).order('numero'),
      ])
      setObra(o)
      setPartidas(p || [])
      setLoading(false)
    }
    cargar()
  }, [obraId])

  function setAvance(id, val) {
    setAvances(prev => ({ ...prev, [id]: Math.min(100, Math.max(0, Number(val) || 0)) }))
  }

  async function guardar() {
    setGuardando(true)
    setErrorGuardar('')
    const diaActual  = calcDiaActual(obra.fecha_inicio)
    const modificadas = partidas.filter(p =>
      avances[p.id] !== undefined && avances[p.id] !== (p.avance_pct || 0)
    )

    try {
      for (const partida of modificadas) {
        const nuevoAvance = avances[partida.id]
        let foto_url = null

        if (fotos[partida.id]) {
          try { foto_url = await subirFoto(fotos[partida.id], obraId, partida.id) } catch { /* foto falla silenciosamente */ }
        }

        await supabase.from('partidas').update({ avance_pct: nuevoAvance }).eq('id', partida.id)
        await supabase.from('registros').insert({
          partida_id: partida.id,
          dia_obra:   diaActual,
          avance_pct: nuevoAvance,
          usuario_id: usuario.usuarioId,
          foto_url,
        })
        setPartidas(prev => prev.map(p => p.id === partida.id ? { ...p, avance_pct: nuevoAvance } : p))
      }
      setAvances({})
      setFotos({})
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    } catch (e) {
      setErrorGuardar('Error al guardar: ' + e.message)
    }
    setGuardando(false)
  }

  const hayModificaciones = partidas.some(p =>
    avances[p.id] !== undefined && avances[p.id] !== (p.avance_pct || 0)
  )

  if (loading) return <div className="loading">Cargando</div>

  if (!obra) return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-m)', marginBottom: 16 }}>Obra no encontrada.</p>
      <button className="btn" onClick={() => { clearSession(); onLogout() }}>Salir</button>
    </div>
  )

  const dia      = calcDiaActual(obra.fecha_inicio)
  const diaLabel = Math.min(Math.max(1, dia), obra.total_dias)

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 120px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--disp)', fontSize: '1.6rem', letterSpacing: '0.06em', color: 'var(--text-h)', lineHeight: 1, marginBottom: 4 }}>
            {obra.nombre.toUpperCase()}
          </h1>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {usuario.nombre} · DÍA {diaLabel} / {obra.total_dias}
          </p>
        </div>
        <button className="btn" onClick={() => { clearSession(); onLogout() }} style={{ flexShrink: 0 }}>
          Salir
        </button>
      </div>

      <p style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 16, marginBottom: 20 }}>
        Actualiza el avance y guarda al terminar
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {partidas.map(p => {
          const avanceActual = avances[p.id] ?? (p.avance_pct || 0)
          const modificada   = avances[p.id] !== undefined && avances[p.id] !== (p.avance_pct || 0)

          return (
            <div key={p.id} className="card" style={{ borderColor: modificada ? 'var(--gold-bdr)' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
                    N° {p.numero} · {p.cuadrilla}
                  </p>
                  <p style={{ color: 'var(--text-h)', fontSize: '0.9rem', fontWeight: 500 }}>{p.nombre}</p>
                </div>
                <span style={{ fontFamily: 'var(--disp)', fontSize: '1.6rem', color: modificada ? 'var(--gold)' : 'var(--text-m)', flexShrink: 0, marginLeft: 12 }}>
                  {avanceActual}%
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                <input
                  type="range" min="0" max="100" step="5"
                  value={avanceActual}
                  onChange={e => setAvance(p.id, e.target.value)}
                  style={{ flex: 1, accentColor: 'var(--gold)' }}
                />
                <input
                  type="number" min="0" max="100"
                  value={avanceActual}
                  onChange={e => setAvance(p.id, e.target.value)}
                  style={{ width: 56, padding: '5px 8px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text-h)', fontFamily: 'var(--mono)', fontSize: 16, textAlign: 'center' }}
                />
              </div>

              <label style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--s2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                📷 {fotos[p.id] ? fotos[p.id].name.slice(0, 22) + '…' : 'Foto (opcional)'}
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) setFotos(prev => ({ ...prev, [p.id]: e.target.files[0] })) }}
                />
              </label>
            </div>
          )
        })}
      </div>

      {errorGuardar && (
        <p style={{ color: 'var(--rojo)', fontFamily: 'var(--mono)', fontSize: '0.78rem', marginTop: 12 }}>{errorGuardar}</p>
      )}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px', background: 'var(--s1)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', zIndex: 20 }}>
        <button
          onClick={guardar}
          disabled={!hayModificaciones || guardando}
          style={{
            padding: '14px 40px',
            borderRadius: 'var(--r)',
            border: 'none',
            background: (!hayModificaciones || guardando) ? 'var(--s3)' : guardado ? 'var(--verde)' : 'var(--gold)',
            color: (!hayModificaciones || guardando) ? 'var(--text)' : '#07080F',
            fontFamily: 'var(--font)',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: (!hayModificaciones || guardando) ? 'default' : 'pointer',
            transition: 'all 0.2s',
            minWidth: 200,
          }}
        >
          {guardando ? 'Guardando...' : guardado ? '✓ Guardado' : 'Guardar avances'}
        </button>
      </div>
    </div>
  )
}
