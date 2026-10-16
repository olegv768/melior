import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LEDGER_MAX_IMAGE_BYTES, LEDGER_MAX_PAGES, fullDate } from '../../shared/ledger'
import type { LedgerKind, LedgerRow } from '../../shared/ledger'
import type { SalesData } from '../../shared/marketplace'
import { buildSales } from '../lib/table'
import type { Cell } from '../lib/table'
import { fmtCur, fmtInt } from '../lib/format'
import Icon from './ui/Icon'
import SalesDashboard from './SalesDashboard'
import './Ledger.css'

type Page = { id: number; name: string; url: string; status: 'wait' | 'busy' | 'done' | 'error'; found?: number }
type Stage = { name: 'pick' } | { name: 'read' } | { name: 'edit' } | { name: 'done'; data: SalesData | null }

const ERRORS: Record<string, string> = {
  not_configured: 'ИИ на сервере не подключён — распознавание фото недоступно.',
  ai_quota: 'Бесплатный лимит ИИ на минуту исчерпан. Подождите минуту и нажмите «Продолжить».',
  ai_rate_limited: 'Слишком много фото подряд. Подождите пару минут.',
  ai_busy: 'ИИ сейчас перегружен. Попробуйте через минуту.',
  ai_timeout: 'ИИ отвечал слишком долго. Нажмите «Продолжить».',
  ai_key: 'Ключ ИИ на сервере неверный.',
  invalid_input: 'Фото не подошло: нужен JPEG, PNG или WebP.',
  network: 'Нет соединения с сервером.',
  no_server: 'Распознавание работает на сайте (Vercel) или при запуске npm run dev.',
  ai_failed: 'ИИ не смог прочитать страницу. Сфотографируйте ровнее и при хорошем свете.',
}

let uid = 0

/** Downscale to ≤1600 px and JPEG so a phone photo fits the API limits. */
async function toDataUrl(blob: Blob): Promise<string> {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  for (const q of [0.85, 0.7, 0.55]) {
    const url = canvas.toDataURL('image/jpeg', q)
    if (url.length < LEDGER_MAX_IMAGE_BYTES) return url
  }
  throw new Error('too_big')
}

async function recognise(image: string): Promise<LedgerRow[]> {
  let res: Response
  try {
    res = await fetch('/api/ledger', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image }) })
  } catch {
    throw new Error('network')
  }
  if (res.status === 404 || res.status === 405) throw new Error('no_server')
  const data = (await res.json().catch(() => null)) as { rows?: LedgerRow[]; error?: string } | null
  if (!res.ok || !data?.rows) throw new Error(data?.error ?? 'ai_failed')
  return data.rows
}

export default function Ledger() {
  const [stage, setStage] = useState<Stage>({ name: 'pick' })
  const [pages, setPages] = useState<Page[]>([])
  const [rows, setRows] = useState<(LedgerRow & { id: number })[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currency, setCurrency] = useState('₸')
  const pickRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)

  async function addFiles(files: Blob[], names: string[]) {
    setError(null)
    const room = LEDGER_MAX_PAGES - pages.length
    if (room <= 0) return setError(`Не больше ${LEDGER_MAX_PAGES} страниц за раз.`)
    const added: Page[] = []
    for (let i = 0; i < Math.min(room, files.length); i++) {
      if (!files[i].type.startsWith('image/')) continue
      try {
        added.push({ id: ++uid, name: names[i], url: await toDataUrl(files[i]), status: 'wait' })
      } catch {
        setError('Не удалось открыть фото. Попробуйте JPEG или PNG (не HEIC).')
      }
    }
    setPages((p) => [...p, ...added])
  }

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const list = [...(e.target.files ?? [])]
    e.target.value = ''
    addFiles(list, list.map((f) => f.name))
  }

  const trySample = async () => {
    const blob = await fetch('/ledger-sample.jpg').then((r) => r.blob())
    await addFiles([blob], ['пример_тетради.jpg'])
  }

  async function readAll() {
    setStage({ name: 'read' })
    setError(null)
    for (const p of pages) {
      if (p.status === 'done') continue
      setPages((ps) => ps.map((x) => (x.id === p.id ? { ...x, status: 'busy' } : x)))
      try {
        const found = await recognise(p.url)
        setRows((rs) => [...rs, ...found.map((r) => ({ ...r, id: ++uid }))])
        setPages((ps) => ps.map((x) => (x.id === p.id ? { ...x, status: 'done', found: found.length } : x)))
      } catch (err) {
        const code = err instanceof Error ? err.message : 'ai_failed'
        setPages((ps) => ps.map((x) => (x.id === p.id ? { ...x, status: 'error' } : x)))
        setError(ERRORS[code] ?? ERRORS.ai_failed)
        setStage({ name: 'pick' })
        return
      }
    }
    setStage({ name: 'edit' })
  }

  const setRow = (id: number, patch: Partial<LedgerRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const totals = useMemo(() => {
    const inc = rows.filter((r) => r.kind === 'in').reduce((a, r) => a + r.amount, 0)
    const out = rows.filter((r) => r.kind === 'out').reduce((a, r) => a + r.amount, 0)
    const byItem = new Map<string, number>()
    rows.filter((r) => r.kind === 'out').forEach((r) => byItem.set(r.item, (byItem.get(r.item) ?? 0) + r.amount))
    return { inc, out, profit: inc - out, costs: [...byItem].sort((a, b) => b[1] - a[1]).slice(0, 6) }
  }, [rows])

  const analyse = () => {
    const income = rows.filter((r) => r.kind === 'in')
    const withDate = income.every((r) => r.date.trim())
    const table: Cell[][] = [['Дата', 'Товар', 'Количество', 'Сумма'], ...income.map((r) => [fullDate(r.date.trim()), r.item, r.qty ?? 1, r.amount] as Cell[])]
    const res = income.length
      ? buildSales(table, 0, withDate ? { date: 0, product: 1, qty: 2, amount: 3 } : { product: 1, qty: 2, amount: 3 }, {
          costPerUnit: true,
          currency,
          fileName: 'Тетрадь',
        })
      : null
    setStage({ name: 'done', data: res && res.ok ? res.data : null })
  }

  const reset = () => {
    setPages([])
    setRows([])
    setError(null)
    setStage({ name: 'pick' })
  }

  const fmt = (n: number) => fmtCur(n, currency)

  return (
    <div className="ws-body lg">
      <AnimatePresence mode="wait">
        {(stage.name === 'pick' || stage.name === 'read') && (
          <motion.div key="pick" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="lg-pick panel">
              <div className="lg-intro">
                <span className="drop-icon" aria-hidden="true">
                  <Icon name="camera" size={26} />
                </span>
                <div>
                  <p className="drop-title">Ведёте учёт в тетради? Сфотографируйте её</p>
                  <p className="muted small">ИИ перепишет приход и расход в таблицу — вы проверите и получите анализ. До {LEDGER_MAX_PAGES} страниц.</p>
                </div>
              </div>

              {pages.length > 0 && (
                <ul className="lg-pages" aria-label="Страницы">
                  {pages.map((p, i) => (
                    <li key={p.id} className={`is-${p.status}`}>
                      <img src={p.url} alt={`Страница ${i + 1}`} />
                      <span className="lg-page-state">
                        {p.status === 'busy' && <span className="spinner" aria-label="Читаем" />}
                        {p.status === 'done' && <>✓ {fmtInt(p.found ?? 0)} строк</>}
                        {p.status === 'error' && 'Не прочитана'}
                        {p.status === 'wait' && `Стр. ${i + 1}`}
                      </span>
                      {stage.name === 'pick' && p.status !== 'done' && (
                        <button type="button" aria-label={`Убрать страницу ${i + 1}`} onClick={() => setPages((ps) => ps.filter((x) => x.id !== p.id))}>
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <input ref={pickRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
              <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />

              {error && (
                <p className="mp-error" role="alert">
                  <Icon name="alert" size={16} /> {error}
                </p>
              )}

              <div className="lg-actions">
                {stage.name === 'read' ? (
                  <p className="lg-reading" role="status">
                    <span className="spinner" aria-hidden="true" /> Читаем страницу {pages.filter((p) => p.status === 'done').length + 1} из {pages.length}…
                  </p>
                ) : (
                  <>
                    <button type="button" className="btn btn-ghost" onClick={() => camRef.current?.click()}>
                      <Icon name="camera" size={16} /> Сфотографировать
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => pickRef.current?.click()}>
                      Выбрать фото
                    </button>
                    {pages.length === 0 && (
                      <button type="button" className="btn btn-ghost" onClick={trySample}>
                        Пример страницы
                      </button>
                    )}
                    {pages.some((p) => p.status !== 'done') && (
                      <button type="button" className="btn btn-primary" onClick={readAll}>
                        {pages.some((p) => p.status === 'error') ? 'Продолжить' : 'Распознать'} <span className="arrow">→</span>
                      </button>
                    )}
                    {rows.length > 0 && pages.every((p) => p.status === 'done') && (
                      <button type="button" className="btn btn-primary" onClick={() => setStage({ name: 'edit' })}>
                        К таблице <span className="arrow">→</span>
                      </button>
                    )}
                  </>
                )}
              </div>
              <p className="muted small">Фото отправляется в ИИ только для распознавания и не сохраняется.</p>
            </div>
          </motion.div>
        )}

        {stage.name === 'edit' && (
          <motion.div key="edit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="lg-edit panel">
              <div className="lg-edit-top">
                <div>
                  <b>Проверьте, что ИИ прочитал правильно</b>
                  <p className="muted small">Почерк бывает сложным — исправьте ошибки прямо в таблице.</p>
                </div>
                <label className="lg-cur">
                  <span className="muted small">Валюта</span>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {['₸', '₽', '$'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="lg-table-wrap">
                <table className="mp-table lg-table">
                  <thead>
                    <tr>
                      <th scope="col">Дата</th>
                      <th scope="col">Что</th>
                      <th scope="col" className="r">Кол-во</th>
                      <th scope="col" className="r">Сумма</th>
                      <th scope="col">Тип</th>
                      <th scope="col">
                        <span className="sr-only">Удалить</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className={r.kind === 'out' ? 'is-out' : ''}>
                        <td>
                          <input value={r.date} aria-label="Дата" placeholder="12.10" onChange={(e) => setRow(r.id, { date: e.target.value })} />
                        </td>
                        <td>
                          <input value={r.item} aria-label="Что" onChange={(e) => setRow(r.id, { item: e.target.value })} />
                        </td>
                        <td className="r">
                          <input
                            className="num"
                            inputMode="numeric"
                            value={r.qty ?? ''}
                            aria-label="Количество"
                            onChange={(e) => setRow(r.id, { qty: e.target.value === '' ? null : Number(e.target.value.replace(/\D/g, '')) || null })}
                          />
                        </td>
                        <td className="r">
                          <input
                            className="num"
                            inputMode="numeric"
                            value={r.amount}
                            aria-label="Сумма"
                            onChange={(e) => setRow(r.id, { amount: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                          />
                        </td>
                        <td>
                          <select value={r.kind} aria-label="Тип" onChange={(e) => setRow(r.id, { kind: e.target.value as LedgerKind })}>
                            <option value="in">Приход</option>
                            <option value="out">Расход</option>
                          </select>
                        </td>
                        <td>
                          <button type="button" className="fn-del" aria-label={`Удалить строку «${r.item}»`} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                            <Icon name="minus" size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="lg-edit-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((rs) => [...rs, { id: ++uid, date: rs[rs.length - 1]?.date ?? '', item: '', qty: null, amount: 0, kind: 'in' }])}>
                  <Icon name="plus" size={14} /> Строка
                </button>
                <span className="muted small num">
                  Приход {fmt(totals.inc)} · Расход {fmt(totals.out)}
                </span>
                <div className="lg-edit-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStage({ name: 'pick' })}>
                    Ещё страницы
                  </button>
                  <button type="button" className="btn btn-primary" disabled={!rows.some((r) => r.amount > 0)} onClick={analyse}>
                    Анализировать <span className="arrow">→</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {stage.name === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="lg-done">
            <div className="lg-money panel">
              <div className="kpi">
                <span className="kpi-label">Приход</span>
                <span className="kpi-value">{fmt(totals.inc)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Расход</span>
                <span className="kpi-value">{fmt(totals.out)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Прибыль</span>
                <span className={`kpi-value ${totals.profit < 0 ? 'is-bad' : 'is-good'}`}>{fmt(totals.profit)}</span>
                <span className="kpi-sub">{totals.inc > 0 ? `${((totals.profit / totals.inc) * 100).toFixed(0)}% от прихода` : 'нет прихода'}</span>
              </div>
              {totals.costs.length > 0 && (
                <div className="lg-costs">
                  <span className="kpi-label">Куда уходят деньги</span>
                  <ul className="exp">
                    {totals.costs.map(([name, v]) => (
                      <li key={name}>
                        <div className="exp-row">
                          <span>{name}</span>
                          <span className="num">{fmt(v)}</span>
                        </div>
                        <div className="exp-track">
                          <span style={{ width: `${(v / totals.costs[0][1]) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {stage.data ? (
              <SalesDashboard data={stage.data} onReset={reset} resetLabel="Новая тетрадь" />
            ) : (
              <div className="lg-noincome panel">
                <p>В записях нет прихода — показаны только расходы.</p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                  Новая тетрадь
                </button>
              </div>
            )}
            <button type="button" className="btn btn-ghost btn-sm lg-back" onClick={() => setStage({ name: 'edit' })}>
              ← Исправить строки
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
