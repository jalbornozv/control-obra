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
  const ws = workbook.Sheets['Carta Gantt'] || workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const items = []
  let encabezadoVisto = false

  for (const row of rows) {
    const [cuadrilla, , numero, nombre, , , , , dia_ini, dia_fin] = row
    if (!encabezadoVisto) {
      if (cuadrilla === 'Cuadrilla / Especialidad') encabezadoVisto = true
      continue
    }
    if (cuadrilla && nombre && dia_ini) {
      items.push({
        cuadrilla: String(cuadrilla),
        numero: numero != null ? String(numero) : '',
        nombre: String(nombre),
        dia_ini: Number(dia_ini),
        dia_fin: dia_fin != null ? Number(dia_fin) : Number(dia_ini),
      })
    }
  }

  if (items.length === 0) throw new Error('El archivo Gantt no tiene el formato esperado.')
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
  if (partidasError) throw new Error(`Error importando partidas: ${partidasError.message}`)

  onProgreso?.('¡Importación completa!')
  return obraId
}
