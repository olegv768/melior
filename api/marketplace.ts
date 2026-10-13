// Vercel Serverless Function: POST /api/marketplace
//   { action: 'fetch', provider, credentials, days }  → normalised sales data from Kaspi / Wildberries / Ozon
//   { action: 'insights', summary }                    → AI recommendations (Groq) for an aggregated summary
import { INSIGHTS_SCHEMA, insightsPrompt, validateFetch } from '../shared/marketplace.js'
import type { Recommendation } from '../shared/marketplace.js'
import { fetchSales, MarketplaceError } from '../server/marketplaces.js'
import { AiError, clientIp, generateJson, json, makeRateLimiter } from '../server/ai.js'

const limitFetch = makeRateLimiter(6, 10 * 60 * 1000)
const limitAi = makeRateLimiter(30, 10 * 60 * 1000)

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'bad_json' }, 400)
  }
  const ip = clientIp(request)

  if (body.action === 'fetch') {
    const parsed = validateFetch(body)
    if (!parsed.ok) return json({ error: 'invalid_input', fields: parsed.errors }, 422)
    if (limitFetch(ip)) return json({ error: 'rate_limited' }, 429)
    try {
      const data = await fetchSales(parsed.provider, parsed.credentials, parsed.days)
      return json({ data })
    } catch (err) {
      const code = err instanceof MarketplaceError ? err.code : 'upstream'
      return json({ error: code }, code === 'auth' ? 401 : 502)
    }
  }

  if (body.action === 'insights') {
    const summary = body.summary
    if (!summary || typeof summary !== 'object' || JSON.stringify(summary).length > 20_000) {
      return json({ error: 'invalid_input' }, 422)
    }
    if (limitAi(ip)) return json({ error: 'ai_rate_limited' }, 429)
    try {
      const kind = body.kind === 'funnel' ? 'funnel' : 'sales'
      const out = await generateJson(insightsPrompt(kind, summary), INSIGHTS_SCHEMA)
      const recs = findArray(out)
        .slice(0, 6)
        .map((r) => {
          const o = (r ?? {}) as Record<string, unknown>
          const priority = o.priority === 'high' || o.priority === 'low' ? o.priority : 'medium'
          const rec: Recommendation = {
            title: String(o.title ?? o.name ?? o.заголовок ?? '').slice(0, 140),
            detail: String(o.detail ?? o.description ?? o.text ?? o.описание ?? '').slice(0, 600),
            priority,
          }
          return rec
        })
        .filter((r) => r.title && r.detail)
      if (!recs.length) {
        console.error('AI insights: no recommendations in', JSON.stringify(out).slice(0, 300))
        return json({ error: 'ai_failed', info: `нет рекомендаций в ответе: ${JSON.stringify(out).slice(0, 100)}` }, 502)
      }
      return json({ recommendations: recs })
    } catch (err) {
      const code = err instanceof AiError ? err.code : 'ai_failed'
      const info = err instanceof AiError ? err.info : err instanceof Error ? err.message.slice(0, 120) : undefined
      if (!(err instanceof AiError)) console.error('Insights failed', err)
      return json({ error: code, info }, code === 'not_configured' ? 503 : 502)
    }
  }

  return json({ error: 'unknown_action' }, 400)
}

/** Models sometimes wrap the list differently: {recommendations:[…]}, {рекомендации:[…]}, a bare array… */
function findArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (Array.isArray(o.recommendations)) return o.recommendations
    for (const x of Object.values(o)) {
      const found = findArray(x)
      if (found.length && typeof found[0] === 'object') return found
    }
  }
  return []
}
