import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import SectionHead from './ui/SectionHead'
import Reveal from './ui/Reveal'
import Icon from './ui/Icon'
import './Sections.css'

const QA = [
  {
    q: 'Куда уходит мой файл?',
    a: 'Никуда: таблица читается прямо в браузере. На сервер (в ИИ) уходят только итоговые цифры, и только если нажать «Получить рекомендации».',
  },
  {
    q: 'Какие данные нужны для анализа?',
    a: 'Для начала хватит анкеты. Для подробного анализа — выгрузки из кассы, таблицы или кабинета маркетплейса.',
  },
  {
    q: 'Это настоящий ИИ или заготовленные ответы?',
    a: 'Да, через Groq (модель GPT-OSS).',
  },
  {
    q: 'Как защищены данные?',
    a: 'Персональные данные клиентов не нужны. Ключи маркетплейсов не сохраняются.',
  },
  {
    q: 'Нужно ли менять учётную систему?',
    a: 'Нет, Melior работает с тем, что уже есть.',
  },
  {
    q: 'Подходит ли сервис очень маленькому бизнесу?',
    a: 'Да, советы учитывают размер команды.',
  },
  {
    q: 'Сколько времени занимает анализ?',
    a: 'Аудит по анкете — около двух минут.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section className="section faq" aria-labelledby="faq-title">
      <div className="container faq-grid">
        <SectionHead eyebrow="FAQ" title={<span id="faq-title">Частые вопросы</span>} />
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
