// Vercel Serverless Function: POST /api/ledger
// Compatibility wrapper delegating to the unified handleLedgerImage in api/audit.ts
import { handleLedgerImage } from './audit.js'
import { SAMPLE_LEDGER_ROWS } from '../shared/ledger.js'
import { aiConfigured, clientIp, json } from '../server/ai.js'

export async function POST(request: Request): Promise<Response> {
  let body: { image?: unknown; isSample?: unknown }
  try {
    body = (await request.json()) as { image?: unknown; isSample?: unknown }
  } catch {
    return json({ error: 'bad_json' }, 400)
  }

  if (body && body.isSample) {
    return json({ rows: SAMPLE_LEDGER_ROWS })
  }

  if (!aiConfigured()) return json({ error: 'not_configured' }, 503)

  return handleLedgerImage(body.image, clientIp(request))
}
