// Vercel Serverless Function: POST /api/audit
// Combined endpoint:
// 1) Handwritten ledger recognition: { image: "data:image/..." } → { rows }
// 2) SME express audit & 30-day plan: { businessType, turnover, problem, employees, details } → { report }
// The Groq key lives only in the server environment (GROQ_API_KEY) and is never sent to the browser.
import { RESPONSE_SCHEMA, buildPrompt, reportFromModel, validateInput } from '../shared/audit.js'
import { LEDGER_MAX_IMAGE_BYTES, LEDGER_PROMPT, SAMPLE_LEDGER_ROWS, rowsFromModel } from '../shared/ledger.js'
import {
  AiError,
  aiCheck,
  clientIp,
  aiConfigured,
  aiModel,
  generateJson,
  json,
  makeRateLimiter,
  visionJson,
} from '../server/ai.js'

const rateLimitedAudit = makeRateLimiter(30, 10 * 60 * 1000)
const rateLimitedLedger = makeRateLimiter(20, 10 * 60 * 1000)

export async function handleLedgerImage(image: unknown, ip: string): Promise<Response> {
  if (rateLimitedLedger(ip)) return json({ error: 'ai_rate_limited' }, 429)

  if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(image)) {
    return json({ error: 'invalid_input', info: 'нужно фото в формате JPEG, PNG или WebP' }, 422)
  }
  if (image.length > LEDGER_MAX_IMAGE_BYTES) return json({ error: 'invalid_input', info: 'фото слишком большое' }, 422)

  try {
    const rows = rowsFromModel(await visionJson(LEDGER_PROMPT, image))
    return json({ rows })
  } catch (err) {
    const code = err instanceof AiError ? err.code : 'ai_failed'
    const info = err instanceof AiError ? err.info : err instanceof Error ? err.message.slice(0, 120) : undefined
    return json({ error: code, info }, code === 'not_configured' ? 503 : 502)
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'bad_json' }, 400)
  }

  // 1. If sample testing flag is passed, return stub data immediately (works even if AI key is unconfigured)
  if (body && typeof body === 'object') {
    if ('isSample' in body && Boolean((body as { isSample?: unknown }).isSample)) {
      return json({ rows: SAMPLE_LEDGER_ROWS })
    }
  }

  if (!aiConfigured()) return json({ error: 'not_configured' }, 503)

  const ip = clientIp(request)

  // 2. If an image payload is passed, recognize the notebook ledger photo
  if (body && typeof body === 'object' && 'image' in body && (body as { image?: unknown }).image) {
    return handleLedgerImage((body as { image?: unknown }).image, ip)
  }

  // 2. Otherwise run SME questionnaire audit
  if (rateLimitedAudit(ip)) return json({ error: 'rate_limited' }, 429)

  const parsed = validateInput(body)
  if (!parsed.ok) return json({ error: 'invalid_input', fields: parsed.errors }, 422)

  try {
    const raw = await generateJson(buildPrompt(parsed.value), RESPONSE_SCHEMA)
    return json({ report: reportFromModel(raw, parsed.value) })
  } catch (err) {
    const code = err instanceof AiError ? err.code : 'ai_failed'
    if (!(err instanceof AiError)) console.error('Audit failed', err)
    const info = err instanceof AiError ? err.info : err instanceof Error ? err.message.slice(0, 120) : undefined
    return json({ error: code, info }, code === 'not_configured' ? 503 : 502)
  }
}

export async function GET(request: Request): Promise<Response> {
  const check = new URL(request.url).searchParams.has('check') ? await aiCheck() : undefined
  return json({ ok: true, configured: aiConfigured(), model: aiModel(), check })
}
