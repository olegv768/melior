// Server-only AI helper (Groq, OpenAI-compatible API). The key comes from GROQ_API_KEY and never leaves the server.

const MODEL = () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
const FALLBACK_MODEL = 'openai/gpt-oss-20b'
const ATTEMPT_MS = 25_000
const TOTAL_MS = 55_000 // Vercel function limit is 60 s (vercel.json)

export class AiError extends Error {
  code: 'not_configured' | 'ai_key' | 'ai_quota' | 'ai_busy' | 'ai_failed' | 'ai_timeout'
  /** short, secret-free diagnostic shown to the user, e.g. "openai/gpt-oss-120b: 400 json_validate_failed" */
  info?: string
  constructor(code: AiError['code'], info?: string) {
    super(code)
    this.code = code
    this.info = info
  }
}

// pasted values often carry quotes, spaces or extra words («gsk_… грок»), which make the Authorization header invalid:
// take the first token that looks like a key
const groqKey = () => {
  const raw = (process.env.GROQ_API_KEY ?? '').replace(/["']/g, ' ')
  return raw.match(/gsk_[A-Za-z0-9]+/)?.[0] ?? raw.trim().split(/\s+/)[0] ?? ''
}

export function aiConfigured() {
  return Boolean(groqKey())
}

export function aiModel() {
  return MODEL()
}

/** Returns parsed JSON that follows `schema`; tries the main model, then a smaller one. */
export async function generateJson(prompt: string, schema: unknown): Promise<unknown> {
  const key = groqKey()
  if (!key) throw new AiError('not_configured')
  const deadline = Date.now() + TOTAL_MS
  const statuses: number[] = []
  const notes: string[] = []

  // main model twice (JSON mode occasionally fails validation), then the smaller one
  for (const model of [MODEL(), MODEL(), FALLBACK_MODEL]) {
    const left = deadline - Date.now()
    if (left < 3_000) break
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.min(ATTEMPT_MS, left))
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          response_format: { type: 'json_object' },
          messages: [
            // JSON mode needs the expected shape spelled out in the prompt
            { role: 'system', content: `Отвечай только валидным JSON строго по этой схеме (типы как в OpenAPI): ${JSON.stringify(schema)}` },
            { role: 'user', content: prompt },
          ],
        }),
      })
      if (!res.ok) {
        statuses.push(res.status)
        const body = (await res.text().catch(() => '')).slice(0, 300)
        console.error('Groq error', model, res.status, body)
        const code = body.match(/"code"\s*:\s*"([^"]+)"/)?.[1] ?? body.match(/"message"\s*:\s*"([^"]{0,80})/)?.[1] ?? ''
        notes.push(`${model}: ${res.status} ${code}`.trim())
        if (res.status === 401 || res.status === 403) throw new AiError('ai_key', notes.join('; '))
        // 400 = json_validate_failed / bad model name, 429 = limit, 5xx = overload → try again / next model
        continue
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
      const text = (data.choices?.[0]?.message?.content ?? '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
      try {
        return JSON.parse(text)
      } catch {
        statuses.push(0)
        notes.push(`${model}: ответ не JSON`)
        console.error('Groq returned non-JSON', model, text.slice(0, 200))
      }
    } catch (err) {
      if (err instanceof AiError) throw err
      statuses.push(err instanceof Error && err.name === 'AbortError' ? -1 : 0)
      notes.push(`${model}: ${err instanceof Error ? err.name + ' ' + err.message.slice(0, 60) : 'network'}`)
      console.error('Groq call failed', model, err instanceof Error ? err.message : err)
    } finally {
      clearTimeout(timer)
    }
  }

  const info = notes.join('; ')
  if (statuses.length && statuses.every((s) => s === 429)) throw new AiError('ai_quota', info)
  if (statuses.some((s) => s >= 500)) throw new AiError('ai_busy', info)
  if (statuses.some((s) => s === -1)) throw new AiError('ai_timeout', info)
  throw new AiError('ai_failed', info)
}

/** Tiny live request to check the key from the deployed site (GET /api/audit?check=1). */
export async function aiCheck(): Promise<{ ok: boolean; status: number; error?: string }> {
  const key = groqKey()
  if (!key) return { ok: false, status: 0 }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { authorization: `Bearer ${key}` } })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, status: -1, error: err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 120) : 'network' }
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
