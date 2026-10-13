// Vercel Serverless Function: POST /api/audit
// The Gemini key lives only in the server environment (GEMINI_API_KEY) and is never sent to the browser.
import { GEMINI_RESPONSE_SCHEMA, buildPrompt, reportFromModel, validateInput } from '../shared/audit.js'


const MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 8
const hits = new Map<string, number[]>()

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

function rateLimited(ip: string) {
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  list.push(now)
  hits.set(ip, list)
  return list.length > MAX_PER_WINDOW
}

export async function POST(request: Request): Promise<Response> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return json({ error: 'not_configured' }, 503)

  const ip = (request.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim()
  if (rateLimited(ip)) return json({ error: 'rate_limited' }, 429)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'bad_json' }, 400)
  }
  const parsed = validateInput(body)
  if (!parsed.ok) return json({ error: 'invalid_input', fields: parsed.errors }, 422)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL())}:generateContent`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildPrompt(parsed.value) }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: 'application/json',
            responseSchema: GEMINI_RESPONSE_SCHEMA,
          },
        }),
      },
    )
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('Gemini error', res.status, detail.slice(0, 500))
      return json({ error: res.status === 429 ? 'ai_quota' : 'ai_failed' }, 502)
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    const report = reportFromModel(JSON.parse(text), parsed.value)
    return json({ report })
  } catch (err) {
    console.error('Audit failed', err)
    const aborted = err instanceof Error && err.name === 'AbortError'
    return json({ error: aborted ? 'ai_timeout' : 'ai_failed' }, 502)
  } finally {
    clearTimeout(timer)
  }
}

export function GET(): Response {
  return json({ ok: true, configured: Boolean(process.env.GEMINI_API_KEY), model: MODEL() })
}
