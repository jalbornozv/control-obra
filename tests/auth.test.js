import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/lib/supabase', () => ({
  supabase: { from: vi.fn() }
}))

import { hashPin, loginAdmin, loginTrabajador, loginMandante, getSession, setSession, clearSession } from '../src/lib/auth'
import { supabase } from '../src/lib/supabase'

function mockChain(data, error = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  }
  supabase.from.mockReturnValue(chain)
  return chain
}

describe('hashPin', () => {
  it('retorna string hex de 64 caracteres', async () => {
    const h = await hashPin('1234')
    expect(h).toHaveLength(64)
    expect(h).toMatch(/^[0-9a-f]+$/)
  })

  it('retorna el hash conocido para "1234"', async () => {
    expect(await hashPin('1234')).toBe('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4')
  })

  it('hashes distintos para PINs distintos', async () => {
    expect(await hashPin('1234')).not.toBe(await hashPin('5678'))
  })
})

describe('loginAdmin', () => {
  it('retorna sesión cuando PIN es correcto', async () => {
    mockChain({ id: 'uid-1', nombre: 'Admin', rol: 'admin' })
    expect(await loginAdmin('1234')).toEqual({ rol: 'admin', nombre: 'Admin', usuarioId: 'uid-1', obraId: null })
  })

  it('retorna null cuando PIN es incorrecto', async () => {
    mockChain(null, { message: 'No rows' })
    expect(await loginAdmin('wrong')).toBeNull()
  })
})

describe('loginTrabajador', () => {
  it('retorna sesión cuando nombre y PIN coinciden', async () => {
    mockChain({ id: 'uid-2', nombre: 'Juan', rol: 'trabajador', obra_id: 'obra-1' })
    expect(await loginTrabajador('Juan', '4321')).toEqual({ rol: 'trabajador', nombre: 'Juan', usuarioId: 'uid-2', obraId: 'obra-1' })
  })

  it('retorna null cuando no hay coincidencia', async () => {
    mockChain(null, { message: 'No rows' })
    expect(await loginTrabajador('Juan', 'bad')).toBeNull()
  })
})

describe('loginMandante', () => {
  it('retorna sesión cuando PIN de obra coincide', async () => {
    mockChain({ id: 'obra-1', nombre: 'Obra Test' })
    expect(await loginMandante('9999')).toEqual({ rol: 'mandante', nombre: 'Obra Test', obraId: 'obra-1', usuarioId: null })
  })

  it('retorna null si PIN no coincide', async () => {
    mockChain(null, { message: 'No rows' })
    expect(await loginMandante('0000')).toBeNull()
  })
})

describe('session (localStorage)', () => {
  beforeEach(() => localStorage.clear())

  it('getSession retorna null si no hay sesión', () => {
    expect(getSession()).toBeNull()
  })

  it('setSession y getSession son inversos', () => {
    const s = { rol: 'admin', nombre: 'Admin', obraId: null, usuarioId: 'uid-1' }
    setSession(s)
    expect(getSession()).toEqual(s)
  })

  it('clearSession elimina la sesión', () => {
    setSession({ rol: 'admin', nombre: 'Admin', obraId: null, usuarioId: 'uid-1' })
    clearSession()
    expect(getSession()).toBeNull()
  })
})
