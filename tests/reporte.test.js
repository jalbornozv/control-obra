import { describe, it, expect } from 'vitest'
import {
  generarChips,
  validarPeriodo,
  filtrarPartidasPeriodo,
  calcResumenPeriodo,
} from '../src/lib/reporte'

describe('generarChips', () => {
  it('genera chips de semanas correctamente para 14 días', () => {
    const chips = generarChips(14)
    expect(chips).toHaveLength(3) // Semana 1, Semana 2, Todo
    expect(chips[0]).toEqual({ label: 'Semana 1 (Días 1-7)', diaIni: 1, diaFin: 7 })
    expect(chips[1]).toEqual({ label: 'Semana 2 (Días 8-14)', diaIni: 8, diaFin: 14 })
    expect(chips[2]).toEqual({ label: 'Todo', diaIni: 1, diaFin: 14 })
  })

  it('último chip de semana usa totalDias como fin si no cierra en 7', () => {
    const chips = generarChips(10)
    expect(chips[1]).toEqual({ label: 'Semana 2 (Días 8-10)', diaIni: 8, diaFin: 10 })
  })
})

describe('validarPeriodo', () => {
  it('retorna valido true para un rango correcto', () => {
    expect(validarPeriodo(1, 15, 60)).toEqual({ valido: true, error: '' })
  })
  it('retorna error si diaIni > diaFin', () => {
    const r = validarPeriodo(15, 5, 60)
    expect(r.valido).toBe(false)
    expect(r.error).toBeTruthy()
  })
  it('retorna error si diaFin > totalDias', () => {
    const r = validarPeriodo(1, 70, 60)
    expect(r.valido).toBe(false)
    expect(r.error).toBeTruthy()
  })
  it('retorna error si diaIni < 1', () => {
    const r = validarPeriodo(0, 10, 60)
    expect(r.valido).toBe(false)
    expect(r.error).toBeTruthy()
  })
})

describe('filtrarPartidasPeriodo', () => {
  const partidas = [
    { id: '1', dia_ini: 1, dia_fin: 10, nombre: 'A' },
    { id: '2', dia_ini: 15, dia_fin: 25, nombre: 'B' },
    { id: '3', dia_ini: 8, dia_fin: 20, nombre: 'C' },
  ]
  it('incluye partidas que se intersectan con el periodo', () => {
    const result = filtrarPartidasPeriodo(partidas, 1, 12)
    expect(result.map(p => p.id)).toEqual(['1', '3'])
  })
  it('incluye partida que empieza dentro del periodo', () => {
    const result = filtrarPartidasPeriodo(partidas, 14, 20)
    expect(result.map(p => p.id)).toContain('2')
  })
})

describe('calcResumenPeriodo', () => {
  it('calcula avance global correctamente', () => {
    const partidas = [
      { id: '1', dia_ini: 1, dia_fin: 10, avance_pct: 100 },
      { id: '2', dia_ini: 1, dia_fin: 10, avance_pct: 50 },
    ]
    const r = calcResumenPeriodo(partidas, 1, 10, 5)
    expect(r.avanceGlobal).toBe(75)
  })
  it('cuenta partidas completadas (avance_pct === 100)', () => {
    const partidas = [
      { id: '1', dia_ini: 1, dia_fin: 10, avance_pct: 100 },
      { id: '2', dia_ini: 1, dia_fin: 10, avance_pct: 50 },
    ]
    const r = calcResumenPeriodo(partidas, 1, 10, 5)
    expect(r.completadasEnPeriodo).toBe(1)
  })
})
