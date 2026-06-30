import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parsearPresupuesto, parsearGantt, leerFilasGantt, parsearGanttDesdeHeader, GanttFormatError } from '../src/lib/importar'

// Mock supabase to avoid real DB calls
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'obra-123' }, error: null })),
        })),
      })),
    })),
  },
}))

function makeWorkbook(sheetName, rows) {
  // Build a minimal workbook using XLSX
  return {
    SheetNames: [sheetName],
    Sheets: {
      [sheetName]: rowsToSheet(rows),
    },
  }
}

function rowsToSheet(rows) {
  // Minimal sheet representation: just return a mock that XLSX.utils.sheet_to_json can handle
  // We'll override sheet_to_json in these tests instead
  return { __rows: rows }
}

// Instead of building real XLSX sheets, mock XLSX.utils.sheet_to_json
import * as XLSX from 'xlsx'

describe('parsearPresupuesto', () => {
  beforeEach(() => {
    vi.spyOn(XLSX.utils, 'sheet_to_json')
  })

  it('parsea filas numéricas correctamente', () => {
    XLSX.utils.sheet_to_json.mockReturnValue([
      ['A. OBRAS CIVILES', null, null, null, null, null],
      [1, 'Excavación', 'm3', 10, 5000, 50000],
      [2, 'Relleno', 'm3', 5, 3000, 15000],
    ])

    const wb = { SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }
    const { items: result } = parsearPresupuesto(wb)

    expect(result.size).toBe(2)
    expect(result.get('1')).toMatchObject({
      seccion: 'A. OBRAS CIVILES',
      nombre: 'Excavación',
      unidad: 'm3',
      cantidad: 10,
      precio_unit: 5000,
      subtotal: 50000,
    })
    expect(result.get('2')).toMatchObject({
      nombre: 'Relleno',
      subtotal: 15000,
    })
  })

  it('ignora filas sin subtotal', () => {
    XLSX.utils.sheet_to_json.mockReturnValue([
      [1, 'Excavación', 'm3', 10, 5000, 50000],
      [null, 'Fila vacía', null, null, null, null],
    ])

    const wb = { SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }
    const { items: result } = parsearPresupuesto(wb)
    expect(result.size).toBe(1)
  })

  it('lanza error si no hay items', () => {
    XLSX.utils.sheet_to_json.mockReturnValue([
      ['Solo texto', null, null, null, null, null],
    ])

    const wb = { SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }
    expect(() => parsearPresupuesto(wb)).toThrow('El archivo no tiene el formato esperado.')
  })

  it('detecta múltiples secciones y las asigna correctamente', () => {
    XLSX.utils.sheet_to_json.mockReturnValue([
      ['A. FUNDACIONES', null, null, null, null, null],
      [1, 'Zapatas', 'm3', 20, 80000, 1600000],
      ['B. ESTRUCTURA', null, null, null, null, null],
      [2, 'Columnas', 'ml', 15, 120000, 1800000],
    ])

    const wb = { SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }
    const { items: result } = parsearPresupuesto(wb)
    expect(result.get('1').seccion).toBe('A. FUNDACIONES')
    expect(result.get('2').seccion).toBe('B. ESTRUCTURA')
  })
})

describe('parsearGantt', () => {
  beforeEach(() => {
    vi.spyOn(XLSX.utils, 'sheet_to_json')
  })

  it('parsea filas de partidas correctamente', () => {
    XLSX.utils.sheet_to_json.mockReturnValue([
      ['Cuadrilla / Especialidad', null, null, null, null, null, null, null, null, null],
      ['Obras Civiles', null, '1', 'Excavación', null, null, null, null, 1, 5],
      ['Obras Civiles', null, '2', 'Relleno', null, null, null, null, 6, 10],
    ])

    const wb = { SheetNames: ['Carta Gantt'], Sheets: { 'Carta Gantt': {} } }
    const result = parsearGantt(wb)

    expect(result.length).toBe(2)
    expect(result[0]).toMatchObject({
      cuadrilla: 'Obras Civiles',
      numero: '1',
      nombre: 'Excavación',
      dia_ini: 1,
      dia_fin: 5,
    })
  })

  it('usa dia_ini como dia_fin si dia_fin es null', () => {
    XLSX.utils.sheet_to_json.mockReturnValue([
      ['Cuadrilla / Especialidad', null, null, null, null, null, null, null, null, null],
      ['Cuadrilla A', null, '1', 'Tarea', null, null, null, null, 3, null],
    ])

    const wb = { SheetNames: ['Carta Gantt'], Sheets: { 'Carta Gantt': {} } }
    const result = parsearGantt(wb)
    expect(result[0].dia_fin).toBe(3)
  })

  it('lanza error si no hay items', () => {
    XLSX.utils.sheet_to_json.mockReturnValue([
      ['Cuadrilla / Especialidad', null, null, null, null, null, null, null, null, null],
    ])

    const wb = { SheetNames: ['Carta Gantt'], Sheets: { 'Carta Gantt': {} } }
    expect(() => parsearGantt(wb)).toThrow()
  })

  it('cae al primer sheet si no existe "Carta Gantt"', () => {
    XLSX.utils.sheet_to_json.mockReturnValue([
      ['Cuadrilla / Especialidad', null, null, null, null, null, null, null, null, null],
      ['Eléctrico', null, '5', 'Cableado', null, null, null, null, 10, 15],
    ])

    const wb = { SheetNames: ['OtroSheet'], Sheets: { OtroSheet: {} } }
    const result = parsearGantt(wb)
    expect(result.length).toBe(1)
    expect(result[0].cuadrilla).toBe('Eléctrico')
  })
})

describe('leerFilasGantt', () => {
  beforeEach(() => {
    vi.spyOn(XLSX.utils, 'sheet_to_json')
  })

  it('retorna máximo 20 filas como array de arrays', () => {
    const rows = Array.from({ length: 25 }, (_, i) => [`fila${i}`, null, null])
    XLSX.utils.sheet_to_json.mockReturnValue(rows)
    const wb = { SheetNames: ['Carta Gantt'], Sheets: { 'Carta Gantt': {} } }
    const result = leerFilasGantt(wb)
    expect(result).toHaveLength(20)
    expect(result[0][0]).toBe('fila0')
  })

  it('usa la primera hoja si no hay hoja con "gantt" en el nombre', () => {
    XLSX.utils.sheet_to_json.mockReturnValue([['celda', null]])
    const wb = { SheetNames: ['MiHoja'], Sheets: { MiHoja: {} } }
    const result = leerFilasGantt(wb)
    expect(result[0][0]).toBe('celda')
  })
})

describe('parsearGanttDesdeHeader', () => {
  beforeEach(() => {
    vi.spyOn(XLSX.utils, 'sheet_to_json')
  })

  it('parsea partidas desde una fila de encabezado específica', () => {
    XLSX.utils.sheet_to_json.mockReturnValue([
      ['TITULO', null, null, null, null, null, null, null, null, null],
      ['Cuadrilla / Especialidad', null, 'N°', 'Partida', null, null, null, null, 'Día Ini', 'Día Fin'],
      ['Civil', null, '1', 'Excavación', null, null, null, null, 1, 5],
    ])
    const wb = { SheetNames: ['Carta Gantt'], Sheets: { 'Carta Gantt': {} } }
    const result = parsearGanttDesdeHeader(wb, 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ cuadrilla: 'Civil', numero: '1', nombre: 'Excavación', dia_ini: 1, dia_fin: 5 })
  })

  it('lanza error si no hay partidas desde esa fila', () => {
    XLSX.utils.sheet_to_json.mockReturnValue([
      ['Sección', null, 'N°', 'Partida', null, null, null, null, 'Día Ini', 'Día Fin'],
    ])
    const wb = { SheetNames: ['Carta Gantt'], Sheets: { 'Carta Gantt': {} } }
    expect(() => parsearGanttDesdeHeader(wb, 0)).toThrow()
  })
})

describe('GanttFormatError', () => {
  it('es instancia de Error', () => {
    const e = new GanttFormatError('mensaje', [[]])
    expect(e).toBeInstanceOf(Error)
  })

  it('incluye .filas con las filas crudas', () => {
    const filas = [['A', 'B'], ['C', 'D']]
    const e = new GanttFormatError('mensaje', filas)
    expect(e.filas).toBe(filas)
  })
})

describe('parsearGantt — formato desconocido', () => {
  beforeEach(() => {
    vi.spyOn(XLSX.utils, 'sheet_to_json')
  })

  it('lanza GanttFormatError con .filas cuando no encuentra encabezado', () => {
    const rows = [
      ['CARTA GANTT 60 DÍAS', null, null],
      ['Sección', null, null],
      ['A. DEMOLICIONES', null, null],
    ]
    XLSX.utils.sheet_to_json.mockReturnValue(rows)
    const wb = { SheetNames: ['Carta Gantt'], Sheets: { 'Carta Gantt': {} } }
    let caught = null
    try { parsearGantt(wb) } catch (e) { caught = e }
    expect(caught).toBeInstanceOf(GanttFormatError)
    expect(Array.isArray(caught.filas)).toBe(true)
  })
})
