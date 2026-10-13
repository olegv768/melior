// Server-only Gemini helper. The key comes from GEMINI_API_KEY and never leaves the server.

const MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const FALLBACK_MODEL = 'gemini-flash-latest'

export class GeminiError extends Error {
  code: 'not_configured' | 'ai_quota' | 'ai_failed' | 'ai_timeout'
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

/** Calls Gemini with a JSON response schema and returns the parsed JSON. */
export async function generateJson(prompt: string, schema: unknown, timeoutMs = 45_000): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new GeminiError('not_configured')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json', responseSchema: schema },
  })
  const call = (model: string) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body,
    })

  try {
    let res = await call(MODEL())
    // model name retired or unavailable for this key → fall back to the rolling alias
    if (res.status === 404 && MODEL() !== FALLBACK_MODEL) res = await call(FALLBACK_MODEL)
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('Gemini error', res.status, detail.slice(0, 500))
      throw new GeminiError(res.status === 429 ? 'ai_quota' : 'ai_failed')
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    return JSON.parse(text)
  } catch (err) {
    if (err instanceof GeminiError) throw err
    if (err instanceof Error && err.name === 'AbortError') throw new GeminiError('ai_timeout')
    console.error('Gemini call failed', err)
    throw new GeminiError('ai_failed')
  } finally {
    clearTimeout(timer)
  }
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
