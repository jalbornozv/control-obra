import { supabase } from './supabase'

export async function hashPin(pin) {
  const data   = new TextEncoder().encode(pin)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function loginAdmin(pin) {
  const pin_hash = await hashPin(pin)
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, rol')
    .eq('rol', 'admin')
    .eq('pin_hash', pin_hash)
    .single()
  if (error || !data) return null
  return { rol: 'admin', nombre: data.nombre, usuarioId: data.id, obraId: null }
}

export async function loginTrabajador(nombre, pin) {
  const pin_hash = await hashPin(pin)
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, obra_id')
    .eq('rol', 'trabajador')
    .eq('nombre', nombre)
    .eq('pin_hash', pin_hash)
    .single()
  if (error || !data) return null
  return { rol: 'trabajador', nombre: data.nombre, usuarioId: data.id, obraId: data.obra_id }
}

export async function loginMandante(pin) {
  const { data, error } = await supabase
    .from('obras')
    .select('id, nombre')
    .eq('pin_cliente', pin)
    .single()
  if (error || !data) return null
  return { rol: 'mandante', nombre: data.nombre, obraId: data.id, usuarioId: null }
}

const SESSION_KEY = 'co_session'

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
}

export function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
