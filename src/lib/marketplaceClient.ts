import type { Credentials, PeriodDays, ProviderId, Recommendation, SalesData } from '../../shared/marketplace'

export type MpErrorCode =
  | 'auth'
  | 'forbidden_region'
  | 'rate_limited'
  | 'upstream'
  | 'timeout'
  | 'network'
  | 'no_server'
  | 'invalid_input'
  | 'not_configured'
  | 'ai_quota'
  | 'ai_busy'
  | 'ai_key'
  | 'ai_rate_limited'
  | 'ai_failed'
  | 'ai_timeout'

export class MpError extends Error {
  code: MpErrorCode
  fields?: Record<string, string>
  info?: string
  constructor(code: MpErrorCode, fields?: Record<string, string>, info?: string) {
    super(code)
    this.code = code
    this.fields = fields
    this.info = info
  }
}

export const MP_ERROR_TEXT: Record<MpErrorCode, string> = {
  auth: 'Маркетплейс отклонил ключ. Проверьте, что он скопирован целиком и у него есть доступ к статистике или заказам.',
  forbidden_region:
    'Маркетплейс отказал в доступе (403). Kaspi может ограничивать запросы с зарубежных серверов — в этом случае функцию нужно разместить на сервере в Казахстане.',
  rate_limited: 'Слишком частые запросы. У Wildberries лимит статистики — около одного запроса в минуту. Подождите и повторите.',
  upstream: 'Маркетплейс вернул ошибку. Попробуйте позже или выберите меньший период.',
  timeout: 'Маркетплейс отвечал слишком долго. Попробуйте период 7 дней.',
  network: 'Нет соединения с сервером. Проверьте интернет.',
  no_server: 'Подключение API работает только на развёрнутом сайте (Vercel) или при запуске npm run dev.',
  invalid_input: 'Проверьте заполненные поля.',
  not_configured: 'ИИ не подключён — выводы по правилам смотрите выше.',
  ai_quota: 'Исчерпан лимит бесплатных запросов к ИИ. Попробуйте позже.',
  ai_busy: 'ИИ сейчас перегружен. Попробуйте через минуту.',
  ai_key: 'Ключ ИИ на сервере неверный. Проверьте GROQ_API_KEY в настройках Vercel.',
  ai_rate_limited: 'Слишком много запросов к ИИ подряд. Подождите пару минут.',
  ai_failed: 'ИИ не смог подготовить рекомендации. Попробуйте ещё раз.',
  ai_timeout: 'ИИ отвечал слишком долго. Попробуйте ещё раз.',
}

async function post(body: unknown, signal?: AbortSignal) {
  let res: Response
  try {
    res = await fetch('/api/marketplace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new MpError('network')
  }
  if (res.status === 404 || res.status === 405) throw new MpError('no_server')
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok) {
    const code = (data?.error as MpErrorCode) ?? 'upstream'
    const info = typeof data?.info === 'string' ? data.info : !data ? `HTTP ${res.status}` : undefined
    throw new MpError(code in MP_ERROR_TEXT ? code : 'upstream', data?.fields as Record<string, string> | undefined, info)
  }
  return data ?? {}
}

export async function fetchMarketplace(provider: ProviderId, credentials: Credentials, days: PeriodDays, signal?: AbortSignal) {
  const data = await post({ action: 'fetch', provider, credentials, days }, signal)
  return data.data as SalesData
}

export async function fetchInsights(summary: unknown, kind: 'sales' | 'funnel' = 'sales', signal?: AbortSignal) {
  const data = await post({ action: 'insights', kind, summary }, signal)
  return data.recommendations as Recommendation[]
}
