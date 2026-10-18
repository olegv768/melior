import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PERIODS, PROVIDERS, providerOf } from '../../shared/marketplace'
import type { PeriodDays, ProviderId, SalesData } from '../../shared/marketplace'
import { MP_ERROR_TEXT, MpError, fetchMarketplace } from '../lib/marketplaceClient'
import { buildDemoSales } from '../lib/demoSales'
import { fmtCur, fmtInt } from '../lib/format'
import Reveal from './ui/Reveal'
import Icon from './ui/Icon'
import SalesDashboard from './SalesDashboard'
import './Marketplaces.css'

type Status = { name: 'idle' } | { name: 'loading' } | { name: 'error'; message: string }

export default function Marketplaces() {
  const [provider, setProvider] = useState<ProviderId>('kaspi')
  const [days, setDays] = useState<PeriodDays>(30)
  const [creds, setCreds] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Status>({ name: 'idle' })
  const [datasets, setDatasets] = useState<Partial<Record<ProviderId, SalesData>>>({})
  const abortRef = useRef<AbortController | null>(null)

  const p = providerOf(provider)
  const data = datasets[provider]

  const switchProvider = (id: ProviderId) => {
    abortRef.current?.abort()
    setProvider(id)
    setCreds({})
    setErrors({})
    setStatus({ name: 'idle' })
  }

  async function connect(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    for (const f of p.fields) if (!creds[f.key]?.trim()) errs[f.key] = 'Обязательное поле'
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.getElementById(`mp-${p.fields.find((f) => errs[f.key])!.key}`)?.focus()
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setStatus({ name: 'loading' })
    try {
      const result = await fetchMarketplace(provider, creds, days, ctrl.signal)
      setDatasets((d) => ({ ...d, [provider]: result }))
      setCreds({}) // do not keep keys in memory longer than needed
      setStatus({ name: 'idle' })
    } catch (err) {
      if (ctrl.signal.aborted) return
      if (err instanceof MpError && err.fields) setErrors(err.fields)
      const code = err instanceof MpError ? err.code : 'upstream'
      setStatus({ name: 'error', message: MP_ERROR_TEXT[code] })
    }
  }

  const loadDemo = () => {
    abortRef.current?.abort()
    setDatasets((d) => ({ ...d, [provider]: buildDemoSales(provider, days) }))
    setStatus({ name: 'idle' })
  }

  const disconnect = () => {
    setDatasets((d) => {
      const next = { ...d }
      delete next[provider]
      return next
    })
  }

  const loaded = PROVIDERS.filter((x) => datasets[x.id])

  return (
    <div className="ws-body">

        <Reveal>
          <div className="mp-tabs" role="tablist" aria-label="Маркетплейс">
            {PROVIDERS.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={provider === x.id}
                aria-label={x.name}
                className={provider === x.id ? 'is-on' : ''}
                onClick={() => switchProvider(x.id)}
              >
                <span className={`mp-mark mp-mark-${x.id}`} aria-hidden="true">
                  {x.id === 'wb' ? 'WB' : x.name[0]}
                </span>
                <span>{x.name}</span>
                {datasets[x.id] && <span className="mp-dot" title="Данные загружены" />}
                {provider === x.id && <motion.span layoutId="mp-tab" className="mp-tab-bg" />}
              </button>
            ))}
          </div>
        </Reveal>

        {loaded.length > 1 && (
          <div className="mp-strip" aria-label="Загруженные площадки">
            {loaded.map((x) => {
              const d = datasets[x.id]!
              return (
                <button key={x.id} type="button" className={`mp-strip-item ${provider === x.id ? 'is-on' : ''}`} onClick={() => setProvider(x.id)}>
                  <span className="muted small">{x.name}</span>
                  <b className="num">{fmtCur(d.totals.revenue, d.currency)}</b>
                  <span className="muted small">
                    {fmtInt(d.totals.orders)} заказов · {d.source === 'demo' ? 'демо' : 'API'}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <AnimatePresence mode="wait">
          {!data ? (
            <motion.div key={`connect-${provider}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div className="mp-connect panel">
                <form className="mp-form" onSubmit={connect} noValidate>
                  <h3>Подключить {p.name}</h3>
                  {p.fields.map((f) => (
                    <div className="mp-field" key={f.key}>
                      <label htmlFor={`mp-${f.key}`}>{f.label}</label>
                      <input
                        id={`mp-${f.key}`}
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        value={creds[f.key] ?? ''}
                        onChange={(e) => {
                          setCreds((c) => ({ ...c, [f.key]: e.target.value }))
                          if (errors[f.key]) setErrors((er) => ({ ...er, [f.key]: '' }))
                        }}
                        aria-invalid={!!errors[f.key]}
                        aria-describedby={`mp-${f.key}-hint`}
                      />
                      <span id={`mp-${f.key}-hint`} className={errors[f.key] ? 'field-error' : 'muted small'}>
                        {errors[f.key] || f.hint}
                      </span>
                    </div>
                  ))}
                  <div className="mp-field">
                    <span className="mp-label">Период</span>
                    <div className="pills" role="radiogroup" aria-label="Период">
                      {PERIODS.map((d) => (
                        <label key={d} className={`pill ${days === d ? 'is-on' : ''}`}>
                          <input type="radio" name="mp-days" checked={days === d} onChange={() => setDays(d)} />
                          {d} дней
                        </label>
                      ))}
                    </div>
                  </div>

                  {status.name === 'error' && (
                    <p className="mp-error" role="alert">
                      <Icon name="alert" size={16} /> {status.message}
                    </p>
                  )}

                  <div className="mp-actions">
                    <button type="submit" className="btn btn-primary" disabled={status.name === 'loading'}>
                      {status.name === 'loading' ? (
                        <>
                          <span className="spinner" aria-hidden="true" /> Загружаем заказы…
                        </>
                      ) : (
                        <>
                          Подключить и загрузить <span className="arrow">→</span>
                        </>
                      )}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={loadDemo}>
                      Показать на демо-данных
                    </button>
                  </div>
                </form>

                <aside className="mp-side">
                  <div className="mp-safe">
                    <Icon name="check" size={16} />
                    <span>Ключ не сохраняется. Используйте ключ «только чтение».</span>
                  </div>
                  {provider === 'wb' && <p className="muted small">Лимит WB — 1 запрос в минуту.</p>}
                  {provider === 'ozon' && <p className="muted small">Данные из аналитики Ozon.</p>}
                </aside>
              </div>
            </motion.div>
          ) : (
            <motion.div key={`dash-${provider}-${data.source}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
              <SalesDashboard data={data} onReset={disconnect} resetLabel={data.source === 'demo' ? 'Подключить свой кабинет' : 'Отключить'} />
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  )
}
