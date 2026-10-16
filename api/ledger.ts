// Vercel Serverless Function: POST /api/ledger  { image: "data:image/jpeg;base64,…" } → { rows }
// One notebook page per request. The photo is sent to the AI for recognition only and is not stored.
import { LEDGER_MAX_IMAGE_BYTES, LEDGER_PROMPT, rowsFromModel } from '../shared/ledger.js'
import { AiError, aiConfigured, clientIp, json, makeRateLimiter, visionJson } from '../server/ai.js'

const limit = makeRateLimiter(20, 10 * 60 * 1000)

export async function POST(request: Request): Promise<Response> {
  if (!aiConfigured()) return json({ error: 'not_configured' }, 503)
  if (limit(clientIp(request))) return json({ error: 'ai_rate_limited' }, 429)

  let body: { image?: unknown }
  try {
    body = (await request.json()) as { image?: unknown }
  } catch {
    return json({ error: 'bad_json' }, 400)
  }
  const image = body.image
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
