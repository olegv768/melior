// Marketplace sales: common model shared by the browser and the Vercel function.

export const PROVIDERS = [
  {
    id: 'kaspi',
    name: 'Kaspi Магазин',
    currency: '₸',
    fields: [{ key: 'token', label: 'API-токен', hint: 'Кабинет продавца Kaspi → Настройки → Токен API' }],
  },
  {
    id: 'wb',
    name: 'Wildberries',
    currency: '₽',
    fields: [
      {
        key: 'token',
        label: 'API-токен (категория «Статистика»)',
        hint: 'Кабинет WB → Настройки → Доступ к API → новый токен, категория «Статистика», «Только чтение»',
      },
    ],
  },
  {
    id: 'ozon',
    name: 'Ozon',
    currency: '₽',
    fields: [
      { key: 'clientId', label: 'Client ID', hint: 'Кабинет Ozon Seller → Настройки → Seller API' },
      { key: 'apiKey', label: 'API Key', hint: 'Ключ с ролью «Аналитика» или «Только чтение»' },
    ],
  },
] as const

export type ProviderId = (typeof PROVIDERS)[number]['id']
export const PERIODS = [7, 14, 30] as const
export type PeriodDays = (typeof PERIODS)[number]

export type DayRow = { date: string; revenue: number; orders: number; units: number }
export type ProductRow = {
  id: string
  name: string
  revenue: number
  units: number
  returns: number
  cancels: number
  /** total cost of goods sold, when the source has it */
  cost?: number
}

/** Where the data came from: a marketplace API or a user's own spreadsheet. */
export type SourceId = ProviderId | 'file'

export type SalesExtras = {
  hasCost: boolean
  customers?: { total: number; repeat: number; repeatRevenue: number }
  /** revenue by hour of day (0–23), when timestamps include time */
  hours?: number[]
  categories?: { name: string; revenue: number }[]
}

export type SalesData = {
  provider: SourceId
  source: 'api' | 'demo' | 'file'
  fileName?: string
  extras?: SalesExtras
  currency: string
  from: string
  to: string
  days: DayRow[]
  products: ProductRow[]
  totals: { revenue: number; orders: number; units: number; cancelled: number; returned: number }
  notes: string[]
}

export type Credentials = Record<string, string>

export function providerOf(id: ProviderId) {
  return PROVIDERS.find((p) => p.id === id)!
}

export function sourceName(d: Pick<SalesData, 'provider' | 'fileName'>) {
  return d.provider === 'file' ? d.fileName || 'Ваша таблица' : providerOf(d.provider).name
}

export function validateFetch(raw: unknown):
  | { ok: true; provider: ProviderId; credentials: Credentials; days: PeriodDays }
  | { ok: false; errors: Record<string, string> } {
  const r = (raw ?? {}) as Record<string, unknown>
  const errors: Record<string, string> = {}
  const p = PROVIDERS.find((x) => x.id === r.provider)
  if (!p) return { ok: false, errors: { provider: 'Неизвестный маркетплейс' } }
  const days = PERIODS.find((d) => d === Number(r.days)) ?? null
  if (!days) errors.days = 'Выберите период'
  const creds = (r.credentials ?? {}) as Record<string, unknown>
  const credentials: Credentials = {}
  for (const f of p.fields) {
    const v = typeof creds[f.key] === 'string' ? (creds[f.key] as string).trim() : ''
    if (!v) errors[f.key] = 'Обязательное поле'
    else if (v.length > 2000 || /\s/.test(v)) errors[f.key] = 'Похоже, значение скопировано с ошибкой'
    else credentials[f.key] = v
  }
  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, provider: p.id, credentials, days: days! }
}

/* ---------- analysis (pure, deterministic) ---------- */

export type Finding = { level: 'bad' | 'warn' | 'good'; title: string; detail: string }

export type Analysis = {
  margin: { cost: number; pct: number; low: (ProductRow & { pct: number })[] } | null
  peakHours: [number, number] | null
  avgCheck: number
  cancelRate: number
  returnRate: number
  trendPct: number
  abc: { a: ProductRow[]; b: ProductRow[]; c: ProductRow[] }
  topShare: number
  bestWeekday: string | null
  findings: Finding[]
}

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']

export function analyse(d: SalesData): Analysis {
  const t = d.totals
  const avgCheck = t.orders ? t.revenue / t.orders : 0
  const cancelRate = t.orders + t.cancelled ? t.cancelled / (t.orders + t.cancelled) : 0
  const returnRate = t.units ? t.returned / t.units : 0

  const half = Math.floor(d.days.length / 2)
  const first = d.days.slice(0, half).reduce((a, x) => a + x.revenue, 0)
  const second = d.days.slice(half).reduce((a, x) => a + x.revenue, 0)
  const trendPct = first > 0 ? ((second - first) / first) * 100 : 0

  const sorted = [...d.products].sort((a, b) => b.revenue - a.revenue)
  const total = sorted.reduce((a, x) => a + x.revenue, 0) || 1
  const abc = { a: [] as ProductRow[], b: [] as ProductRow[], c: [] as ProductRow[] }
  let acc = 0
  for (const p of sorted) {
    acc += p.revenue
    const share = acc / total
    if (share <= 0.8 || abc.a.length === 0) abc.a.push(p)
    else if (share <= 0.95) abc.b.push(p)
    else abc.c.push(p)
  }
  const topShare = sorted.length ? sorted.slice(0, 3).reduce((a, x) => a + x.revenue, 0) / total : 0

  const byWd = new Array(7).fill(0)
  const cntWd = new Array(7).fill(0)
  d.days.forEach((x) => {
    const wd = new Date(`${x.date}T00:00:00`).getDay()
    byWd[wd] += x.revenue
    cntWd[wd] += 1
  })
  const avgWd = byWd.map((v, i) => (cntWd[i] ? v / cntWd[i] : 0))
  const best = avgWd.indexOf(Math.max(...avgWd))
  const bestWeekday = d.days.length >= 7 ? WEEKDAYS[best] : null

  const findings: Finding[] = []
  if (cancelRate > 0.08)
    findings.push({
      level: 'bad',
      title: `Высокая доля отмен — ${(cancelRate * 100).toFixed(1)}%`,
      detail: 'Проверьте наличие на складе, сроки сборки и актуальность цен в карточках.',
    })
  if (returnRate > 0.05)
    findings.push({
      level: 'warn',
      title: `Возвраты — ${(returnRate * 100).toFixed(1)}% проданных единиц`,
      detail: 'Разберите причины возвратов по товарам: описание, размерная сетка, качество, упаковка.',
    })
  const worst = [...d.products].filter((p) => p.units + p.cancels >= 5).sort((a, b) => b.cancels / (b.units + b.cancels) - a.cancels / (a.units + a.cancels))[0]
  if (worst && worst.cancels / (worst.units + worst.cancels) > 0.15)
    findings.push({
      level: 'bad',
      title: `«${worst.name}» — отменяется чаще остальных`,
      detail: `${worst.cancels} отмен на ${worst.units} продаж. Вероятно, товар заканчивается или срок отгрузки слишком долгий.`,
    })
  if (topShare > 0.6 && sorted.length >= 5)
    findings.push({
      level: 'warn',
      title: `Три товара дают ${(topShare * 100).toFixed(0)}% выручки`,
      detail: 'Высокая зависимость от нескольких позиций: проблема с одной из них сильно ударит по продажам.',
    })
  if (abc.c.length >= 3)
    findings.push({
      level: 'warn',
      title: `${abc.c.length} товаров группы C — меньше 5% выручки`,
      detail: 'Кандидаты на распродажу, объединение в комплекты или вывод из ассортимента — они занимают склад и бюджет.',
    })
  if (trendPct < -10)
    findings.push({
      level: 'bad',
      title: `Выручка падает: ${trendPct.toFixed(0)}% во второй половине периода`,
      detail: 'Сравните цены с конкурентами и позиции товаров в поиске маркетплейса.',
    })
  else if (trendPct > 10)
    findings.push({
      level: 'good',
      title: `Рост выручки: +${trendPct.toFixed(0)}% во второй половине периода`,
      detail: 'Проверьте остатки лидеров продаж, чтобы рост не остановился из-за нехватки товара.',
    })
  if (bestWeekday)
    findings.push({
      level: 'good',
      title: `Самый сильный день — ${bestWeekday}`,
      detail: 'Запускайте акции и пополняйте остатки так, чтобы товар был в наличии к этому дню.',
    })
  // gross margin, when cost is known
  let margin: Analysis['margin'] = null
  if (d.extras?.hasCost) {
    const cost = d.products.reduce((s, p) => s + (p.cost ?? 0), 0)
    const pct = t.revenue > 0 ? ((t.revenue - cost) / t.revenue) * 100 : 0
    const low = d.products
      .filter((p) => p.cost !== undefined && p.revenue > 0)
      .map((p) => ({ ...p, pct: ((p.revenue - (p.cost ?? 0)) / p.revenue) * 100 }))
      .filter((p) => p.pct < 15)
      .sort((x, y) => x.pct - y.pct)
    margin = { cost, pct, low }
    const negative = low.filter((p) => p.pct < 0)
    if (negative.length)
      findings.unshift({
        level: 'bad',
        title: `${negative.length} ${plural(negative.length, 'товар продаётся', 'товара продаются', 'товаров продаются')} в минус`,
        detail: `Например, «${negative[0].name}»: маржа ${negative[0].pct.toFixed(0)}%. Поднимите цену или найдите поставщика дешевле.`,
      })
    else if (low.length)
      findings.unshift({
        level: 'warn',
        title: `Низкая маржа у ${low.length} ${plural(low.length, 'товара', 'товаров', 'товаров')}`,
        detail: `«${low[0].name}» — ${low[0].pct.toFixed(0)}% маржи. Проверьте цену и закупку.`,
      })
  }

  const c = d.extras?.customers
  if (c && c.total >= 10) {
    const share = c.repeat / c.total
    findings.push({
      level: share < 0.15 ? 'warn' : 'good',
      title: `Повторно покупают ${(share * 100).toFixed(0)}% клиентов`,
      detail:
        share < 0.15
          ? 'Мало возвратов клиентов: напоминайте о себе после покупки и давайте повод вернуться.'
          : `Постоянные клиенты дают ${((c.repeatRevenue / (t.revenue || 1)) * 100).toFixed(0)}% выручки — берегите их.`,
    })
  }

  let peakHours: Analysis['peakHours'] = null
  const h = d.extras?.hours
  if (h && h.some((v) => v > 0)) {
    let best = 0
    for (let i = 0; i < 24; i++) if (h[i] + h[(i + 1) % 24] > h[best] + h[(best + 1) % 24]) best = i
    peakHours = [best, (best + 2) % 24]
    findings.push({
      level: 'good',
      title: `Пик продаж — ${best}:00–${(best + 2) % 24}:00`,
      detail: 'В эти часы нужно больше людей на кассе и ответах клиентам.',
    })
  }

  return { margin, peakHours, avgCheck, cancelRate, returnRate, trendPct, abc, topShare, bestWeekday, findings }
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

/** Compact, personal-data-free summary for the AI prompt. */
export function summaryForAi(d: SalesData, a: Analysis) {
  const top = [...d.products].sort((x, y) => y.revenue - x.revenue).slice(0, 10)
  return {
    source: sourceName(d),
    currency: d.currency,
    period: `${d.from} — ${d.to}`,
    totals: d.totals,
    avgCheck: Math.round(a.avgCheck),
    cancelRatePct: +(a.cancelRate * 100).toFixed(1),
    returnRatePct: +(a.returnRate * 100).toFixed(1),
    trendPct: +a.trendPct.toFixed(1),
    top3SharePct: +(a.topShare * 100).toFixed(0),
    abcCounts: { a: a.abc.a.length, b: a.abc.b.length, c: a.abc.c.length },
    marginPct: a.margin ? +a.margin.pct.toFixed(1) : undefined,
    repeatCustomersPct: d.extras?.customers?.total ? +((d.extras.customers.repeat / d.extras.customers.total) * 100).toFixed(0) : undefined,
    peakHours: a.peakHours ? `${a.peakHours[0]}:00–${a.peakHours[1]}:00` : undefined,
    categories: d.extras?.categories?.slice(0, 8).map((c) => ({ name: c.name.slice(0, 60), revenue: Math.round(c.revenue) })),
    topProducts: top.map((p) => ({
      name: p.name.slice(0, 80),
      revenue: Math.round(p.revenue),
      units: p.units,
      returns: p.returns,
      cancels: p.cancels,
      marginPct: p.cost !== undefined && p.revenue > 0 ? +(((p.revenue - p.cost) / p.revenue) * 100).toFixed(0) : undefined,
    })),
    daily: d.days.map((x) => ({ date: x.date, revenue: Math.round(x.revenue), orders: x.orders })),
  }
}

export type FunnelSummary = {
  stages: { name: string; count: number }[]
  avgCheck?: number
  currency: string
}

export function insightsPrompt(kind: 'sales' | 'funnel', summary: unknown) {
  if (kind === 'funnel')
    return `Ты аналитик воронки продаж для малого бизнеса в Казахстане.
По данным воронки (этапы и число людей на каждом) дай 5 конкретных шагов, как поднять конверсию самого слабого перехода и выручку.
Опирайся только на цифры, не выдумывай данные. По-русски, коротко, без общих фраз, без обещаний гарантированного результата.

Воронка (JSON): ${JSON.stringify(summary)}`
  return `Ты аналитик продаж малого бизнеса в Казахстане (магазины, кафе, маркетплейсы Kaspi, Wildberries, Ozon).
По сводке продаж дай 5 конкретных рекомендаций: что сделать продавцу на этой неделе, чтобы увеличить выручку и снизить потери.
Опирайся только на цифры из сводки, не выдумывай данные. Пиши по-русски, коротко, без общих фраз. Не обещай гарантированный результат.

Сводка (JSON): ${JSON.stringify(summary)}`
}

export function analyseFunnel(stages: { name: string; count: number }[], avgCheck: number) {
  const steps = stages.slice(1).map((st, i) => {
    const prev = stages[i].count
    return { from: stages[i].name, to: st.name, conv: prev > 0 ? st.count / prev : 0, lost: Math.max(0, prev - st.count) }
  })
  const overall = stages[0]?.count ? stages[stages.length - 1].count / stages[0].count : 0
  let worst = 0
  steps.forEach((s, i) => {
    if (s.conv < steps[worst].conv) worst = i
  })
  return { steps, overall, worst, lostRevenue: stages.length ? (stages[0].count - stages[stages.length - 1].count) * avgCheck : 0 }
}

/** Extra customers at the end of the funnel if one step's conversion grows by `pp` percentage points. */
export function funnelWhatIf(stages: { count: number }[], step: number, pp: number) {
  if (stages.length < 2) return 0
  let count = stages[0].count
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1].count
    let conv = prev > 0 ? stages[i].count / prev : 0
    if (i - 1 === step) conv = Math.min(1, conv + pp / 100)
    count = count * conv
  }
  return Math.max(0, count - stages[stages.length - 1].count)
}

export const INSIGHTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    recommendations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          detail: { type: 'STRING' },
          priority: { type: 'STRING', enum: ['high', 'medium', 'low'] },
        },
        required: ['title', 'detail', 'priority'],
      },
    },
  },
  required: ['recommendations'],
}

export type Recommendation = { title: string; detail: string; priority: 'high' | 'medium' | 'low' }
