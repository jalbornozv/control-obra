export function calcAvanceEsperado(diaActual, diaIni, diaFin) {
  if (diaActual < diaIni) return 0
  if (diaActual >= diaFin) return 100
  return ((diaActual - diaIni) / (diaFin - diaIni)) * 100
}

export function calcSemaforo(avancePct, avanceEsperado) {
  if (avanceEsperado === 0) return 'gris'
  if (avancePct >= avanceEsperado) return 'verde'
  if (avancePct >= avanceEsperado * 0.7) return 'amarillo'
  return 'rojo'
}

export function calcValorizacion(partidas) {
  const porPartida = partidas.map(p => ({
    id: p.id,
    monto: (p.avance_pct / 100) * (p.subtotal || 0),
  }))
  const total = porPartida.reduce((sum, p) => sum + p.monto, 0)
  return { total, porPartida }
}

export function calcDiaActual(fechaInicio) {
  const inicio = new Date(fechaInicio + 'T00:00:00')
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const diff = Math.floor((hoy - inicio) / 86400000)
  return diff + 1
}

export function formatCLP(number) {
  if (number === 0) return '$ 0'
  return '$ ' + Math.round(number).toLocaleString('es-CL')
}
