// Server-only Gemini helper. The key comes from GEMINI_API_KEY and never leaves the server.

// Main model: Gemini 3.8 Flash (free tier: 5 req/min, 20 req/day).
// Under load or past its quota it answers 503/429, so we fall back to the lite models and retry once.
const DEFAULT_MODEL = 'gemini-3.8-flash'
const FALLBACKS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'] // lite: 500 req/day on the free tier
const MODEL = () => process.env.GEMINI_MODEL || DEFAULT_MODEL
const ATTEMPT_MS = 20_000
const TOTAL_MS = 55_000 // Vercel function limit is 60 s (vercel.json)

export class GeminiError extends Error {
  code: 'not_configured' | 'ai_quota' | 'ai_busy' | 'ai_failed' | 'ai_timeout'
  constructor(code: GeminiError['code']) {
    super(code)
    this.code = code
  }
}

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY)
}

export function geminiModel() {
  return MODEL()
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Calls Gemini with a JSON response schema and returns the parsed JSON. */
export async function generateJson(prompt: string, schema: unknown): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new GeminiError('not_configured')

  const deadline = Date.now() + TOTAL_MS
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json', responseSchema: schema },
  })
  const models = [...new Set([MODEL(), ...FALLBACKS])]
  const statuses: number[] = []

  for (let round = 0; round < 2; round++) {
    for (const model of models) {
      const left = deadline - Date.now()
      if (left < 3_000) break
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), Math.min(ATTEMPT_MS, left))
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body,
        })
        if (!res.ok) {
          statuses.push(res.status)
          const detail = await res.text().catch(() => '')
          console.error('Gemini error', model, res.status, detail.slice(0, 200))
          // retired model, overload or per-model quota → next model
          if (res.status === 404 || res.status === 429 || res.status >= 500) continue
          throw new GeminiError('ai_failed')
        }
        const data = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]
        }
        const text = (data.candidates?.[0]?.content?.parts ?? [])
          .filter((p) => !p.thought)
          .map((p) => p.text ?? '')
          .join('')
          .trim()
          .replace(/^```(?:json)?\s*|\s*```$/g, '')
        try {
          return JSON.parse(text)
        } catch {
          console.error('Gemini returned non-JSON', model, text.slice(0, 200))
          statuses.push(0)
        }
      } catch (err) {
        if (err instanceof GeminiError) throw err
        statuses.push(err instanceof Error && err.name === 'AbortError' ? -1 : 0)
        console.error('Gemini call failed', model, err instanceof Error ? err.message : err)
      } finally {
        clearTimeout(timer)
      }
    }
    if (Date.now() + 5_000 > deadline) break
    await sleep(1_500)
  }

  if (statuses.length && statuses.every((s) => s === 429)) throw new GeminiError('ai_quota')
  if (statuses.some((s) => s === 503 || s === 500)) throw new GeminiError('ai_busy')
  if (statuses.some((s) => s === -1)) throw new GeminiError('ai_timeout')
  throw new GeminiError('ai_failed')
}

/** Naive per-instance limiter; good enough to stop accidental hammering of a free key. */
export function makeRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>()
  return (key: string) => {
    const now = Date.now()
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
    list.push(now)
    hits.set(key, list)
    return list.length > max
  }
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

export const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim()
