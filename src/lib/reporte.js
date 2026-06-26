import { calcAvanceEsperado } from './calculations'

export function generarChips(totalDias) {
  const chips = []
  let dia = 1
  let semana = 1
  while (dia <= totalDias) {
    const fin = Math.min(dia + 6, totalDias)
    chips.push({ label: `Semana ${semana} (Días ${dia}-${fin})`, diaIni: dia, diaFin: fin })
    dia += 7
    semana++
  }
  chips.push({ label: 'Todo', diaIni: 1, diaFin: totalDias })
  return chips
}

export function validarPeriodo(diaIni, diaFin, totalDias) {
  if (diaIni < 1) return { valido: false, error: 'El día de inicio debe ser mayor a 0.' }
  if (diaFin > totalDias) return { valido: false, error: `El día fin no puede superar ${totalDias}.` }
  if (diaIni > diaFin) return { valido: false, error: 'El día de inicio debe ser menor al día fin.' }
  return { valido: true, error: '' }
}

export function filtrarPartidasPeriodo(partidas, diaIni, diaFin) {
  return partidas.filter(p => p.dia_ini <= diaFin && p.dia_fin >= diaIni)
}

export function calcResumenPeriodo(partidas, diaIni, diaFin, diaActual) {
  if (partidas.length === 0) return { avanceGlobal: 0, avanceEsperado: 0, completadasEnPeriodo: 0 }
  const avanceGlobal = partidas.reduce((s, p) => s + (p.avance_pct || 0), 0) / partidas.length
  const avanceEsperado = partidas.reduce((s, p) => s + calcAvanceEsperado(diaActual, p.dia_ini, p.dia_fin), 0) / partidas.length
  const completadasEnPeriodo = partidas.filter(p => p.avance_pct >= 100).length
  return { avanceGlobal, avanceEsperado, completadasEnPeriodo }
}
