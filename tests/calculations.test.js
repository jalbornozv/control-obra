import { describe, it, expect } from 'vitest'
import {
  calcAvanceEsperado,
  calcSemaforo,
  calcValorizacion,
  calcDiaActual,
  formatCLP,
} from '../src/lib/calculations'

describe('calcAvanceEsperado', () => {
  it('retorna 50 cuando el día actual es el punto medio de la ventana', () => {
    expect(calcAvanceEsperado(5, 1, 10)).toBeCloseTo(44.4, 0)
  })
  it('retorna 100 cuando el día actual supera el día fin', () => {
    expect(calcAvanceEsperado(15, 1, 10)).toBe(100)
  })
  it('retorna 0 cuando el día actual es anterior al día ini', () => {
    expect(calcAvanceEsperado(0, 5, 10)).toBe(0)
  })
})

describe('calcSemaforo', () => {
  it('retorna verde cuando avance real >= esperado', () => {
    expect(calcSemaforo(80, 70)).toBe('verde')
  })
  it('retorna amarillo cuando avance real está entre 70% y 99% del esperado', () => {
    expect(calcSemaforo(55, 70)).toBe('amarillo')
  })
  it('retorna rojo cuando avance real < 70% del esperado', () => {
    expect(calcSemaforo(40, 70)).toBe('rojo')
  })
  it('retorna gris cuando avance esperado es 0 (partida no iniciada)', () => {
    expect(calcSemaforo(0, 0)).toBe('gris')
  })
})

describe('calcValorizacion', () => {
  it('calcula correctamente el monto valorizado por partida', () => {
    const partidas = [
      { id: '1', avance_pct: 50, subtotal: 1000000 },
      { id: '2', avance_pct: 100, subtotal: 2000000 },
    ]
    const result = calcValorizacion(partidas)
    expect(result.total).toBe(2500000)
    expect(result.porPartida[0].monto).toBe(500000)
    expect(result.porPartida[1].monto).toBe(2000000)
  })
})

describe('calcDiaActual', () => {
  it('retorna 1 si la fecha de inicio es hoy', () => {
    const hoy = new Date().toISOString().split('T')[0]
    expect(calcDiaActual(hoy)).toBe(1)
  })
  it('retorna 2 si la fecha de inicio fue ayer', () => {
    const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    expect(calcDiaActual(ayer)).toBe(2)
  })
})

describe('formatCLP', () => {
  it('formatea correctamente un número como CLP', () => {
    expect(formatCLP(1234567)).toBe('$ 1.234.567')
  })
  it('maneja cero', () => {
    expect(formatCLP(0)).toBe('$ 0')
  })
})
