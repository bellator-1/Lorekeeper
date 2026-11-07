// Calendario personalizzato: le date sono interi (giorni dall'anno 0, giorno 1).
export type Era = { name: string; start: number }
export type Calendar = { months: { name: string; days: number }[]; era: string; eras?: Era[] }
export const DEFAULT_CAL: Calendar = { months: Array.from({ length: 12 }, (_, i) => ({ name: `Mese ${i + 1}`, days: 30 })), era: '' }

export const yearLen = (c: Calendar) => c.months.reduce((a, m) => a + m.days, 0) || 1
export const toDay = (c: Calendar, y: number, m: number, d: number) =>
  y * yearLen(c) + c.months.slice(0, m).reduce((a, x) => a + x.days, 0) + (d - 1)
export const fromDay = (c: Calendar, n: number) => {
  const L = yearLen(c), y = Math.floor(n / L)
  let r = n - y * L, m = 0
  while (m < c.months.length - 1 && r >= c.months[m].days) { r -= c.months[m].days; m++ }
  return { y, m, d: r + 1 }
}
export const fmt = (c: Calendar, n: number) => {
  const { y, m, d } = fromDay(c, n)
  return `${d} ${c.months[m]?.name ?? ''} ${y}${c.era ? ' ' + c.era : ''}`
}
export const eraList = (c: Calendar) => [...(c.eras ?? [])].sort((a, b) => a.start - b.start)

// Durata leggibile: «24 anni», «1,5 anni», «40 giorni»
export const durLabel = (c: Calendar, days: number) => {
  const d = Math.max(0, Math.round(days)), y = d / yearLen(c)
  if (y >= 1) { const r = Math.round(y * 10) / 10; return `${String(r).replace('.', ',')} ${r === 1 ? 'anno' : 'anni'}` }
  return `${d} ${d === 1 ? 'giorno' : 'giorni'}`
}

