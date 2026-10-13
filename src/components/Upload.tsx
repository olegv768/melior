import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { SalesData } from '../../shared/marketplace'
import { FIELDS, MAX_FILE_MB, buildSales, downloadText, findHeaderRow, guessMapping, readWorkbook, sampleSalesCsv, validateMapping } from '../lib/table'
import type { Cell, FieldKey, Mapping, Sheet } from '../lib/table'
import SectionHead from './ui/SectionHead'
import Icon from './ui/Icon'
import SalesDashboard from './SalesDashboard'
import './Upload.css'

type Stage =
  | { name: 'drop'; error?: string }
  | { name: 'reading'; file: string }
  | { name: 'map'; file: string; sheets: Sheet[] }
  | { name: 'done'; data: SalesData }

const CURRENCIES = ['₸', '₽', '$', '€']
const REQUIRED: FieldKey[] = ['amount']
const cellText = (c: Cell) => (c instanceof Date ? c.toLocaleString('ru-RU') : c === null ? '' : String(c))

export default function Upload() {
  const [stage, setStage] = useState<Stage>({ name: 'drop' })
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function open(file: File) {
    if (!/\.(xlsx|xlsm|xls|csv|txt)$/i.test(file.name)) {
      setStage({ name: 'drop', error: 'Поддерживаются файлы .xlsx, .xls и .csv' })
      return
    }
    setStage({ name: 'reading', file: file.name })
    try {
      const sheets = await readWorkbook(file)
      if (!sheets.length) throw new Error('В файле нет данных')
      setStage({ name: 'map', file: file.name, sheets })
    } catch (e) {
      setStage({ name: 'drop', error: e instanceof Error ? `Не удалось прочитать файл: ${e.message}` : 'Не удалось прочитать файл' })
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) open(f)
  }
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) open(f)
    e.target.value = ''
  }

  return (
    <section className="section up" id="upload" aria-labelledby="up-title">
      <div className="container">
        <SectionHead
          eyebrow="Ваши данные"
          title={<span id="up-title">Загрузите таблицу продаж</span>}
          lead="Excel или CSV из кассы, 1С, Kaspi или своей таблицы. Файл обрабатывается в браузере и никуда не отправляется."
        />

        <AnimatePresence mode="wait">
          {(stage.name === 'drop' || stage.name === 'reading') && (
            <motion.div key="drop" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div
                className={`drop panel ${drag ? 'is-drag' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDrag(true)
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
              >
                <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls,.csv,.txt" hidden onChange={onPick} />
                <span className="drop-icon" aria-hidden="true">
                  <Icon name="flow" size={26} />
                </span>
                {stage.name === 'reading' ? (
                  <p role="status">
                    <span className="spinner" aria-hidden="true" /> Читаем «{stage.file}»…
                  </p>
                ) : (
                  <>
                    <p className="drop-title">Перетащите файл сюда</p>
                    <p className="muted small">.xlsx, .xls, .csv · до {MAX_FILE_MB} МБ</p>
                    <div className="drop-actions">
                      <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()}>
                        Выбрать файл
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => downloadText('пример_продаж.csv', sampleSalesCsv())}>
                        Скачать пример таблицы
                      </button>
                    </div>
                  </>
                )}
                {stage.name === 'drop' && stage.error && (
                  <p className="mp-error" role="alert">
                    <Icon name="alert" size={16} /> {stage.error}
                  </p>
                )}
              </div>
              <p className="muted small up-hint">Нужны колонки с суммой (или ценой и количеством) и датой или товаром. Себестоимость, категория, клиент и статус — по желанию.</p>
            </motion.div>
          )}

          {stage.name === 'map' && (
            <motion.div key="map" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <MapStep
                file={stage.file}
                sheets={stage.sheets}
                onCancel={() => setStage({ name: 'drop' })}
                onDone={(data) => setStage({ name: 'done', data })}
              />
            </motion.div>
          )}

          {stage.name === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <SalesDashboard data={stage.data} onReset={() => setStage({ name: 'drop' })} resetLabel="Загрузить другой файл" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

function MapStep({ file, sheets, onCancel, onDone }: { file: string; sheets: Sheet[]; onCancel: () => void; onDone: (d: SalesData) => void }) {
  const [sheetIdx, setSheetIdx] = useState(() => {
    const i = sheets.findIndex((s) => s.rows.length > 1)
    return i < 0 ? 0 : i
  })
  const rows = sheets[sheetIdx].rows
  const headerRow = useMemo(() => findHeaderRow(rows), [rows])
  const headers = useMemo(() => (rows[headerRow] ?? []).map((c, i) => cellText(c) || `Колонка ${i + 1}`), [rows, headerRow])
  const [mapping, setMapping] = useState<Mapping>(() => guessMapping(headers))
  const [currency, setCurrency] = useState('₸')
  const [costPerUnit, setCostPerUnit] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const changeSheet = (i: number) => {
    setSheetIdx(i)
    const r = sheets[i].rows
    const h = (r[findHeaderRow(r)] ?? []).map((c, k) => cellText(c) || `Колонка ${k + 1}`)
    setMapping(guessMapping(h))
    setError(null)
  }

  const setField = (key: FieldKey, v: string) => {
    setMapping((m) => {
      const next = { ...m }
      if (v === '') delete next[key]
      else next[key] = Number(v)
      return next
    })
    setError(null)
  }

  const run = () => {
    const err = validateMapping(mapping)
    if (err) {
      setError(err)
      return
    }
    const res = buildSales(rows, headerRow, mapping, { costPerUnit, currency, fileName: file })
    if (!res.ok) setError(res.error)
    else onDone(res.data)
  }

  const preview = rows.slice(headerRow + 1, headerRow + 6)
  const dataRows = Math.max(0, rows.length - headerRow - 1)

  return (
    <div className="map panel">
      <div className="map-top">
        <div>
          <b>{file}</b>
          <span className="muted small"> · {dataRows.toLocaleString('ru-RU')} строк</span>
        </div>
        {sheets.length > 1 && (
          <label className="map-sheet">
            <span className="muted small">Лист</span>
            <select value={sheetIdx} onChange={(e) => changeSheet(Number(e.target.value))}>
              {sheets.map((s, i) => (
                <option key={s.name} value={i}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="map-preview">
        <table className="mp-table">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} scope="col" className={Object.values(mapping).includes(i) ? 'is-mapped' : ''}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((r, i) => (
              <tr key={i}>
                {headers.map((_, k) => (
                  <td key={k}>{cellText(r[k] ?? null)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="map-grid">
        {FIELDS.map((f) => (
          <label key={f.key} className="map-field">
            <span>
              {f.label}
              {REQUIRED.includes(f.key) && f.key === 'amount' && <span className="muted"> · или цена</span>}
            </span>
            <select value={mapping[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)}>
              <option value="">— нет —</option>
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="map-field">
          <span>Валюта</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        {mapping.cost !== undefined && (
          <label className="map-field">
            <span>Себестоимость указана</span>
            <select value={costPerUnit ? 'unit' : 'row'} onChange={(e) => setCostPerUnit(e.target.value === 'unit')}>
              <option value="unit">за единицу</option>
              <option value="row">за всю строку</option>
            </select>
          </label>
        )}
      </div>

      {error && (
        <p className="mp-error" role="alert">
          <Icon name="alert" size={16} /> {error}
        </p>
      )}

      <div className="map-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Другой файл
        </button>
        <button type="button" className="btn btn-primary" onClick={run}>
          Анализировать <span className="arrow">→</span>
        </button>
      </div>
    </div>
  )
}
