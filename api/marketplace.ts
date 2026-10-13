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
      const out = (await generateJson(insightsPrompt(kind, summary), INSIGHTS_SCHEMA)) as { recommendations?: unknown }
      const recs = (Array.isArray(out.recommendations) ? out.recommendations : [])
        .slice(0, 6)
        .map((r) => {
          const o = (r ?? {}) as Record<string, unknown>
          const priority = o.priority === 'high' || o.priority === 'low' ? o.priority : 'medium'
          const rec: Recommendation = {
            title: String(o.title ?? '').slice(0, 140),
            detail: String(o.detail ?? '').slice(0, 600),
            priority,
          }
          return rec
        })
        .filter((r) => r.title && r.detail)
      if (!recs.length) return json({ error: 'ai_failed' }, 502)
      return json({ recommendations: recs })
    } catch (err) {
      const code = err instanceof AiError ? err.code : 'ai_failed'
      return json({ error: code }, code === 'not_configured' ? 503 : 502)
    }
  }

  return json({ error: 'unknown_action' }, 400)
}
