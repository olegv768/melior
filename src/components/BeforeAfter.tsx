import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import SectionHead from './ui/SectionHead'
import Reveal from './ui/Reveal'
import './Sections.css'

type Item = {
  id: string
  before: { label: string; sub: string; x: number; y: number; r: number }
  after: { label: string; sub: string; col: number; row: number; w: number }
}

// before: scattered (percent positions); after: placement on a 4×3 grid
const ITEMS: Item[] = [
  { id: 'a', before: { label: 'Тетрадь учёта', sub: 'записи от руки', x: 3, y: 6, r: -7 }, after: { label: 'Выручка', sub: 'по дням и категориям', col: 1, row: 1, w: 2 } },
  { id: 'b', before: { label: 'отчёт_v7_финал.xlsx', sub: 'три версии файла', x: 54, y: 2, r: 5 }, after: { label: 'Расходы по статьям', sub: 'план и факт', col: 3, row: 1, w: 2 } },
  { id: 'c', before: { label: 'Чеки в коробке', sub: 'не сверены', x: 28, y: 37, r: -3 }, after: { label: 'Остатки', sub: 'оборачиваемость', col: 1, row: 2, w: 1 } },
  { id: 'd', before: { label: 'Заказы в WhatsApp', sub: 'часть без ответа', x: 60, y: 44, r: 8 }, after: { label: 'Заявки', sub: 'единая очередь', col: 2, row: 2, w: 1 } },
  { id: 'e', before: { label: 'Звонки поставщикам', sub: 'каждый день вручную', x: 4, y: 70, r: 4 }, after: { label: 'Автозаказ', sub: 'по прогнозу спроса', col: 3, row: 2, w: 2 } },
  { id: 'f', before: { label: 'Расходы «на глаз»', sub: 'итог в конце месяца', x: 48, y: 74, r: -6 }, after: { label: 'Сводка владельцу', sub: 'каждый вечер в 23:00', col: 1, row: 3, w: 4 } },
]

const ROWS: [string, string][] = [
  ['Ручной учёт', 'Централизованная аналитика'],
  ['Разрозненные данные', 'Понятные показатели'],
  ['Лишние операции', 'Автоматизированные повторяющиеся задачи'],
  ['Непрозрачные расходы', 'Контролируемые операционные расходы'],
]

export default function BeforeAfter() {
  const [after, setAfter] = useState(false)
  return (
    <section className="section ba" aria-labelledby="ba-title">
      <div className="container">
        <SectionHead
          eyebrow="До и после"
          title={<span id="ba-title">Как меняется работа бизнеса</span>}
        />
        <Reveal>
          <div className="ba-wrap panel">
            <div className="ba-switch" role="tablist" aria-label="Состояние бизнеса">
              <button type="button" role="tab" aria-selected={!after} className={!after ? 'is-on' : ''} onClick={() => setAfter(false)}>
                {!after && <motion.span layoutId="ba-pill" className="ba-pill is-before" />}
                <span>До оптимизации</span>
              </button>
              <button type="button" role="tab" aria-selected={after} className={after ? 'is-on' : ''} onClick={() => setAfter(true)}>
                {after && <motion.span layoutId="ba-pill" className="ba-pill is-after" />}
                <span>После</span>
              </button>
            </div>

            <div className="ba-body">
              <div className={`ba-board ${after ? 'is-after' : ''}`} aria-hidden="true">
                {ITEMS.map((it) => {
                  const s = after ? it.after : it.before
                  const pos = after
                    ? {
                        left: `${((it.after.col - 1) / 4) * 100}%`,
                        top: `${((it.after.row - 1) / 3) * 100}%`,
                        width: `${(it.after.w / 4) * 100}%`,
                        height: `${100 / 3}%`,
                        rotate: 0,
                      }
                    : { left: `${it.before.x}%`, top: `${it.before.y}%`, width: '40%', height: '24%', rotate: it.before.r }
                  return (
                    <motion.div key={it.id} className="ba-item" initial={false} animate={pos} transition={{ type: 'spring', stiffness: 110, damping: 19 }}>
                      <div className={`ba-card ${after ? 'is-after' : ''}`}>
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.div
                            key={after ? 'after' : 'before'}
                            className="ba-card-in"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                          >
                            <b>{s.label}</b>
                            <span>{s.sub}</span>
                          </motion.div>
                        </AnimatePresence>
                        {after && <i className="ba-bars" />}
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              <ul className="ba-list">
                {ROWS.map(([b, a]) => (
                  <li key={b} className={after ? 'is-after' : ''}>
                    <span className="ba-mark" aria-hidden="true" />
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={after ? a : b}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 6 }}
                        transition={{ duration: 0.22 }}
                      >
                        {after ? a : b}
                      </motion.span>
                    </AnimatePresence>
                  </li>
                ))}
                <li className="ba-disclaimer">
                  Эффект зависит от внедрения. Экономию не обещаем.
                </li>
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
