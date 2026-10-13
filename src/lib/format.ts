export const fmtMoney = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸`
  if (abs >= 1_000) return `${Math.round(n / 1_000).toLocaleString('ru-RU')} тыс ₸`
  return `${Math.round(n).toLocaleString('ru-RU')} ₸`
}

export const fmtPct = (n: number, digits = 0) =>
  `${n.toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`

export const fmtInt = (n: number) => Math.round(n).toLocaleString('ru-RU')

export const fmtMoneyRange = (low: number, high: number) => {
  if (high >= 1_000_000) {
    const f = (n: number) => (n / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })
    return `${f(low)}–${f(high)} млн ₸`
  }
  if (high >= 1_000) return `${Math.round(low / 1_000).toLocaleString('ru-RU')}–${Math.round(high / 1_000).toLocaleString('ru-RU')} тыс ₸`
  return `${Math.round(low)}–${Math.round(high)} ₸`
}
