import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Recommendation } from '../../shared/marketplace'
import { MP_ERROR_TEXT, MpError, fetchInsights } from '../lib/marketplaceClient'
import Icon from './ui/Icon'

type State =
  | { name: 'idle' }
  | { name: 'loading' }
  | { name: 'done'; recs: Recommendation[] }
  | { name: 'error'; message: string; soft: boolean }

/** «Рекомендации ИИ»: sends only an aggregated summary to /api/marketplace. */
export default function AiBlock({ kind, getSummary }: { kind: 'sales' | 'funnel'; getSummary: () => unknown }) {
  const [state, setState] = useState<State>({ name: 'idle' })

  const run = async () => {
    setState({ name: 'loading' })
    try {
      setState({ name: 'done', recs: await fetchInsights(getSummary(), kind) })
    } catch (err) {
      const code = err instanceof MpError ? err.code : 'ai_failed'
      const info = err instanceof MpError && err.info ? ` (${err.info})` : ''
      setState({ name: 'error', message: MP_ERROR_TEXT[code] + info, soft: code === 'not_configured' || code === 'no_server' })
    }
  }

  return (
    <div className="mp-ai">
      <div className="mp-ai-head">
        <div>
          <h3>
            <Icon name="spark" size={16} /> Рекомендации ИИ
          </h3>
          <p className="muted small">В ИИ уходят только итоговые цифры, без данных клиентов.</p>
        </div>
        {state.name !== 'loading' && (
          <button type="button" className="btn btn-primary btn-sm" onClick={run}>
            {state.name === 'done' ? 'Обновить' : 'Получить рекомендации'}
          </button>
        )}
      </div>
      {state.name === 'loading' && (
        <p className="mp-ai-loading" role="status">
          <span className="spinner" aria-hidden="true" /> ИИ анализирует данные…
        </p>
      )}
      {state.name === 'error' && (
        <p className={state.soft ? 'mp-ai-note' : 'mp-error'} role="alert">
          <Icon name="alert" size={16} /> {state.message}
        </p>
      )}
      {state.name === 'done' && (
        <ol className="mp-recs">
          {state.recs.map((r, i) => (
            <motion.li key={r.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <span className={`chip ${r.priority === 'high' ? 'chip-bad' : r.priority === 'medium' ? 'chip-demo' : ''}`}>
                {r.priority === 'high' ? 'важно' : r.priority === 'medium' ? 'средне' : 'низко'}
              </span>
              <b>{r.title}</b>
              <span>{r.detail}</span>
            </motion.li>
          ))}
        </ol>
      )}
    </div>
  )
}
