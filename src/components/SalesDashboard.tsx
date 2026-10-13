import { useMemo } from 'react'
import { analyse, sourceName, summaryForAi } from '../../shared/marketplace'
import type { SalesData } from '../../shared/marketplace'
import { fmtCur, fmtInt } from '../lib/format'
import { AreaChart } from './ui/charts'
import AiBlock from './AiBlock'
import './dashboard.css'
import './Marketplaces.css'

/** Analysis of normalised sales data — shared by spreadsheet upload and marketplace APIs. */
export default function SalesDashboard({ data, onReset, resetLabel }: { data: SalesData; onReset: () => void; resetLabel: string }) {
  const a = useMemo(() => analyse(data), [data])
  const fmt = (n: number) => fmtCur(n, data.currency)
  const totalRev = data.totals.revenue || 1
  const abcOf = (id: string) => (a.abc.a.some((p) => p.id === id) ? 'A' : a.abc.b.some((p) => p.id === id) ? 'B' : 'C')
  const series = useMemo(() => [{ name: 'Выручка', values: data.days.map((d) => d.revenue), color: '#4c7dff', area: true }], [data])
  const labels = useMemo(
    () => data.days.map((d) => new Date(`${d.date}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })),
    [data],
  )
  const hasDays = data.days.length > 1
  const hasStatus = data.totals.cancelled > 0 || data.totals.returned > 0
  const marginOf = (cost: number | undefined, rev: number) => (cost === undefined || rev <= 0 ? null : ((rev - cost) / rev) * 100)

  return (
    <div className="mp-dash panel">
      <div className="mp-dash-top">
        <div className="mp-dash-title">
          <b>{sourceName(data)}</b>
          {hasDays && (
            <span className="muted small">
              {new Date(`${data.from}T00:00:00`).toLocaleDateString('ru-RU')} — {new Date(`${data.to}T00:00:00`).toLocaleDateString('ru-RU')}
            </span>
          )}
          {data.source === 'demo' ? (
            <span className="chip chip-demo">
              <span className="dot" /> Демо-данные
            </span>
          ) : (
            <span className="chip chip-good">
              <span className="dot" /> {data.source === 'file' ? 'Ваши данные' : 'Загружено по API'}
            </span>
          )}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
          {resetLabel}
        </button>
      </div>

      <div className="mp-kpis">
        <Kpi
          label="Выручка"
          value={fmt(data.totals.revenue)}
          sub={hasDays ? `${a.trendPct >= 0 ? '+' : ''}${a.trendPct.toFixed(0)}% во второй половине периода` : undefined}
          tone={a.trendPct < -5 ? 'bad' : a.trendPct > 5 ? 'good' : undefined}
        />
        <Kpi label="Заказы" value={fmtInt(data.totals.orders)} sub={`${fmtInt(data.totals.units)} ед. товара`} />
        <Kpi label="Средний чек" value={fmt(a.avgCheck)} />
        {a.margin ? (
          <Kpi
            label="Валовая маржа"
            value={`${a.margin.pct.toFixed(1)}%`}
            sub={`прибыль ${fmt(data.totals.revenue - a.margin.cost)}`}
            tone={a.margin.pct < 15 ? 'bad' : undefined}
          />
        ) : (
          <Kpi label="Отмены" value={`${(a.cancelRate * 100).toFixed(1)}%`} sub={`${fmtInt(data.totals.cancelled)} заказов`} tone={a.cancelRate > 0.08 ? 'bad' : undefined} />
        )}
        {data.extras?.customers ? (
          <Kpi
            label="Повторные клиенты"
            value={`${((data.extras.customers.repeat / Math.max(1, data.extras.customers.total)) * 100).toFixed(0)}%`}
            sub={`${fmtInt(data.extras.customers.total)} клиентов`}
          />
        ) : (
          <Kpi label="Возвраты" value={`${(a.returnRate * 100).toFixed(1)}%`} sub={`${fmtInt(data.totals.returned)} шт`} tone={a.returnRate > 0.05 ? 'bad' : undefined} />
        )}
      </div>

      <div className="mp-grid">
        <div className="card">
          <div className="card-head">
            <h3>{hasDays ? 'Выручка по дням' : 'Категории'}</h3>
            {hasStatus && a.margin && (
              <span className="muted small">
                отмены {(a.cancelRate * 100).toFixed(1)}% · возвраты {(a.returnRate * 100).toFixed(1)}%
              </span>
            )}
          </div>
          {hasDays ? (
            <AreaChart series={series} labels={labels} format={fmt} height={240} ariaLabel={`Выручка по дням, ${sourceName(data)}`} />
          ) : (
            <Bars items={(data.extras?.categories ?? []).slice(0, 8).map((c) => ({ name: c.name, value: c.revenue }))} fmt={fmt} />
          )}
          {hasDays && data.extras?.categories && data.extras.categories.length > 1 && (
            <div className="mp-cats">
              <h4 className="muted small">Категории</h4>
              <Bars items={data.extras.categories.slice(0, 6).map((c) => ({ name: c.name, value: c.revenue }))} fmt={fmt} />
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Что мы нашли</h3>
          </div>
          <ul className="mp-findings">
            {a.findings.length === 0 && <li className="muted">Явных проблем не найдено.</li>}
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
          <h3>Товары · ABC</h3>
          <span className="muted small">A — 80% выручки</span>
        </div>
        {data.products.length === 0 ? (
          <p className="muted small">В данных нет разбивки по товарам.</p>
        ) : (
          <div className="mp-table-wrap">
            <table className="mp-table">
              <thead>
                <tr>
                  <th scope="col">Товар</th>
                  <th scope="col">Класс</th>
                  <th scope="col" className="r">Выручка</th>
                  <th scope="col" className="r">Продано</th>
                  {a.margin && (
                    <th scope="col" className="r">
                      Маржа
                    </th>
                  )}
                  {hasStatus && (
                    <>
                      <th scope="col" className="r">Отмены</th>
                      <th scope="col" className="r">Возвраты</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.products.slice(0, 15).map((pr) => {
                  const cls = abcOf(pr.id)
                  const m = marginOf(pr.cost, pr.revenue)
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
                      {a.margin && <td className={`r num ${m !== null && m < 15 ? 'is-bad' : ''}`}>{m === null ? '—' : `${m.toFixed(0)}%`}</td>}
                      {hasStatus && (
                        <>
                          <td className={`r num ${pr.cancels / Math.max(1, pr.units + pr.cancels) > 0.15 ? 'is-bad' : ''}`}>{fmtInt(pr.cancels)}</td>
                          <td className="r num">{fmtInt(pr.returns)}</td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {data.products.length > 15 && <p className="muted small mp-more">Показаны 15 из {fmtInt(data.products.length)} товаров.</p>}
      </div>

      <AiBlock key={`${data.provider}-${data.from}-${data.totals.revenue}`} kind="sales" getSummary={() => summaryForAi(data, a)} />

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

function Bars({ items, fmt }: { items: { name: string; value: number }[]; fmt: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (!items.length) return <p className="muted small">Нет данных по датам и категориям.</p>
  return (
    <ul className="exp">
      {items.map((i) => (
        <li key={i.name}>
          <div className="exp-row">
            <span>{i.name}</span>
            <span className="num">{fmt(i.value)}</span>
          </div>
          <div className="exp-track">
            <span style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
