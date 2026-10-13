// Vercel Serverless Function: POST /api/audit
// The Groq key lives only in the server environment (GROQ_API_KEY) and is never sent to the browser.
import { RESPONSE_SCHEMA, buildPrompt, reportFromModel, validateInput } from '../shared/audit.js'
import { AiError, clientIp, aiConfigured, aiModel, generateJson, json, makeRateLimiter } from '../server/ai.js'

const rateLimited = makeRateLimiter(30, 10 * 60 * 1000)

export async function POST(request: Request): Promise<Response> {
  if (!aiConfigured()) return json({ error: 'not_configured' }, 503)
  if (rateLimited(clientIp(request))) return json({ error: 'rate_limited' }, 429)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'bad_json' }, 400)
  }
  const parsed = validateInput(body)
  if (!parsed.ok) return json({ error: 'invalid_input', fields: parsed.errors }, 422)

  try {
    const raw = await generateJson(buildPrompt(parsed.value), RESPONSE_SCHEMA)
    return json({ report: reportFromModel(raw, parsed.value) })
  } catch (err) {
    const code = err instanceof AiError ? err.code : 'ai_failed'
    if (!(err instanceof AiError)) console.error('Audit failed', err)
    return json({ error: code }, code === 'not_configured' ? 503 : 502)
  }
}

export function GET(): Response {
  return json({ ok: true, configured: aiConfigured(), model: aiModel() })
}
