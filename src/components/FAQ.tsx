import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import SectionHead from './ui/SectionHead'
import Reveal from './ui/Reveal'
import Icon from './ui/Icon'
import './Sections.css'

const QA = [
  {
    q: 'Какие данные нужны для анализа?',
    a: 'Для первичного аудита достаточно ответов на вопросы анкеты. Для подробного анализа подойдут выгрузка продаж из кассы, таблица расходов, банковская выписка или список заявок — в том виде, в каком они уже есть.',
  },
  {
    q: 'Это настоящий ИИ или заготовленные ответы?',
    a: 'Если на сайте подключена модель ИИ, отчёт генерируется по вашим ответам и помечается «ИИ-анализ». Если нет — сайт работает в демонстрационном режиме и прямо об этом сообщает: отчёт собирается из подготовленных сценариев.',
  },
  {
    q: 'Гарантируете ли вы экономию?',
    a: 'Нет. Мы показываем ориентир и конкретные действия, но итог зависит от данных бизнеса и от того, что будет внедрено. Любые цифры в демонстрации — примерные.',
  },
  {
    q: 'Как защищены данные?',
    a: 'Анкета не требует персональных данных клиентов. Ключ к модели ИИ хранится только на сервере, ответы анкеты используются только для подготовки отчёта и не публикуются.',
  },
  {
    q: 'Нужно ли менять учётную систему?',
    a: 'Нет. Melior работает поверх того, что уже используется: касса, таблицы, мессенджеры, банк. Новые инструменты предлагаются только там, где они действительно экономят время.',
  },
  {
    q: 'Подходит ли сервис очень маленькому бизнесу?',
    a: 'Да. Отчёт учитывает размер команды: для бизнеса из 1–3 человек рекомендации ограничены простыми инструментами без отдельного администратора.',
  },
  {
    q: 'Сколько времени занимает анализ?',
    a: 'Первичный аудит по анкете — около двух минут вместе с заполнением. Анализ загруженных данных занимает больше времени и зависит от их объёма.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section className="section faq" aria-labelledby="faq-title">
      <div className="container faq-grid">
        <SectionHead eyebrow="FAQ" title={<span id="faq-title">Частые вопросы</span>} lead="Коротко о данных, точности и том, как работает сервис." />
        <Reveal>
          <ul className="faq-list">
            {QA.map((item, i) => {
              const isOpen = open === i
              return (
                <li key={item.q} className={isOpen ? 'is-open' : ''}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`faq-a-${i}`}
                      id={`faq-q-${i}`}
                      onClick={() => setOpen(isOpen ? null : i)}
                    >
                      <span>{item.q}</span>
                      <span className="faq-icon" aria-hidden="true">
                        <Icon name="plus" size={16} />
                      </span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-a-${i}`}
                        role="region"
                        aria-labelledby={`faq-q-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="faq-a"
                      >
                        <p>{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              )
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
