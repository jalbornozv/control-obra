import * as XLSX from 'xlsx'
import { supabase } from './supabase'

export function parsearPresupuesto(workbook) {
  const ws = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const items = new Map()
  let seccionActual = null

  for (const row of rows) {
    const [num, nombre, unidad, cantidad, precio_unit, subtotal] = row
    // Detectar fila de sección: columna A es string con formato "X. NOMBRE"
    if (typeof num === 'string' && /^[A-Z]\.\s/.test(num)) {
      seccionActual = num
      continue
    }
    if (typeof num === 'number' && nombre && subtotal) {
      items.set(String(Math.round(num)), {
        seccion: seccionActual || '',
        nombre: String(nombre),
        unidad: unidad ? String(unidad) : '',
        cantidad: Number(cantidad) || 0,
        precio_unit: Number(precio_unit) || 0,
        subtotal: Number(subtotal) || 0,
      })
    }
  }

  if (items.size === 0) throw new Error('El archivo no tiene el formato esperado.')
  return items
}

export function parsearGantt(workbook) {
  // Intenta hoja 'Carta Gantt' primero, si no la primera hoja disponible
  const sheetName = workbook.SheetNames.find(n =>
    n.toLowerCase().includes('gantt') || n.toLowerCase().includes('carta')
  ) || workbook.SheetNames[0]
  const ws = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  // Detectar fila de encabezado dinámicamente (busca "cuadrilla" en las primeras 20 filas)
  let headerRowIdx = -1
  let colCuadrilla = 0, colNumero = 2, colNombre = 3, colIni = 8, colFin = 9

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i]
    // La celda debe EMPEZAR con "cuadrilla" (no contenerla dentro de un título largo)
    const idx = row.findIndex(c =>
      typeof c === 'string' && c.toLowerCase().trim().startsWith('cuadrilla')
    )
    if (idx >= 0) {
      headerRowIdx = i
      colCuadrilla = idx
      // Detectar las demás columnas por su texto de encabezado
      row.forEach((cell, j) => {
        if (cell == null) return
        const s = String(cell).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        if (/^n[°o]?$/.test(s.trim()) || s.includes('numero') || s.includes('item')) colNumero = j
        if (s.includes('partida') || s.includes('nombre') || s.includes('actividad') || s.includes('descripcion')) colNombre = j
        if ((s.includes('dia') || s.includes('día')) && (s.includes('ini') || s.includes('inicio'))) colIni = j
        if ((s.includes('dia') || s.includes('día')) && s.includes('fin')) colFin = j
      })
      break
    }
  }

  if (headerRowIdx === -1) {
    const muestra = rows.slice(0, 5).map(r => String(r[0] ?? '')).join(' | ')
    throw new Error(
      `No se encontró la columna "Cuadrilla / Especialidad" en las primeras 20 filas.\n` +
      `Columna A encontrada: ${muestra}`
    )
  }

  const items = []
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const cuadrilla = row[colCuadrilla]
    const nombre    = row[colNombre]
    const numero    = row[colNumero]
    const dia_ini   = row[colIni]
    const dia_fin   = row[colFin]

    const diaIniNum = Number(dia_ini)
    if (cuadrilla && nombre && !isNaN(diaIniNum) && diaIniNum > 0) {
      items.push({
        cuadrilla: String(cuadrilla),
        numero:    numero != null ? String(numero) : '',
        nombre:    String(nombre),
        dia_ini:   diaIniNum,
        dia_fin:   dia_fin != null && !isNaN(Number(dia_fin)) ? Number(dia_fin) : diaIniNum,
      })
    }
  }

  if (items.length === 0) {
    throw new Error(
      `Se encontró el encabezado en fila ${headerRowIdx + 1} pero no hay partidas con datos.\n` +
      `Columnas usadas: cuadrilla=${colCuadrilla}, nombre=${colNombre}, día ini=${colIni}, día fin=${colFin}`
    )
  }

  return items
}

async function leerWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        resolve(wb)
      } catch {
        reject(new Error('No se pudo leer el archivo. Asegúrate de que sea un .xlsx válido.'))
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo.'))
    reader.readAsArrayBuffer(file)
  })
}

export async function importarObra(nombre, fechaInicio, presupuestoFile, ganttFile, onProgreso) {
  onProgreso?.('Leyendo presupuesto...')
  const wbPresupuesto = await leerWorkbook(presupuestoFile)
  const presupuesto = parsearPresupuesto(wbPresupuesto)

  onProgreso?.('Leyendo carta Gantt...')
  const wbGantt = await leerWorkbook(ganttFile)
  const gantt = parsearGantt(wbGantt)

  const presupuestoNeto = [...presupuesto.values()].reduce((s, p) => s + p.subtotal, 0)

  onProgreso?.('Creando obra en base de datos...')
  const { data: obraData, error: obraError } = await supabase
    .from('obras')
    .insert({ nombre, fecha_inicio: fechaInicio, total_dias: gantt.length > 0 ? Math.max(...gantt.map(g => g.dia_fin)) : 60, presupuesto_neto: presupuestoNeto })
    .select()
    .single()

  if (obraError) throw new Error(`Error creando obra: ${obraError.message}`)
  const obraId = obraData.id

  onProgreso?.(`Importando ${gantt.length} partidas...`)
  const partidas = gantt.map(g => {
    if (!presupuesto.has(g.numero)) {
      console.warn(`importarObra: partida "${g.nombre}" (N° ${g.numero}) no encontrada en presupuesto, se importa sin monto`)
    }
    const ppto = presupuesto.get(g.numero) || {}
    return {
      obra_id: obraId,
      cuadrilla: g.cuadrilla,
      seccion: ppto.seccion || '',
      numero: g.numero,
      nombre: g.nombre,
      unidad: ppto.unidad || '',
      cantidad: ppto.cantidad || 0,
      precio_unit: ppto.precio_unit || 0,
      subtotal: ppto.subtotal || 0,
      dia_ini: g.dia_ini,
      dia_fin: g.dia_fin,
      avance_pct: 0,
    }
  })

  const { error: partidasError } = await supabase.from('partidas').insert(partidas)
  if (partidasError) {
    // rollback: eliminar la obra orphan
    await supabase.from('obras').delete().eq('id', obraData.id)
    throw new Error(`Error importando partidas: ${partidasError.message}`)
  }

  onProgreso?.('¡Importación completa!')
  return obraId
}

export async function reimportarObra(obraId, presupuestoFile, ganttFile, preservarAvance, onProgreso) {
  onProgreso?.('Leyendo presupuesto...')
  const wbPresupuesto = await leerWorkbook(presupuestoFile)
  const presupuesto = parsearPresupuesto(wbPresupuesto)

  onProgreso?.('Leyendo carta Gantt...')
  const wbGantt = await leerWorkbook(ganttFile)
  const gantt = parsearGantt(wbGantt)

  const presupuestoNeto = [...presupuesto.values()].reduce((s, p) => s + p.subtotal, 0)

  let avancePrevio = {}
  if (preservarAvance) {
    onProgreso?.('Guardando avance actual...')
    const { data } = await supabase.from('partidas').select('numero, avance_pct').eq('obra_id', obraId)
    for (const p of data || []) avancePrevio[p.numero] = p.avance_pct
  }

  onProgreso?.('Eliminando partidas anteriores...')
  const { error: delError } = await supabase.from('partidas').delete().eq('obra_id', obraId)
  if (delError) throw new Error(`Error eliminando partidas: ${delError.message}`)

  onProgreso?.('Actualizando datos de la obra...')
  const totalDias = gantt.length > 0 ? Math.max(...gantt.map(g => g.dia_fin)) : 60
  await supabase.from('obras').update({ presupuesto_neto: presupuestoNeto, total_dias: totalDias }).eq('id', obraId)

  onProgreso?.(`Importando ${gantt.length} partidas...`)
  const partidas = gantt.map(g => {
    if (!presupuesto.has(g.numero)) {
      console.warn(`reimportarObra: partida "${g.nombre}" (N° ${g.numero}) no encontrada en presupuesto, se importa sin monto`)
    }
    const ppto = presupuesto.get(g.numero) || {}
    return {
      obra_id: obraId,
      cuadrilla: g.cuadrilla,
      seccion: ppto.seccion || '',
      numero: g.numero,
      nombre: g.nombre,
      unidad: ppto.unidad || '',
      cantidad: ppto.cantidad || 0,
      precio_unit: ppto.precio_unit || 0,
      subtotal: ppto.subtotal || 0,
      dia_ini: g.dia_ini,
      dia_fin: g.dia_fin,
      avance_pct: preservarAvance ? (avancePrevio[g.numero] ?? 0) : 0,
    }
  })

  const { error: partidasError } = await supabase.from('partidas').insert(partidas)
  if (partidasError) throw new Error(`Error importando partidas: ${partidasError.message}`)

  onProgreso?.('¡Reimportación completa!')
}
