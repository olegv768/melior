import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { BusinessType } from '../../shared/audit'
import SectionHead from './ui/SectionHead'
import Reveal from './ui/Reveal'
import Icon from './ui/Icon'
import { PREFILL_EVENT } from '../config'
import './Sections.css'

const INDUSTRIES: {
  id: BusinessType
  name: string
  analyse: string[]
  losses: string[]
  data: string[]
}[] = [
  {
    id: 'cafe',
    name: 'Кафе',
    analyse: ['Фудкост и маржа каждого блюда', 'Списания продуктов по причинам', 'Загрузка персонала по часам', 'Закупки и цены поставщиков'],
    losses: ['Блюда, которые продаются, но не зарабатывают', 'Заготовки, уходящие в списание', 'Лишние смены в тихие часы'],
    data: ['Продажи из кассы', 'Техкарты', 'Накладные', 'График смен'],
  },
  {
    id: 'shop',
    name: 'Магазин',
    analyse: ['Продажи и маржа по категориям', 'Остатки и оборачиваемость', 'Точность закупок', 'Упущенные продажи'],
    losses: ['Деньги, замороженные в залежавшемся товаре', 'Нехватка ходовых позиций', 'Просрочка и списания'],
    data: ['Продажи из кассы', 'Остатки', 'Поставки', 'Выписка банка'],
  },
  {
    id: 'salon',
    name: 'Салон красоты',
    analyse: ['Загрузка мастеров и кабинетов', 'Неявки и отмены', 'Повторные визиты', 'Расход материалов'],
    losses: ['Пустые окна в расписании', 'Клиенты, не пришедшие повторно', 'Перерасход материалов'],
    data: ['Журнал записи', 'Прайс-лист', 'График мастеров'],
  },
  {
    id: 'company',
    name: 'Небольшая компания',
    analyse: ['Путь заявки от обращения до оплаты', 'Повторяющиеся документы', 'Сроки задач и согласований', 'Дебиторская задолженность'],
    losses: ['Заявки без ответа', 'Часы на ручную подготовку документов', 'Поздние оплаты счетов'],
    data: ['Список заявок', 'Шаблоны документов', 'Счета и оплаты'],
  },
  {
    id: 'online',
    name: 'Онлайн-бизнес',
    analyse: ['Конверсия на каждом шаге воронки', 'Окупаемость рекламных каналов', 'Время ответа клиентам', 'Повторные покупки'],
    losses: ['Реклама без продаж', 'Брошенные диалоги и корзины', 'Клиенты, не вернувшиеся за повторной покупкой'],
    data: ['Заказы', 'Расходы на рекламу', 'Статистика переписок'],
  },
]

export default function Industries() {
  const [active, setActive] = useState(0)
  const ind = INDUSTRIES[active]

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (active + (e.key === 'ArrowRight' ? 1 : -1) + INDUSTRIES.length) % INDUSTRIES.length
    setActive(next)
    document.getElementById(`ind-tab-${next}`)?.focus()
  }

  const prefill = () => {
    window.dispatchEvent(new CustomEvent(PREFILL_EVENT, { detail: { businessType: ind.id } }))
    document.getElementById('audit')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="section ind" id="industries" aria-labelledby="ind-title">
      <div className="container">
        <SectionHead
          eyebrow="Для бизнеса"
          title={<span id="ind-title">Понимает специфику вашей отрасли</span>}
          lead="У кафе и салона разные потери."
        />
        <Reveal>
          <div className="ind-wrap">
            <div className="ind-tabs" role="tablist" aria-label="Тип бизнеса" onKeyDown={onKey}>
              {INDUSTRIES.map((x, i) => (
                <button
                  key={x.id}
                  id={`ind-tab-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-controls="ind-panel"
                  tabIndex={i === active ? 0 : -1}
                  className={i === active ? 'is-on' : ''}
                  onClick={() => setActive(i)}
                >
                  <Icon name={x.id} size={18} />
                  <span>{x.name}</span>
                  {i === active && <motion.span layoutId="ind-active" className="ind-active" />}
                </button>
              ))}
            </div>

            <div className="ind-panel panel" id="ind-panel" role="tabpanel" aria-labelledby={`ind-tab-${active}`}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={ind.id}
                  className="ind-grid"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="ind-col">
                    <h3>Что анализируем</h3>
                    <ul>
                      {ind.analyse.slice(0, 3).map((a) => (
                        <li key={a}>
                          <Icon name="check" size={16} /> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="ind-col">
                    <h3>Типичные потери</h3>
                    <ul className="is-loss">
                      {ind.losses.map((a) => (
                        <li key={a}>
                          <span className="ind-dash" /> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="ind-col ind-side">
                    <h3>Что понадобится</h3>
                    <div className="ind-data">
                      {ind.data.map((d) => (
                        <span className="chip" key={d}>
                          {d}
                        </span>
                      ))}
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" onClick={prefill}>
                      Проанализировать: {ind.name.toLowerCase()} <span className="arrow">→</span>
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
