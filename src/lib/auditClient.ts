import type { AuditInput, AuditReport } from '../../shared/audit'
import { buildDemoReport } from './demoReport'

export type AuditErrorKind = 'ai_failed' | 'ai_quota' | 'ai_busy' | 'ai_timeout' | 'rate_limited' | 'invalid_input' | 'network'

export class AuditError extends Error {
  kind: AuditErrorKind
  fields?: Record<string, string>
  constructor(kind: AuditErrorKind, fields?: Record<string, string>) {
    super(kind)
    this.kind = kind
    this.fields = fields
  }
}

export const ERROR_TEXT: Record<AuditErrorKind, string> = {
  ai_failed: 'ИИ-сервис не смог подготовить отчёт. Попробуйте ещё раз через минуту.',
  ai_quota: 'Исчерпан бесплатный лимит запросов к ИИ. Попробуйте позже или откройте демонстрационный отчёт.',
  ai_timeout: 'ИИ отвечал слишком долго. Попробуйте ещё раз.',
  ai_busy: 'ИИ сейчас перегружен. Попробуйте через минуту.',
  rate_limited: 'Слишком много запросов подряд. Подождите несколько минут.',
  invalid_input: 'Проверьте поля анкеты.',
  network: 'Нет соединения с сервером. Проверьте интернет и попробуйте снова.',
}

/**
 * Asks the server-side AI endpoint for a report.
 * If AI is not configured on this deployment, returns a clearly labelled demo report instead.
 */
export async function runAudit(input: AuditInput, signal?: AbortSignal): Promise<AuditReport> {
  let res: Response
  try {
    res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new AuditError('network')
  }

  // no API on this host (static preview) or AI key not configured → demo mode
  if (res.status === 404 || res.status === 405 || res.status === 503) return buildDemoReport(input)

  const data = (await res.json().catch(() => null)) as { report?: AuditReport; error?: string; fields?: Record<string, string> } | null
  if (res.ok && data?.report) return data.report

  const kind = (data?.error ?? 'ai_failed') as AuditErrorKind
  throw new AuditError(kind in ERROR_TEXT ? kind : 'ai_failed', data?.fields)
}

export function reportToText(r: AuditReport) {
  const sec = (title: string, items: { title: string; detail: string }[]) =>
    `${title}\n${items.map((i) => `• ${i.title} — ${i.detail}`).join('\n')}`
  return [
    `Melior · Первичный аудит бизнеса${r.mode === 'demo' ? ' (демонстрационный режим)' : ' (ИИ-анализ)'}`,
    '',
    r.summary,
    '',
    `Ориентир экономии: ${r.savings.low.toLocaleString('ru-RU')}–${r.savings.high.toLocaleString('ru-RU')} ₸ в месяц. ${r.savings.note}`,
    '',
    sec('Возможные проблемные места', r.problems),
    '',
    sec('Процессы для оптимизации', r.processes),
    '',
    sec('Направления сокращения расходов', r.costs),
    '',
    sec('Рекомендуемые автоматизации', r.automations),
    '',
    'План на 30 дней',
    ...r.plan.map((p) => `Неделя ${p.week}. ${p.title}\n${p.tasks.map((t) => `  – ${t}`).join('\n')}`),
  ].join('\n')
}
