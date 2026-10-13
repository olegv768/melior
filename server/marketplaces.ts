// Server-side connectors. Each one turns a marketplace's own API into the common SalesData model.
// Credentials are used for the duration of one request and are never stored or logged.
import type { Credentials, DayRow, PeriodDays, ProductRow, ProviderId, SalesData } from '../shared/marketplace.js'
import { providerOf } from '../shared/marketplace.js'

export class MarketplaceError extends Error {
  code: 'auth' | 'forbidden_region' | 'rate_limited' | 'upstream' | 'timeout'
  constructor(code: MarketplaceError['code'], message?: string) {
    super(message ?? code)
    this.code = code
  }
}

const DAY = 24 * 60 * 60 * 1000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

async function request(url: string, init: RequestInit, timeoutMs = 20_000): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (res.status === 401) throw new MarketplaceError('auth')
    if (res.status === 403) throw new MarketplaceError('forbidden_region')
    if (res.status === 429) throw new MarketplaceError('rate_limited')
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      // Ozon answers 400/404 with "Invalid Api-Key" / "Client-Id" for bad credentials
      if ((res.status === 400 || res.status === 404) && /api-key|client-id|unauthori[sz]ed|token/i.test(text)) {
        throw new MarketplaceError('auth')
      }
      console.error('Marketplace upstream error', new URL(url).host, res.status, text.slice(0, 300))
      throw new MarketplaceError('upstream')
    }
    return await res.json()
  } catch (err) {
    if (err instanceof MarketplaceError) throw err
    if (err instanceof Error && err.name === 'AbortError') throw new MarketplaceError('timeout')
    throw new MarketplaceError('upstream')
  } finally {
    clearTimeout(timer)
  }
}

function emptyDays(fromMs: number, days: number): Map<string, DayRow> {
  const map = new Map<string, DayRow>()
  for (let i = 0; i < days; i++) {
    const date = iso(fromMs + i * DAY)
    map.set(date, { date, revenue: 0, orders: 0, units: 0 })
  }
  return map
}

function finish(
  provider: ProviderId,
  fromMs: number,
  toMs: number,
  dayMap: Map<string, DayRow>,
  prodMap: Map<string, ProductRow>,
  cancelled: number,
  returned: number,
  notes: string[],
): SalesData {
  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date))
  const products = [...prodMap.values()].sort((a, b) => b.revenue - a.revenue)
  return {
    provider,
    source: 'api',
    currency: providerOf(provider).currency,
    from: iso(fromMs),
    to: iso(toMs),
    days,
    products,
    totals: {
      revenue: days.reduce((a, d) => a + d.revenue, 0),
      orders: days.reduce((a, d) => a + d.orders, 0),
      units: days.reduce((a, d) => a + d.units, 0),
      cancelled,
      returned,
    },
    notes,
  }
}

const prod = (map: Map<string, ProductRow>, id: string, name: string) => {
  let p = map.get(id)
  if (!p) {
    p = { id, name, revenue: 0, units: 0, returns: 0, cancels: 0 }
    map.set(id, p)
  }
  return p
}

/* ---------------- Kaspi ---------------- */
// GET https://kaspi.kz/shop/api/v2/orders  (X-Auth-Token, JSON:API, dates in ms, page[size] ≤ 100)

type KaspiOrder = {
  id: string
  attributes: { code?: string; totalPrice?: number; status?: string; state?: string; creationDate?: number }
}

const KASPI_STATES = ['ARCHIVE', 'KASPI_DELIVERY', 'DELIVERY', 'PICKUP', 'SIGN_REQUIRED', 'NEW']
const KASPI_ENTRY_LIMIT = 150 // product breakdown is one request per order; keep the function fast

async function kaspi(creds: Credentials, days: PeriodDays): Promise<SalesData> {
  const toMs = Date.now()
  const fromMs = toMs - days * DAY
  const headers = { 'Content-Type': 'application/vnd.api+json', 'X-Auth-Token': creds.token }
  const orders = new Map<string, KaspiOrder>()

  // query in ≤ 14-day windows, the range the official examples use
  for (let start = fromMs; start < toMs; start += 14 * DAY) {
    const end = Math.min(start + 14 * DAY, toMs)
    await Promise.all(
      KASPI_STATES.map(async (state) => {
      for (let page = 0; page < 20; page++) {
        const qs = new URLSearchParams({
          'page[number]': String(page),
          'page[size]': '100',
          'filter[orders][state]': state,
          'filter[orders][creationDate][$ge]': String(start),
          'filter[orders][creationDate][$le]': String(end),
        })
        const res = (await request(`https://kaspi.kz/shop/api/v2/orders?${qs}`, { headers })) as {
          data?: KaspiOrder[]
          meta?: { pageCount?: number }
        }
        res.data?.forEach((o) => orders.set(o.id, o))
        if (!res.meta?.pageCount || page + 1 >= res.meta.pageCount) break
      }
      }),
    )
  }

  const dayMap = emptyDays(fromMs, days)
  const prodMap = new Map<string, ProductRow>()
  let cancelled = 0
  let returned = 0
  const sold: KaspiOrder[] = []
  for (const o of orders.values()) {
    const s = o.attributes.status ?? ''
    if (s === 'CANCELLED' || s === 'CANCELLING') {
      cancelled++
      continue
    }
    if (s === 'RETURNED' || s === 'KASPI_DELIVERY_RETURN_REQUESTED') returned++
    const date = iso(o.attributes.creationDate ?? toMs)
    const row = dayMap.get(date)
    if (row) {
      row.revenue += o.attributes.totalPrice ?? 0
      row.orders += 1
    }
    sold.push(o)
  }

  // product breakdown: entries of the most recent orders
  const notes: string[] = []
  const recent = sold.sort((a, b) => (b.attributes.creationDate ?? 0) - (a.attributes.creationDate ?? 0)).slice(0, KASPI_ENTRY_LIMIT)
  if (sold.length > KASPI_ENTRY_LIMIT) notes.push(`Разбивка по товарам построена по последним ${KASPI_ENTRY_LIMIT} заказам из ${sold.length}.`)
  const unitsByDate = new Map<string, number>()
  for (let i = 0; i < recent.length; i += 10) {
    await Promise.all(
      recent.slice(i, i + 10).map(async (o) => {
        try {
          const res = (await request(`https://kaspi.kz/shop/api/v2/orders/${encodeURIComponent(o.id)}/entries`, { headers })) as {
            data?: { id: string; attributes?: Record<string, unknown> }[]
          }
          for (const e of res.data ?? []) {
            const a = e.attributes ?? {}
            const qty = Number(a.quantity ?? 1) || 1
            const price = Number(a.totalPrice ?? Number(a.basePrice ?? 0) * qty) || 0
            const offer = (a.offer ?? a.product ?? {}) as Record<string, unknown>
            const name = String(offer.name ?? a.name ?? 'Товар без названия')
            const id = String(offer.code ?? a.code ?? name)
            const p = prod(prodMap, id, name)
            p.units += qty
            p.revenue += price
            if (o.attributes.status === 'RETURNED') p.returns += qty
            const date = iso(o.attributes.creationDate ?? toMs)
            unitsByDate.set(date, (unitsByDate.get(date) ?? 0) + qty)
          }
        } catch {
          /* one failed order must not break the report */
        }
      }),
    )
  }
  unitsByDate.forEach((u, date) => {
    const row = dayMap.get(date)
    if (row) row.units = u
  })
  if (!prodMap.size && sold.length) notes.push('Kaspi не вернул состав заказов — показана только выручка по дням.')
  return finish('kaspi', fromMs, toMs, dayMap, prodMap, cancelled, returned, notes)
}

/* ---------------- Wildberries ---------------- */
// GET https://statistics-api.wildberries.ru/api/v1/supplier/sales|orders?dateFrom=YYYY-MM-DD  (Authorization: token)

type WbSale = {
  date?: string
  saleID?: string
  nmId?: number
  supplierArticle?: string
  subject?: string
  brand?: string
  priceWithDisc?: number
  finishedPrice?: number
  totalPrice?: number
}
type WbOrder = { date?: string; nmId?: number; supplierArticle?: string; subject?: string; isCancel?: boolean }

async function wildberries(creds: Credentials, days: PeriodDays): Promise<SalesData> {
  const toMs = Date.now()
  const fromMs = toMs - days * DAY
  const headers = { Authorization: creds.token }
  const base = 'https://statistics-api.wildberries.ru/api/v1/supplier'
  const [sales, orders] = (await Promise.all([
    request(`${base}/sales?dateFrom=${iso(fromMs)}`, { headers }),
    request(`${base}/orders?dateFrom=${iso(fromMs)}`, { headers }),
  ])) as [WbSale[], WbOrder[]]

  const dayMap = emptyDays(fromMs, days)
  const prodMap = new Map<string, ProductRow>()
  let returned = 0
  for (const s of Array.isArray(sales) ? sales : []) {
    const date = (s.date ?? '').slice(0, 10)
    const isReturn = (s.saleID ?? '').startsWith('R')
    const amount = Math.abs(s.priceWithDisc ?? s.finishedPrice ?? 0)
    const id = String(s.nmId ?? s.supplierArticle ?? 'unknown')
    const p = prod(prodMap, id, [s.subject, s.supplierArticle].filter(Boolean).join(' · ') || `Артикул ${id}`)
    const row = dayMap.get(date)
    if (isReturn) {
      returned++
      p.returns++
      p.revenue -= amount
      if (row) row.revenue -= amount
      continue
    }
    p.units++
    p.revenue += amount
    if (row) {
      row.revenue += amount
      row.orders++
      row.units++
    }
  }
  let cancelled = 0
  for (const o of Array.isArray(orders) ? orders : []) {
    if (!o.isCancel) continue
    cancelled++
    const id = String(o.nmId ?? o.supplierArticle ?? 'unknown')
    prod(prodMap, id, [o.subject, o.supplierArticle].filter(Boolean).join(' · ') || `Артикул ${id}`).cancels++
  }
  return finish('wb', fromMs, toMs, dayMap, prodMap, cancelled, returned, [
    'Данные статистики Wildberries обновляются с задержкой до 30 минут.',
  ])
}

/* ---------------- Ozon ---------------- */
// POST https://api-seller.ozon.ru/v1/analytics/data  (Client-Id, Api-Key)

type OzonRow = { dimensions?: { id?: string; name?: string }[]; metrics?: number[] }

async function ozon(creds: Credentials, days: PeriodDays): Promise<SalesData> {
  const toMs = Date.now()
  const fromMs = toMs - days * DAY
  const headers = { 'Client-Id': creds.clientId, 'Api-Key': creds.apiKey, 'Content-Type': 'application/json' }
  const metrics = ['revenue', 'ordered_units', 'returns', 'cancellations']
  const query = (dimension: string[]) =>
    request('https://api-seller.ozon.ru/v1/analytics/data', {
      method: 'POST',
      headers,
      body: JSON.stringify({ date_from: iso(fromMs), date_to: iso(toMs), metrics, dimension, limit: 1000, offset: 0 }),
    }) as Promise<{ result?: { data?: OzonRow[] } }>

  const byDay = await query(['day'])
  const bySku = await query(['sku'])

  const dayMap = emptyDays(fromMs, days)
  let cancelled = 0
  let returned = 0
  for (const r of byDay.result?.data ?? []) {
    const date = r.dimensions?.[0]?.id ?? ''
    const [revenue = 0, units = 0, ret = 0, canc = 0] = r.metrics ?? []
    returned += ret
    cancelled += canc
    const row = dayMap.get(date)
    if (row) {
      row.revenue += revenue
      row.units += units
      row.orders += units // Ozon analytics reports units; orders ≈ units at this level of detail
    }
  }
  const prodMap = new Map<string, ProductRow>()
  for (const r of bySku.result?.data ?? []) {
    const d = r.dimensions?.[0] ?? {}
    const [revenue = 0, units = 0, ret = 0, canc = 0] = r.metrics ?? []
    const id = String(d.id ?? 'sku')
    const p = prod(prodMap, id, d.name || `SKU ${id}`)
    p.revenue += revenue
    p.units += units
    p.returns += ret
    p.cancels += canc
  }
  return finish('ozon', fromMs, toMs, dayMap, prodMap, cancelled, returned, [
    'Ozon считает аналитику по заказанным единицам; число заказов приравнено к числу единиц.',
  ])
}

export async function fetchSales(provider: ProviderId, creds: Credentials, days: PeriodDays): Promise<SalesData> {
  if (provider === 'kaspi') return kaspi(creds, days)
  if (provider === 'wb') return wildberries(creds, days)
  return ozon(creds, days)
}
