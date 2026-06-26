import { useState } from 'react'
import { parsearGanttDesdeHeader } from '../lib/importar'

function colLetra(j) {
  return String.fromCharCode(65 + j)
}

export default function GanttHeaderPicker({ filas, workbook, onConfirmar, onCancelar }) {
  const [filaSeleccionada, setFilaSeleccionada] = useState(null)
  const [partidas, setPartidas] = useState(null)
  const [columnas, setColumnas] = useState(null)
  const [errorFila, setErrorFila] = useState('')

  function handleSeleccionarFila(idx) {
    setFilaSeleccionada(idx)
    setErrorFila('')
    try {
      const result = parsearGanttDesdeHeader(workbook, idx)
      setPartidas(result)
      const headerRow = filas[idx] || []
      const cols = {}
      headerRow.forEach((cell, j) => {
        if (cell == null) return
        const s = String(cell).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        if (/^cuadrilla/.test(s)) cols.cuadrilla = { label: String(cell), col: j }
        if (/^n[°o]?$/.test(s.trim()) || s.includes('numero')) cols.numero = { label: String(cell), col: j }
        if (s.includes('partida') || s.includes('nombre') || s.includes('actividad')) cols.nombre = { label: String(cell), col: j }
        if ((s.includes('dia') || s.includes('día')) && (s.includes('ini') || s.includes('inicio'))) cols.diaIni = { label: String(cell), col: j }
        if ((s.includes('dia') || s.includes('día')) && s.includes('fin')) cols.diaFin = { label: String(cell), col: j }
      })
      setColumnas(cols)
    } catch {
      setPartidas(null)
      setColumnas(null)
      setErrorFila('Esta fila no parece ser el encabezado — no se encontraron partidas. Prueba con otra.')
    }
  }

  const puedeConfirmar = partidas && partidas.length > 0

  return (
    <div style={{
      marginTop: 12,
      border: '1px solid var(--gold-bdr)',
      borderRadius: 8,
      padding: 16,
      background: 'var(--gold-bg)',
    }}>
      <div style={{ fontSize: '0.83rem', color: 'var(--text-m)', marginBottom: 10 }}>
        Haz click en la fila que contiene los nombres de columnas
      </div>

      <div style={{ overflowX: 'auto', marginBottom: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
          <tbody>
            {filas.slice(0, 15).map((fila, i) => (
              <tr
                key={i}
                onClick={() => handleSeleccionarFila(i)}
                style={{
                  cursor: 'pointer',
                  background: filaSeleccionada === i ? 'var(--gold-bg)' : 'transparent',
                  outline: filaSeleccionada === i ? '1px solid var(--gold-bdr)' : '1px solid transparent',
                }}
              >
                <td style={{ padding: '3px 8px', color: 'var(--text)', fontSize: '0.7rem', whiteSpace: 'nowrap', userSelect: 'none' }}>
                  {i + 1}
                </td>
                {(fila || []).slice(0, 10).map((cell, j) => (
                  <td
                    key={j}
                    title={cell != null ? String(cell) : ''}
                    style={{
                      padding: '3px 8px',
                      borderLeft: '1px solid var(--border)',
                      color: filaSeleccionada === i ? 'var(--gold)' : 'var(--text-m)',
                      maxWidth: 110,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cell != null ? String(cell).slice(0, 20) : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filaSeleccionada !== null && !errorFila && columnas && partidas && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-m)', fontWeight: 600, marginBottom: 6 }}>
            Columnas detectadas:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 12 }}>
            {[
              ['Nombre de partida', columnas.nombre],
              ['Día inicio', columnas.diaIni],
              ['Día fin', columnas.diaFin],
              ['Cuadrilla', columnas.cuadrilla],
            ].map(([label, col]) => (
              <div key={label} style={{ fontSize: '0.76rem', color: 'var(--text)' }}>
                {label} →{' '}
                <span style={{ color: col ? 'var(--gold)' : 'var(--rojo)', fontWeight: 600 }}>
                  {col ? `col ${colLetra(col.col)}` : 'no detectado'}
                </span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-m)', fontWeight: 600, marginBottom: 6 }}>
            Primeras partidas ({partidas.length} total):
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
            <thead>
              <tr>
                {['N°', 'Nombre', 'Días', 'Cuadrilla'].map(h => (
                  <th key={h} style={{ padding: '3px 8px', textAlign: 'left', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partidas.slice(0, 3).map((p, i) => (
                <tr key={i}>
                  <td style={{ padding: '3px 8px', color: 'var(--text-m)' }}>{p.numero || '-'}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--text-h)' }}>{p.nombre}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--text-m)' }}>{p.dia_ini}–{p.dia_fin}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--text-m)' }}>{(p.cuadrilla || '').split('.')[0] || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {errorFila && (
        <div style={{ color: 'var(--rojo)', fontSize: '0.8rem', marginBottom: 12 }}>{errorFila}</div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => puedeConfirmar && onConfirmar(partidas)}
          disabled={!puedeConfirmar}
          style={{
            padding: '8px 18px', borderRadius: 7, border: 'none',
            background: puedeConfirmar ? 'var(--gold)' : 'var(--s4)',
            color: puedeConfirmar ? 'var(--bg)' : 'var(--text)',
            cursor: puedeConfirmar ? 'pointer' : 'default',
            fontWeight: 600, fontSize: '0.84rem',
          }}
        >
          Confirmar y continuar
        </button>
        <button
          onClick={onCancelar}
          style={{
            padding: '8px 18px', borderRadius: 7,
            border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-m)',
            cursor: 'pointer', fontSize: '0.84rem',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
