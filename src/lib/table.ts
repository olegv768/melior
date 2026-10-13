// Spreadsheet import: Excel / CSV → rows → normalised SalesData. Everything runs in the browser.
import type { DayRow, ProductRow, SalesData } from '../../shared/marketplace'

export type Cell = string | number | boolean | Date | null
export type Sheet = { name: string; rows: Cell[][] }

export const MAX_FILE_MB = 15
const MAX_ROWS = 200_000

export async function readWorkbook(file: File): Promise<Sheet[]> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`Файл больше ${MAX_FILE_MB} МБ`)
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const isCsv = /\.(csv|txt)$/i.test(file.name)
  let wb
  if (isCsv) {
    // Russian Excel saves CSV in Windows-1251; try UTF-8 first
    let text: string
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buf)
    } catch {
      text = new TextDecoder('windows-1251').decode(buf)
    }
    const first = text.split(/\r?\n/, 1)[0] ?? ''
    const FS = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : first.includes('\t') ? '\t' : ','
    wb = XLSX.read(text.replace(/^﻿/, ''), { type: 'string', FS, raw: true }) // keep values as text: «520,50» must not become 52050
  } else {
    wb = XLSX.read(buf, { type: 'array', cellDates: true })
  }
  return wb.SheetNames.map((name) => ({
    name,
    rows: (XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false }) as Cell[][]).slice(
      0,
      MAX_ROWS,
    ),
  })).filter((s) => s.rows.length > 0)
}

/* ---------- column mapping ---------- */

export const FIELDS = [
  { key: 'date', label: 'Дата', re: /дата|date|күні|время|period|период/i },
  { key: 'product', label: 'Товар', re: /товар|наимен|название|номенкл|product|item|продукт|позици|блюдо|услуг|sku|артикул/i },
  { key: 'qty', label: 'Количество', re: /кол-?во|количеств|qty|quantity|шт|units|саны/i },
  { key: 'amount', label: 'Сумма', re: /сумма|выручк|итог|amount|revenue|total|оплачен|стоимость заказа|сомасы/i },
  { key: 'price', label: 'Цена', re: /цена|price|бағасы/i },
  { key: 'cost', label: 'Себестоимость', re: /себест|закуп|cost|purchase/i },
  { key: 'category', label: 'Категория', re: /категор|category|группа|раздел/i },
  { key: 'status', label: 'Статус', re: /статус|status|состояни/i },
  { key: 'order', label: 'Номер заказа / чека', re: /заказ|чек|order|receipt|№|номер/i },
  { key: 'customer', label: 'Клиент', re: /клиент|покупател|customer|client|телефон|phone|buyer/i },
] as const

export type FieldKey = (typeof FIELDS)[number]['key']
export type Mapping = Partial<Record<FieldKey, number>>

const text = (c: Cell) => (c === null || c === undefined ? '' : String(c).trim())

/** The header row is the first of the top 15 rows that matches the most field names. */
export function findHeaderRow(rows: Cell[][]) {
  let best = 0
  let bestScore = -1
  rows.slice(0, 15).forEach((r, i) => {
    const cells = r.map(text).filter(Boolean)
    const score = cells.filter((c) => FIELDS.some((f) => f.re.test(c))).length * 2 + cells.filter((c) => isNaN(Number(c))).length * 0.1
    if (cells.length >= 2 && score > bestScore) {
      bestScore = score
      best = i
    }
  })
  return best
}

export function guessMapping(headers: string[]): Mapping {
  const m: Mapping = {}
  const used = new Set<number>()
  // more specific fields first so «Цена» doesn't steal «Себестоимость», «Сумма заказа» isn't taken as order id, etc.
  const order: FieldKey[] = ['cost', 'date', 'amount', 'qty', 'price', 'category', 'status', 'customer', 'product', 'order']
  for (const key of order) {
    const f = FIELDS.find((x) => x.key === key)!
    const idx = headers.findIndex((h, i) => !used.has(i) && f.re.test(h))
    if (idx >= 0) {
      m[key] = idx
      used.add(idx)
    }
  }
  return m
}

/* ---------- value parsing ---------- */

export function toNumber(c: Cell): number | null {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null
  if (typeof c === 'boolean' || c instanceof Date || c === null) return null
  const s = c.replace(/[\s ]/g, '').replace(/[₸₽$€]|тг|тенге|руб\.?|kzt|rub/gi, '')
  if (!s) return null
  let normalised: string
  if (s.includes('.') && s.includes(',')) {
    // whichever separator comes last is the decimal one: 1.250,50 / 1,250.50
    normalised = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (/,\d{1,2}$/.test(s)) normalised = s.replace(',', '.')
  else normalised = s.replace(/,/g, '')
  const n = Number(normalised)
  return Number.isFinite(n) ? n : null
}

export function toDate(c: Cell): Date | null {
  if (c instanceof Date) return isNaN(c.getTime()) ? null : c
  if (typeof c === 'number') {
    // Excel serial date
    if (c > 20000 && c < 80000) return new Date(Math.round((c - 25569) * 86400 * 1000) + new Date().getTimezoneOffset() * 60000)
    // unix ms / s
    if (c > 1e12) return new Date(c)
    if (c > 1e9) return new Date(c * 1000)
    return null
  }
  const s = text(c)
  if (!s) return null
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2}))?/)
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    return new Date(y, Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0))
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0))
  return null
}

const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function statusOf(c: Cell): 'sold' | 'cancel' | 'return' {
  const s = text(c).toLowerCase()
  if (/возврат|return|refund/.test(s)) return 'return'
  if (/отмен|cancel|аннул|отказ/.test(s)) return 'cancel'
  return 'sold'
}

export type BuildOptions = { costPerUnit: boolean; currency: string; fileName: string }

export type BuildResult = { ok: true; data: SalesData; used: number; skipped: number } | { ok: false; error: string }

export function validateMapping(m: Mapping): string | null {
  if (m.amount === undefined && m.price === undefined) return 'Выберите колонку «Сумма» или «Цена» — без неё не посчитать выручку.'
  if (m.date === undefined && m.product === undefined && m.category === undefined)
    return 'Нужна хотя бы одна колонка: «Дата», «Товар» или «Категория».'
  return null
}

export function buildSales(rows: Cell[][], headerRow: number, m: Mapping, opt: BuildOptions): BuildResult {
  const err = validateMapping(m)
  if (err) return { ok: false, error: err }

  const body = rows.slice(headerRow + 1)
  const dayMap = new Map<string, DayRow>()
  const prodMap = new Map<string, ProductRow>()
  const catMap = new Map<string, number>()
  const custOrders = new Map<string, Set<string>>()
  const custRevenue = new Map<string, number>()
  const orderIds = new Set<string>()
  const hours = new Array(24).fill(0)
  let hasTime = false
  let used = 0
  let skipped = 0
  let cancelled = 0
  let returned = 0
  let revenue = 0
  let units = 0
  let rowOrders = 0

  for (let i = 0; i < body.length; i++) {
    const r = body[i]
    if (!r || r.every((c) => text(c) === '')) continue
    const qty = m.qty !== undefined ? toNumber(r[m.qty]) ?? 1 : 1
    const price = m.price !== undefined ? toNumber(r[m.price]) : null
    let amount = m.amount !== undefined ? toNumber(r[m.amount]) : null
    if (amount === null && price !== null) amount = price * qty
    const date = m.date !== undefined ? toDate(r[m.date]) : null
    if (amount === null || (m.date !== undefined && !date)) {
      skipped++
      continue
    }
    // repeated header rows / subtotal lines ("Итого") are skipped
    const name = m.product !== undefined ? text(r[m.product]) || 'Без названия' : m.category !== undefined ? text(r[m.category]) || 'Без категории' : 'Все продажи'
    if (/^(итого|всего|total)/i.test(name)) {
      skipped++
      continue
    }
    used++
    const status = m.status !== undefined ? statusOf(r[m.status]) : 'sold'
    const p = prodMap.get(name) ?? { id: name, name, revenue: 0, units: 0, returns: 0, cancels: 0, cost: m.cost !== undefined ? 0 : undefined }
    prodMap.set(name, p)
    if (status === 'cancel') {
      cancelled++
      p.cancels += 1
      continue
    }
    if (status === 'return' || amount < 0) {
      returned += Math.abs(qty)
      p.returns += Math.abs(qty)
      p.revenue -= Math.abs(amount)
      revenue -= Math.abs(amount)
      if (date) {
        const d = dayMap.get(localIso(date))
        if (d) d.revenue -= Math.abs(amount)
      }
      continue
    }

    revenue += amount
    units += qty
    p.revenue += amount
    p.units += qty
    if (m.cost !== undefined) {
      const c = toNumber(r[m.cost]) ?? 0
      p.cost = (p.cost ?? 0) + (opt.costPerUnit ? c * qty : c)
    }
    if (m.category !== undefined) {
      const cat = text(r[m.category]) || 'Без категории'
      catMap.set(cat, (catMap.get(cat) ?? 0) + amount)
    }

    const orderId = m.order !== undefined ? text(r[m.order]) : ''
    const newOrder = orderId ? !orderIds.has(orderId) : true
    if (orderId) orderIds.add(orderId)
    else rowOrders++

    if (date) {
      const key = localIso(date)
      const d = dayMap.get(key) ?? { date: key, revenue: 0, orders: 0, units: 0 }
      d.revenue += amount
      d.units += qty
      if (newOrder) d.orders += 1
      dayMap.set(key, d)
      if (date.getHours() || date.getMinutes()) hasTime = true
      hours[date.getHours()] += amount
    }

    if (m.customer !== undefined) {
      const cust = text(r[m.customer])
      if (cust) {
        const set = custOrders.get(cust) ?? new Set<string>()
        set.add(orderId || (date ? localIso(date) : String(i)))
        custOrders.set(cust, set)
        custRevenue.set(cust, (custRevenue.get(cust) ?? 0) + amount)
      }
    }
  }

  if (!used) return { ok: false, error: 'Не нашли ни одной строки с суммой. Проверьте, что выбраны правильные колонки.' }

  // fill gaps between first and last day so the chart shows zero days
  const keys = [...dayMap.keys()].sort()
  if (keys.length > 1 && keys.length < 1500) {
    const start = new Date(`${keys[0]}T00:00:00`)
    const end = new Date(`${keys[keys.length - 1]}T00:00:00`)
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = localIso(d)
      if (!dayMap.has(k)) dayMap.set(k, { date: k, revenue: 0, orders: 0, units: 0 })
    }
  }
  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date))
  const orders = orderIds.size + rowOrders

  let customers: { total: number; repeat: number; repeatRevenue: number } | undefined
  if (custOrders.size) {
    let repeat = 0
    let repeatRevenue = 0
    custOrders.forEach((set, k) => {
      if (set.size > 1) {
        repeat++
        repeatRevenue += custRevenue.get(k) ?? 0
      }
    })
    customers = { total: custOrders.size, repeat, repeatRevenue }
  }

  const notes: string[] = [`Учтено строк: ${used.toLocaleString('ru-RU')}${skipped ? `, пропущено: ${skipped.toLocaleString('ru-RU')} (нет суммы или даты)` : ''}.`]
  if (m.order === undefined) notes.push('Нет колонки с номером заказа — каждая строка считается отдельным заказом.')

  return {
    ok: true,
    used,
    skipped,
    data: {
      provider: 'file',
      source: 'file',
      fileName: opt.fileName,
      currency: opt.currency,
      from: days[0]?.date ?? '',
      to: days[days.length - 1]?.date ?? '',
      days,
      products: [...prodMap.values()].filter((p) => p.units || p.returns || p.cancels).sort((a, b) => b.revenue - a.revenue),
      totals: { revenue, orders, units, cancelled, returned },
      notes,
      extras: {
        hasCost: m.cost !== undefined,
        customers,
        hours: hasTime ? hours : undefined,
        categories: catMap.size ? [...catMap].map(([name, rev]) => ({ name, revenue: rev })).sort((a, b) => b.revenue - a.revenue) : undefined,
      },
    },
  }
}

/* ---------- sample file ---------- */

export function sampleSalesCsv() {
  const items: [string, string, number, number][] = [
    ['Капучино 300 мл', 'Кофе', 1200, 380],
    ['Латте 400 мл', 'Кофе', 1400, 450],
    ['Американо', 'Кофе', 900, 210],
    ['Круассан', 'Выпечка', 850, 520],
    ['Чизкейк', 'Десерты', 1600, 1180],
    ['Сэндвич с курицей', 'Еда', 1900, 1250],
    ['Лимонад', 'Напитки', 1100, 300],
    ['Чай зелёный', 'Напитки', 700, 90],
    ['Маффин', 'Выпечка', 650, 690],
  ]
  const lines = ['Дата;Номер чека;Товар;Категория;Количество;Цена;Себестоимость;Сумма;Клиент;Статус']
  let seed = 3
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const today = new Date()
  let check = 1000
  for (let d = 27; d >= 0; d--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - d)
    const checks = 18 + Math.round(rnd() * 14) + (day.getDay() === 6 || day.getDay() === 0 ? 10 : 0)
    for (let c = 0; c < checks; c++) {
      check++
      const hour = rnd() < 0.45 ? 8 + Math.floor(rnd() * 3) : 12 + Math.floor(rnd() * 9)
      const ts = `${String(day.getDate()).padStart(2, '0')}.${String(day.getMonth() + 1).padStart(2, '0')}.${day.getFullYear()} ${hour}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`
      const client = rnd() < 0.6 ? `+7 701 ${100 + Math.floor(rnd() * 420)} 00 00` : ''
      const lines_n = 1 + Math.floor(rnd() * 2)
      for (let k = 0; k < lines_n; k++) {
        const w = Math.floor(Math.pow(rnd(), 1.6) * items.length)
        const [name, cat, price, cost] = items[w]
        const qty = rnd() < 0.15 ? 2 : 1
        const status = rnd() < 0.02 ? 'Возврат' : 'Оплачен'
        lines.push([ts, check, name, cat, qty, price, cost, price * qty, client, status].join(';'))
      }
    }
  }
  return '﻿' + lines.join('\r\n')
}

export function sampleFunnelCsv() {
  return '﻿' + ['Этап;Количество', 'Написали в WhatsApp/Instagram;1240', 'Получили ответ;980', 'Узнали цену;720', 'Оформили заказ;260', 'Оплатили;214', 'Купили повторно;61'].join('\r\n')
}

export function downloadText(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
