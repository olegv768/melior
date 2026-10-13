import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import SectionHead from './ui/SectionHead'
import Reveal from './ui/Reveal'
import CountUp from './ui/CountUp'
import { AreaChart, PairBars } from './ui/charts'
import { fmtInt, fmtMoney, fmtMoneyRange } from '../lib/format'
import './Analytics.css'

type Period = '30' | '90'

// deterministic demo data — no randomness between renders
const wave = (i: number, seed: number) => Math.sin(i * 0.9 + seed) * 0.5 + Math.sin(i * 0.37 + seed * 2) * 0.5

function buildSeries(period: Period) {
  if (period === '30') {
    const labels = Array.from({ length: 30 }, (_, i) => `${i + 1} окт`)
    const revenue = labels.map((_, i) => {
      const weekend = i % 7 === 5 || i % 7 === 6 ? 1.18 : 1
      return Math.round((410_000 + wave(i, 1) * 38_000 + i * 1_400) * weekend)
    })
    const costs = labels.map((_, i) => Math.round(318_000 + wave(i, 3) * 16_000 + (i % 7 === 0 ? 46_000 : 0)))
    return { labels, revenue, costs }
  }
  const labels = Array.from({ length: 13 }, (_, i) => `нед ${i + 1}`)
  const revenue = labels.map((_, i) => Math.round(2_780_000 + wave(i, 2) * 190_000 + i * 22_000))
  const costs = labels.map((_, i) => Math.round(2_260_000 + wave(i, 5) * 90_000 + i * 9_000))
  return { labels, revenue, costs }
}

const EXPENSES = [
  { name: 'Закупка товара', share: 58, flag: 'Часть закупок выше спроса' },
  { name: 'Фонд оплаты труда', share: 18 },
  { name: 'Аренда', share: 9 },
  { name: 'Списания и просрочка', share: 6, flag: 'Растёт 3 месяца подряд' },
  { name: 'Логистика', share: 4 },
  { name: 'Связь и сервисы', share: 3 },
  { name: 'Прочее', share: 2 },
]

const PROCESSES = [
  { name: 'Ответы клиентам о наличии товара', hours: 6, auto: true },
  { name: 'Заказ поставщикам по телефону', hours: 5, auto: true },
  { name: 'Пересчёт остатков в конце смены', hours: 4, auto: false },
  { name: 'Сверка безналичных оплат с кассой', hours: 3, auto: true },
  { name: 'Учёт списаний в тетради', hours: 2, auto: true },
]

const CATEGORIES = [
  { label: 'Молочка', bought: 920, sold: 702 },
  { label: 'Хлеб', bought: 1180, sold: 1046 },
  { label: 'Овощи', bought: 640, sold: 488 },
  { label: 'Напитки', bought: 1320, sold: 1254 },
  { label: 'Бакалея', bought: 760, sold: 731 },
  { label: 'Снеки', bought: 540, sold: 402 },
]

const STEPS = [
  {
    key: 'data',
    title: 'Данные собраны',
    text: '3 520 чеков, 312 товаров, 26 поставок.',
  },
  {
    key: 'find',
    title: 'Найдена аномалия',
    text: '13% товаров не продаются 30+ дней.',
  },
  {
    key: 'cause',
    title: 'Причина',
    text: 'Закупки не учитывают спрос: излишек 22–34%.',
  },
  {
    key: 'fix',
    title: 'Рекомендация',
    text: 'Заказывать по прогнозу спроса.',
  },
]

export default function Analytics() {
  const [period, setPeriod] = useState<Period>('30')
  const [step, setStep] = useState(0)
  const [forecast, setForecast] = useState(false)
  const [autoplay, setAutoplay] = useState(true)
  const scenarioRef = useRef<HTMLDivElement>(null)
  const inView = useInView(scenarioRef, { margin: '0px 0px -25% 0px' })
  const reduced = useReducedMotion()

  const { labels, revenue, costs } = useMemo(() => buildSeries(period), [period])
  const series = useMemo(
    () => [
      { name: 'Выручка', values: revenue, color: '#4c7dff', area: true },
      { name: 'Расходы', values: costs, color: '#9b8cff', dashed: true },
    ],
    [revenue, costs],
  )
  const revenueTotal = revenue.reduce((a, b) => a + b, 0)
  const costsTotal = costs.reduce((a, b) => a + b, 0)
  const saveLow = Math.round((costsTotal * 0.05) / 1000) * 1000
  const saveHigh = Math.round((costsTotal * 0.08) / 1000) * 1000
  const autoTasks = PROCESSES.filter((p) => p.auto)

  // walk through the scenario once the block is visible
  useEffect(() => {
    if (!inView || !autoplay || reduced) return
    if (step >= STEPS.length - 1) {
      setForecast(true)
      setAutoplay(false)
      return
    }
    const t = window.setTimeout(() => setStep((s) => s + 1), 2800)
    return () => window.clearTimeout(t)
  }, [inView, autoplay, step, reduced])

  const chooseStep = (i: number) => {
    setAutoplay(false)
    setStep(i)
    setForecast(i === STEPS.length - 1)
  }

  const chooseMode = (on: boolean) => {
    setAutoplay(false)
    setForecast(on)
    if (on) setStep(STEPS.length - 1)
  }

  const bars = CATEGORIES.map((c) => ({
    label: c.label,
    a: forecast ? Math.round(c.sold * 1.06) : c.bought,
    b: c.sold,
  }))
  const excessNow = CATEGORIES.reduce((a, c) => a + c.bought - c.sold, 0)
  const excessForecast = CATEGORIES.reduce((a, c) => a + Math.round(c.sold * 1.06) - c.sold, 0)

  return (
    <section className="section analytics" id="product" aria-labelledby="analytics-title">
      <div className="container">
        <SectionHead
          eyebrow="Продукт"
          title={<span id="analytics-title">У каждого бизнеса есть точки роста</span>}
          lead="Где бизнес теряет деньги и время — на одном экране."
          aside={
            <span className="chip chip-demo">
              <span className="dot" /> Демо-данные · все цифры примерные
            </span>
          }
        />

        <Reveal>
          <div className="dash panel">
            <div className="dash-top">
              <div className="dash-title">
                <span className="dash-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  Магазин у дома <span className="muted">· демонстрационный аккаунт</span>
                </span>
              </div>
              <div className="seg" role="tablist" aria-label="Период">
                {(['30', '90'] as Period[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={period === p}
                    className={period === p ? 'is-on' : ''}
                    onClick={() => setPeriod(p)}
                  >
                    {period === p && <motion.span layoutId="seg-pill" className="seg-pill" />}
                    <span>{p} дней</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="kpis">
              <div className="kpi">
                <span className="kpi-label">Выручка</span>
                <span className="kpi-value">
                  <CountUp value={revenueTotal} format={fmtMoney} />
                </span>
                <span className="kpi-sub good">+4,2% к прошлому периоду</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Операционные расходы</span>
                <span className="kpi-value">
                  <CountUp value={costsTotal} format={fmtMoney} />
                </span>
                <span className="kpi-sub">{Math.round((costsTotal / revenueTotal) * 100)}% от выручки</span>
              </div>
              <div className="kpi is-accent">
                <span className="kpi-label">Потенциальная экономия</span>
                <span className="kpi-value">
                  <CountUp value={saveHigh} format={(n) => fmtMoneyRange((saveLow * n) / saveHigh, n)} />
                </span>
                <span className="kpi-sub">оценка за период, требует проверки</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Можно автоматизировать</span>
                <span className="kpi-value">
                  <CountUp value={autoTasks.length} /> задачи
                </span>
                <span className="kpi-sub">≈ {autoTasks.reduce((a, p) => a + p.hours, 0)} ч ручной работы в неделю</span>
              </div>
            </div>

            <div className="dash-grid">
              <div className="card card-chart">
                <div className="card-head">
                  <h3>Выручка и расходы</h3>
                  <div className="legend">
                    <span>
                      <i style={{ background: '#4c7dff' }} /> Выручка
                    </span>
                    <span>
                      <i style={{ background: '#9b8cff' }} /> Расходы
                    </span>
                  </div>
                </div>
                <AreaChart
                  key={period}
                  labels={labels}
                  format={fmtMoney}
                  height={280}
                  ariaLabel={`График выручки и расходов за ${period} дней, демонстрационные данные`}
                  series={series}
                />
                <div className="insights">
                  <div>
                    <span className="muted small">Пик продаж</span>
                    <b>сб–вс, 18:00–21:00</b>
                  </div>
                  <div>
                    <span className="muted small">Средний чек</span>
                    <b className="num">{period === '30' ? '3 840 ₸' : '3 760 ₸'}</b>
                  </div>
                  <div>
                    <span className="muted small">Сигнал</span>
                    <b className="warn">Расходы растут в дни поставок</b>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-head">
                  <h3>Структура расходов</h3>
                  <span className="muted small">за месяц</span>
                </div>
                <ul className="exp">
                  {EXPENSES.map((e, i) => (
                    <li key={e.name} className={e.flag ? 'is-flag' : ''}>
                      <div className="exp-row">
                        <span>{e.name}</span>
                        <span className="num">{e.share}%</span>
                      </div>
                      <div className="exp-track">
                        <motion.span
                          initial={{ width: 0 }}
                          whileInView={{ width: `${e.share}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.9, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                      {e.flag && <span className="exp-flag">{e.flag}</span>}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card">
                <div className="card-head">
                  <h3>Неэффективные процессы</h3>
                  <span className="muted small">ч / неделя</span>
                </div>
                <ul className="procs">
                  {PROCESSES.map((p) => (
                    <li key={p.name}>
                      <span className="procs-name">{p.name}</span>
                      <span className="procs-meta">
                        {p.auto && <span className="chip chip-accent">авто</span>}
                        <span className="num procs-h">{p.hours}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="scenario" ref={scenarioRef}>
              <div className="scenario-steps">
                <div className="scenario-label mono">Сценарий анализа</div>
                <ol>
                  {STEPS.map((s, i) => (
                    <li key={s.key}>
                      <button
                        type="button"
                        className={`step ${i === step ? 'is-on' : ''} ${i < step ? 'is-done' : ''}`}
                        onClick={() => chooseStep(i)}
                        aria-current={i === step ? 'step' : undefined}
                      >
                        <span className="step-n mono">{String(i + 1).padStart(2, '0')}</span>
                        <span className="step-body">
                          <span className="step-title">{s.title}</span>
                          <AnimatePresence initial={false}>
                            {i === step && (
                              <motion.span
                                className="step-text"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.35 }}
                              >
                                {s.text}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="scenario-viz">
                <div className="card-head">
                  <h3>Закупки против фактического спроса</h3>
                  <div className="seg seg-sm" role="tablist" aria-label="Режим закупок">
                    <button type="button" role="tab" aria-selected={!forecast} className={!forecast ? 'is-on' : ''} onClick={() => chooseMode(false)}>
                      {!forecast && <motion.span layoutId="seg-pill-2" className="seg-pill" />}
                      <span>Сейчас</span>
                    </button>
                    <button type="button" role="tab" aria-selected={forecast} className={forecast ? 'is-on' : ''} onClick={() => chooseMode(true)}>
                      {forecast && <motion.span layoutId="seg-pill-2" className="seg-pill" />}
                      <span>По прогнозу</span>
                    </button>
                  </div>
                </div>
                <PairBars
                  data={bars}
                  aLabel="Закуплено, шт"
                  bLabel="Продано, шт"
                  aColor={forecast ? '#4fd6a0' : '#f2b45a'}
                  bColor="#4c7dff"
                  format={fmtInt}
                />
                <div className="scenario-result" aria-live="polite">
                  <AnimatePresence mode="wait">
                    {forecast ? (
                      <motion.p key="f" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        Излишек закупок падает с <b>{fmtInt(excessNow)}</b> до <b>{fmtInt(excessForecast)} шт</b> в месяц — меньше денег заморожено в
                        остатках.
                      </motion.p>
                    ) : (
                      <motion.p key="n" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        Сейчас закупается на <b>{fmtInt(excessNow)} шт</b> больше, чем продаётся за месяц.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
