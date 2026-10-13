import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PERIODS, PROVIDERS, analyse, providerOf, summaryForAi } from '../../shared/marketplace'
import type { PeriodDays, ProviderId, Recommendation, SalesData } from '../../shared/marketplace'
import { MP_ERROR_TEXT, MpError, fetchInsights, fetchMarketplace } from '../lib/marketplaceClient'
import { buildDemoSales } from '../lib/demoSales'
import { fmtCur, fmtInt } from '../lib/format'
import SectionHead from './ui/SectionHead'
import Reveal from './ui/Reveal'
import Icon from './ui/Icon'
import { AreaChart } from './ui/charts'
import './Marketplaces.css'

type Status = { name: 'idle' } | { name: 'loading' } | { name: 'error'; message: string }
type AiState =
  | { name: 'idle' }
  | { name: 'loading' }
  | { name: 'done'; recs: Recommendation[] }
  | { name: 'error'; message: string; fallback: boolean }

export default function Marketplaces() {
  const [provider, setProvider] = useState<ProviderId>('kaspi')
  const [days, setDays] = useState<PeriodDays>(30)
  const [creds, setCreds] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Status>({ name: 'idle' })
  const [datasets, setDatasets] = useState<Partial<Record<ProviderId, SalesData>>>({})
  const [ai, setAi] = useState<Partial<Record<ProviderId, AiState>>>({})
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
      setAi((a) => ({ ...a, [provider]: { name: 'idle' } }))
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
    setAi((a) => ({ ...a, [provider]: { name: 'idle' } }))
    setStatus({ name: 'idle' })
  }

  const disconnect = () => {
    setDatasets((d) => {
      const next = { ...d }
      delete next[provider]
      return next
    })
    setAi((a) => ({ ...a, [provider]: { name: 'idle' } }))
  }

  const loaded = PROVIDERS.filter((x) => datasets[x.id])

  return (
    <section className="section mp" id="marketplaces" aria-labelledby="mp-title">
      <div className="container">
        <SectionHead
          eyebrow="Маркетплейсы"
          title={<span id="mp-title">Продажи на Kaspi, Wildberries и Ozon — в одном месте</span>}
          lead="Подключите кабинет продавца по API: Melior загрузит заказы, посчитает выручку, отмены и возвраты, найдёт слабые товары и подскажет, что сделать на этой неделе."
        />

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
                  <h4>Как это работает</h4>
                  <ol>
                    <li>Ключ уходит по HTTPS на сервер Melior и используется только для этой загрузки.</li>
                    <li>Сервер запрашивает заказы у маркетплейса и приводит их к общему формату.</li>
                    <li>Ключ нигде не сохраняется: ни на сервере, ни в браузере.</li>
                  </ol>
                  <div className="mp-safe">
                    <Icon name="check" size={16} />
                    <span>Создавайте ключ с правами «только чтение» — Melior ничего не меняет в кабинете.</span>
                  </div>
                  {provider === 'kaspi' && (
                    <p className="muted small">
                      Kaspi может не принимать запросы с серверов за пределами Казахстана. Если увидите ошибку 403 — функцию нужно перенести на
                      казахстанский хостинг.
                    </p>
                  )}
                  {provider === 'wb' && <p className="muted small">Лимит статистики Wildberries — около одного запроса в минуту.</p>}
                  {provider === 'ozon' && <p className="muted small">Используется метод аналитики Ozon: выручка, заказанные единицы, возвраты и отмены.</p>}
                </aside>
              </div>
            </motion.div>
          ) : (
            <motion.div key={`dash-${provider}-${data.source}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
              <SalesDashboard
                data={data}
                ai={ai[provider] ?? { name: 'idle' }}
                setAi={(s) => setAi((a) => ({ ...a, [provider]: s }))}
                onReset={disconnect}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

function SalesDashboard({
  data,
  ai,
  setAi,
  onReset,
}: {
  data: SalesData
  ai: AiState
  setAi: (s: AiState) => void
  onReset: () => void
}) {
  const a = useMemo(() => analyse(data), [data])
  const cur = data.currency
  const fmt = (n: number) => fmtCur(n, cur)
  const totalRev = data.totals.revenue || 1
  const abcOf = (id: string) => (a.abc.a.some((p) => p.id === id) ? 'A' : a.abc.b.some((p) => p.id === id) ? 'B' : 'C')
  const series = useMemo(() => [{ name: 'Выручка', values: data.days.map((d) => d.revenue), color: '#4c7dff', area: true }], [data])
  const labels = useMemo(() => data.days.map((d) => new Date(`${d.date}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })), [data])

  const askAi = async () => {
    setAi({ name: 'loading' })
    try {
      const recs = await fetchInsights(summaryForAi(data, a))
      setAi({ name: 'done', recs })
    } catch (err) {
      const code = err instanceof MpError ? err.code : 'ai_failed'
      setAi({ name: 'error', message: MP_ERROR_TEXT[code], fallback: code === 'not_configured' || code === 'no_server' })
    }
  }

  return (
    <div className="mp-dash panel">
      <div className="mp-dash-top">
        <div className="mp-dash-title">
          <b>{providerOf(data.provider).name}</b>
          <span className="muted small">
            {new Date(`${data.from}T00:00:00`).toLocaleDateString('ru-RU')} — {new Date(`${data.to}T00:00:00`).toLocaleDateString('ru-RU')}
          </span>
          {data.source === 'demo' ? (
            <span className="chip chip-demo">
              <span className="dot" /> Демо-данные
            </span>
          ) : (
            <span className="chip chip-good">
              <span className="dot" /> Загружено по API
            </span>
          )}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
          {data.source === 'demo' ? 'Подключить свой кабинет' : 'Отключить'}
        </button>
      </div>

      <div className="mp-kpis">
        <Kpi label="Выручка" value={fmt(data.totals.revenue)} sub={`${a.trendPct >= 0 ? '+' : ''}${a.trendPct.toFixed(0)}% во второй половине периода`} tone={a.trendPct < -5 ? 'bad' : a.trendPct > 5 ? 'good' : undefined} />
        <Kpi label="Заказы" value={fmtInt(data.totals.orders)} sub={`${fmtInt(data.totals.units)} ед. товара`} />
        <Kpi label="Средний чек" value={fmt(a.avgCheck)} />
        <Kpi label="Отмены" value={`${(a.cancelRate * 100).toFixed(1)}%`} sub={`${fmtInt(data.totals.cancelled)} заказов`} tone={a.cancelRate > 0.08 ? 'bad' : undefined} />
        <Kpi label="Возвраты" value={`${(a.returnRate * 100).toFixed(1)}%`} sub={`${fmtInt(data.totals.returned)} шт`} tone={a.returnRate > 0.05 ? 'bad' : undefined} />
      </div>

      <div className="mp-grid">
        <div className="card">
          <div className="card-head">
            <h3>Выручка по дням</h3>
          </div>
          <AreaChart series={series} labels={labels} format={fmt} height={240} ariaLabel={`Выручка по дням, ${providerOf(data.provider).name}`} />
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Что мы заметили</h3>
          </div>
          <ul className="mp-findings">
            {a.findings.length === 0 && <li className="muted">Явных проблем за период не найдено.</li>}
            {a.findings.map((f) => (
              <li key={f.title} className={`is-${f.level}`}>
                <b>{f.title}</b>
                <span>{f.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mp-products">
        <div className="card-head">
          <h3>Товары · ABC-анализ</h3>
          <span className="muted small">A — 80% выручки, B — следующие 15%, C — остальное</span>
        </div>
        {data.products.length === 0 ? (
          <p className="muted small">Маркетплейс не вернул разбивку по товарам.</p>
        ) : (
          <div className="mp-table-wrap">
            <table className="mp-table">
              <thead>
                <tr>
                  <th scope="col">Товар</th>
                  <th scope="col">Класс</th>
                  <th scope="col" className="r">Выручка</th>
                  <th scope="col" className="r">Продано</th>
                  <th scope="col" className="r">Отмены</th>
                  <th scope="col" className="r">Возвраты</th>
                </tr>
              </thead>
              <tbody>
                {data.products.slice(0, 12).map((pr) => {
                  const cls = abcOf(pr.id)
                  return (
                    <tr key={pr.id}>
                      <td>
                        <span className="mp-pname">{pr.name}</span>
                        <span className="mp-share" aria-hidden="true">
                          <i style={{ width: `${Math.max(2, (pr.revenue / totalRev) * 100)}%` }} />
                        </span>
                      </td>
                      <td>
                        <span className={`abc abc-${cls}`}>{cls}</span>
                      </td>
                      <td className="r num">{fmt(pr.revenue)}</td>
                      <td className="r num">{fmtInt(pr.units)}</td>
                      <td className={`r num ${pr.cancels / Math.max(1, pr.units + pr.cancels) > 0.15 ? 'is-bad' : ''}`}>{fmtInt(pr.cancels)}</td>
                      <td className="r num">{fmtInt(pr.returns)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mp-ai">
        <div className="mp-ai-head">
          <div>
            <h3>
              <Icon name="spark" size={16} /> Рекомендации ИИ
            </h3>
            <p className="muted small">В ИИ уходит только агрегированная сводка: суммы, товары, проценты. Данных покупателей там нет.</p>
          </div>
          {ai.name !== 'loading' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={askAi}>
              {ai.name === 'done' ? 'Обновить' : 'Получить рекомендации'}
            </button>
          )}
        </div>
        {ai.name === 'loading' && (
          <p className="mp-ai-loading" role="status">
            <span className="spinner" aria-hidden="true" /> ИИ анализирует продажи…
          </p>
        )}
        {ai.name === 'error' && (
          <p className={ai.fallback ? 'mp-ai-note' : 'mp-error'} role="alert">
            <Icon name="alert" size={16} /> {ai.message}
          </p>
        )}
        {ai.name === 'done' && (
          <ol className="mp-recs">
            {ai.recs.map((r, i) => (
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

      {data.notes.length > 0 && (
        <ul className="mp-notes">
          {data.notes.map((n) => (
            <li key={n} className="muted small">
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className={`kpi-value ${tone ? `is-${tone}` : ''}`}>{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  )
}
