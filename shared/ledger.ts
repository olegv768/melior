// Handwritten ledger («тетрадь») → rows. Shared by the browser and the Vercel function.

export type LedgerKind = 'in' | 'out'

export type LedgerRow = {
  date: string // as written, normalised to dd.mm or dd.mm.yyyy when possible
  item: string
  qty: number | null
  amount: number // always positive; the direction is in `kind`
  kind: LedgerKind
}

export const LEDGER_MAX_IMAGE_BYTES = 3_500_000 // base64 data URL, well under Groq's 4 MB image limit
export const LEDGER_MAX_PAGES = 6

/** Compact array output keeps the answer short (the free tier caps output tokens per minute). */
export const LEDGER_PROMPT = `Это фото страницы тетради учёта малого бизнеса в Казахстане (магазин, кафе, услуги). Записи от руки, по-русски или по-казахски.
Перепиши КАЖДУЮ запись с деньгами в JSON: {"rows":[["дата","что","кол-во","сумма","in|out"]]}.
Правила:
- дата как написана (12.10 или 12.10.2026); если дата написана один раз над группой строк — повтори её в каждой строке группы; нет даты — "";
- "что" — товар, услуга или статья расхода, коротко;
- кол-во — число или null;
- сумма — число без пробелов и знаков валюты, всегда положительное;
- "in" — приход/продажа/выручка, "out" — расход/закупка/аренда/зарплата/долг отдали; минус перед суммой или колонка «расход» = "out";
- казахские записи читай так же: «сатылды»/«түсім» — in, «шығын»/«сатып алдым»/«жалға»/«жалақы» — out; товар оставь как написано;
- строки «итого», «всего», «остаток», «барлығы», «жиыны», зачёркнутые — пропусти;
- не придумывай: неразборчивую цифру перепиши как видишь лучше всего.
Только JSON, без пояснений.`

const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const s = v.replace(/[\s ₸тг.]/gi, '').replace(',', '.')
  const n = Number(s)
  return s && Number.isFinite(n) ? n : null
}

/** Normalises whatever shape the model returned into rows; carries a missing date forward. */
export function rowsFromModel(json: unknown): LedgerRow[] {
  const o = (json ?? {}) as Record<string, unknown>
  const raw = Array.isArray(o.rows) ? o.rows : Array.isArray(json) ? (json as unknown[]) : []
  const out: LedgerRow[] = []
  let lastDate = ''
  for (const r of raw.slice(0, 400)) {
    let date: unknown, item: unknown, qty: unknown, amount: unknown, kind: unknown
    if (Array.isArray(r)) [date, item, qty, amount, kind] = r
    else if (r && typeof r === 'object') {
      const x = r as Record<string, unknown>
      ;({ date, item, qty, amount, kind } = x)
      amount ??= x.sum
      kind ??= x.type
    }
    const a = num(amount)
    if (a === null || a === 0) continue
    const name = String(item ?? '').trim().slice(0, 80)
    if (/^(итого|всего|остаток|барлығы|жиыны|қалдық)/i.test(name)) continue
    const d = String(date ?? '').trim().slice(0, 16)
    if (d) lastDate = d
    const k = String(kind ?? '').toLowerCase()
    out.push({
      date: d || lastDate,
      item: name || 'Без названия',
      qty: num(qty),
      amount: Math.abs(a),
      kind: k.startsWith('out') || k.includes('расх') || k.includes('шығ') || a < 0 ? 'out' : 'in',
    })
  }
  return out
}

/** "12.10" → "12.10.2026" (previous year if that date is still ahead). */
export function fullDate(d: string, today = new Date()): string {
  const m = d.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/)
  if (!m) return d
  const day = Number(m[1])
  const month = Number(m[2])
  if (day < 1 || day > 31 || month < 1 || month > 12) return d
  let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : today.getFullYear()
  if (!m[3] && new Date(year, month - 1, day) > today) year -= 1
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
}
