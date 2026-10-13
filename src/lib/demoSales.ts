// Deterministic demo datasets so the marketplace dashboard can be shown without real credentials.
import type { DayRow, PeriodDays, ProductRow, ProviderId, SalesData } from '../../shared/marketplace'
import { providerOf } from '../../shared/marketplace'

const CATALOG: Record<ProviderId, [string, number][]> = {
  kaspi: [
    ['Пылесос беспроводной V12', 54_900],
    ['Чайник электрический 1,7 л', 9_490],
    ['Наушники беспроводные TWS', 12_990],
    ['Утюг паровой 2400 Вт', 15_900],
    ['Набор посуды, 12 предметов', 27_500],
    ['Термос 1 л', 6_990],
    ['Фен 2000 Вт', 11_490],
    ['Увлажнитель воздуха 4 л', 18_900],
    ['Сковорода 28 см', 8_990],
    ['Блендер погружной', 13_490],
    ['Весы кухонные', 4_590],
    ['Кофемолка ручная', 7_900],
  ],
  wb: [
    ['Худи оверсайз', 2_890],
    ['Футболка базовая хлопок', 990],
    ['Джинсы прямые', 3_490],
    ['Кардиган вязаный', 3_190],
    ['Спортивный костюм', 4_590],
    ['Носки, набор 5 пар', 690],
    ['Платье миди', 2_790],
    ['Шапка бини', 790],
    ['Брюки карго', 2_990],
    ['Рубашка оверсайз', 2_490],
  ],
  ozon: [
    ['Крем для лица SPF 30', 1_290],
    ['Сыворотка с витамином C', 1_590],
    ['Шампунь бессульфатный', 690],
    ['Маска для волос', 890],
    ['Гель для умывания', 590],
    ['Патчи для глаз, 60 шт', 790],
    ['Тоник для лица', 650],
    ['Бальзам для губ', 290],
    ['Набор кистей для макияжа', 1_990],
    ['Масло для тела', 1_190],
    ['Скраб для тела', 750],
  ],
}

const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function buildDemoSales(provider: ProviderId, days: PeriodDays): SalesData {
  const rand = rng(provider === 'kaspi' ? 7 : provider === 'wb' ? 11 : 23)
  const catalog = CATALOG[provider]
  // popularity: a few leaders, a long tail
  const weight = catalog.map((_, i) => 1 / Math.pow(i + 1, 1.15))
  const wSum = weight.reduce((a, b) => a + b, 0)
  const baseOrders = provider === 'kaspi' ? 14 : provider === 'wb' ? 46 : 38

  const DAY = 24 * 60 * 60 * 1000
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const from = today.getTime() - (days - 1) * DAY

  const products: ProductRow[] = catalog.map(([name], i) => ({ id: `demo-${provider}-${i}`, name, revenue: 0, units: 0, returns: 0, cancels: 0 }))
  const dayRows: DayRow[] = []
  let cancelled = 0
  let returned = 0

  for (let d = 0; d < days; d++) {
    const t = from + d * DAY
    const date = new Date(t)
    const wd = date.getDay()
    const weekend = wd === 0 || wd === 6 ? 1.25 : 1
    const trend = 1 + (d / days) * (provider === 'ozon' ? -0.18 : 0.12)
    const orders = Math.max(1, Math.round(baseOrders * weekend * trend * (0.8 + rand() * 0.4)))
    const row: DayRow = { date: localIso(date), revenue: 0, orders: 0, units: 0 }
    for (let o = 0; o < orders; o++) {
      let r = rand() * wSum
      let idx = 0
      while (r > weight[idx] && idx < weight.length - 1) r -= weight[idx++]
      const p = products[idx]
      const price = catalog[idx][1] * (0.92 + rand() * 0.12)
      // the 4th product suffers from stock-outs → many cancellations
      const cancelChance = idx === 3 ? 0.24 : 0.035
      if (rand() < cancelChance) {
        p.cancels++
        cancelled++
        continue
      }
      const qty = rand() < 0.12 ? 2 : 1
      p.units += qty
      p.revenue += price * qty
      row.revenue += price * qty
      row.orders++
      row.units += qty
      const returnChance = provider === 'wb' ? (idx === 2 ? 0.2 : 0.06) : 0.02
      if (rand() < returnChance) {
        p.returns++
        returned++
      }
    }
    row.revenue = Math.round(row.revenue)
    dayRows.push(row)
  }
  products.forEach((p) => (p.revenue = Math.round(p.revenue)))

  return {
    provider,
    source: 'demo',
    currency: providerOf(provider).currency,
    from: dayRows[0].date,
    to: dayRows[dayRows.length - 1].date,
    days: dayRows,
    products: products.sort((a, b) => b.revenue - a.revenue),
    totals: {
      revenue: dayRows.reduce((a, r) => a + r.revenue, 0),
      orders: dayRows.reduce((a, r) => a + r.orders, 0),
      units: dayRows.reduce((a, r) => a + r.units, 0),
      cancelled,
      returned,
    },
    notes: ['Демонстрационные данные: магазин и цифры вымышлены.'],
  }
}
