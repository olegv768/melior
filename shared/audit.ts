// Shared between the browser (src/) and the Vercel function (api/).
// Keep this file free of browser- and Node-specific APIs.

export const BUSINESS_TYPES = [
  { id: 'cafe', label: 'Кафе / ресторан' },
  { id: 'shop', label: 'Магазин' },
  { id: 'salon', label: 'Салон красоты' },
  { id: 'company', label: 'Сервисная компания' },
  { id: 'online', label: 'Онлайн-бизнес' },
] as const

export const TURNOVERS = [
  { id: 't1', label: 'до 3 млн ₸', mid: 2_000_000 },
  { id: 't2', label: '3–10 млн ₸', mid: 6_000_000 },
  { id: 't3', label: '10–30 млн ₸', mid: 18_000_000 },
  { id: 't4', label: '30–100 млн ₸', mid: 55_000_000 },
  { id: 't5', label: 'более 100 млн ₸', mid: 130_000_000 },
] as const

export const PROBLEMS = [
  { id: 'costs', label: 'Высокие расходы' },
  { id: 'sales', label: 'Продажи стоят или падают' },
  { id: 'routine', label: 'Много ручной работы' },
  { id: 'stock', label: 'Остатки и списания' },
  { id: 'staff', label: 'Неравномерная загрузка персонала' },
  { id: 'visibility', label: 'Нет прозрачности в цифрах' },
] as const

export type BusinessType = (typeof BUSINESS_TYPES)[number]['id']
export type Turnover = (typeof TURNOVERS)[number]['id']
export type Problem = (typeof PROBLEMS)[number]['id']

export type AuditInput = {
  businessType: BusinessType
  turnover: Turnover
  problem: Problem
  employees: number
  details?: string
}

export type Severity = 'high' | 'medium' | 'low'

export type AuditItem = { title: string; detail: string; severity?: Severity }

export type AuditReport = {
  mode: 'ai' | 'demo'
  summary: string
  savings: { low: number; high: number; note: string }
  problems: AuditItem[]
  processes: AuditItem[]
  costs: AuditItem[]
  automations: AuditItem[]
  plan: { week: number; title: string; tasks: string[] }[]
}

export const DETAILS_MAX = 600

export function validateInput(raw: unknown): { ok: true; value: AuditInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const r = (raw ?? {}) as Record<string, unknown>

  const businessType = BUSINESS_TYPES.find((b) => b.id === r.businessType)?.id
  if (!businessType) errors.businessType = 'Выберите тип бизнеса'

  const turnover = TURNOVERS.find((t) => t.id === r.turnover)?.id
  if (!turnover) errors.turnover = 'Укажите примерный оборот'

  const problem = PROBLEMS.find((p) => p.id === r.problem)?.id
  if (!problem) errors.problem = 'Выберите главную проблему'

  const employees = typeof r.employees === 'number' ? r.employees : Number(r.employees)
  if (!Number.isFinite(employees) || !Number.isInteger(employees)) errors.employees = 'Введите целое число'
  else if (employees < 1) errors.employees = 'Минимум 1 сотрудник — вы сами'
  else if (employees > 5000) errors.employees = 'Сервис рассчитан на бизнес до 5 000 сотрудников'

  let details: string | undefined
  if (r.details !== undefined && r.details !== null && r.details !== '') {
    if (typeof r.details !== 'string') errors.details = 'Описание должно быть текстом'
    else if (r.details.length > DETAILS_MAX) errors.details = `Не больше ${DETAILS_MAX} символов`
    else details = r.details.trim() || undefined
  }

  if (Object.keys(errors).length) return { ok: false, errors }
  return {
    ok: true,
    value: { businessType: businessType!, turnover: turnover!, problem: problem!, employees, details },
  }
}

export const labelOf = {
  business: (id: BusinessType) => BUSINESS_TYPES.find((b) => b.id === id)!.label,
  turnover: (id: Turnover) => TURNOVERS.find((t) => t.id === id)!.label,
  problem: (id: Problem) => PROBLEMS.find((p) => p.id === id)!.label,
}

/** Rough, clearly-labelled guide range: 2–5% of monthly turnover. */
export function savingsRange(turnover: Turnover) {
  const mid = TURNOVERS.find((t) => t.id === turnover)!.mid
  const round = (n: number) => Math.round(n / 10_000) * 10_000
  return { low: round(mid * 0.02), high: round(mid * 0.05) }
}

export function buildPrompt(input: AuditInput) {
  const s = savingsRange(input.turnover)
  return `Ты — операционный аналитик для малого и среднего бизнеса в Казахстане (город Тараз и Жамбылская область).
Сделай первичный аудит бизнеса по анкете. Пиши по-русски, конкретно и практично, без маркетинговых фраз и без обещаний гарантированного результата.
Не выдумывай факты о бизнесе: если вывод — предположение, формулируй как «вероятно», «стоит проверить».
Учитывай местный контекст: оплаты через Kaspi, общение с клиентами в WhatsApp и Instagram, учёт в тетради или Excel.

Анкета:
- Тип бизнеса: ${labelOf.business(input.businessType)}
- Оборот в месяц: ${labelOf.turnover(input.turnover)}
- Главная проблема: ${labelOf.problem(input.problem)}
- Сотрудников: ${input.employees}
- Описание от владельца: ${input.details ? `"""${input.details}"""` : 'нет'}

Требования к ответу (JSON по схеме):
- summary: 2–3 предложения, главный вывод.
- problems: 3–4 вероятных проблемных места, severity: high | medium | low.
- processes: 3 процесса, которые стоит оптимизировать, и как именно.
- costs: 3 направления сокращения расходов.
- automations: 3 автоматизации с конкретными доступными инструментами.
- plan: ровно 4 недели, в каждой 3 конкретные задачи.
- savingsNote: одно предложение о том, от чего зависит экономия. Ориентир экономии для этого оборота: ${s.low}–${s.high} ₸ в месяц, это не обещание.`
}

const itemSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    detail: { type: 'STRING' },
    severity: { type: 'STRING', enum: ['high', 'medium', 'low'] },
  },
  required: ['title', 'detail'],
}

export const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    savingsNote: { type: 'STRING' },
    problems: { type: 'ARRAY', items: itemSchema },
    processes: { type: 'ARRAY', items: itemSchema },
    costs: { type: 'ARRAY', items: itemSchema },
    automations: { type: 'ARRAY', items: itemSchema },
    plan: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          week: { type: 'INTEGER' },
          title: { type: 'STRING' },
          tasks: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['week', 'title', 'tasks'],
      },
    },
  },
  required: ['summary', 'savingsNote', 'problems', 'processes', 'costs', 'automations', 'plan'],
}

const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function items(v: unknown, max: number): AuditItem[] {
  if (!Array.isArray(v)) return []
  return v
    .slice(0, max)
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>
      const sev: Severity | undefined =
        o.severity === 'high' || o.severity === 'medium' || o.severity === 'low' ? o.severity : undefined
      const item: AuditItem = { title: str(o.title, 120), detail: str(o.detail, 500), severity: sev }
      return item
    })
    .filter((x) => x.title && x.detail)
}

/** Normalises model output; throws if it is unusable. */
export function reportFromModel(json: unknown, input: AuditInput): AuditReport {
  const o = (json ?? {}) as Record<string, unknown>
  const planRaw = Array.isArray(o.plan) ? o.plan.slice(0, 4) : []
  const plan = planRaw
    .map((p, i) => {
      const r = (p ?? {}) as Record<string, unknown>
      const tasks = Array.isArray(r.tasks) ? r.tasks.map((t) => str(t, 200)).filter(Boolean).slice(0, 4) : []
      return { week: i + 1, title: str(r.title, 100), tasks }
    })
    .filter((p) => p.title && p.tasks.length)
  const report: AuditReport = {
    mode: 'ai',
    summary: str(o.summary, 700),
    savings: { ...savingsRange(input.turnover), note: str(o.savingsNote, 300) },
    problems: items(o.problems, 4),
    processes: items(o.processes, 4),
    costs: items(o.costs, 4),
    automations: items(o.automations, 4),
    plan,
  }
  if (!report.summary || !report.problems.length || !report.plan.length) {
    throw new Error('Incomplete model response')
  }
  return report
}
