import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import Upload from './Upload'
import Marketplaces from './Marketplaces'
import Funnel from './Funnel'
import SmallBiz from './SmallBiz'
import Icon from './ui/Icon'
import type { IconName } from './ui/Icon'
import { TAB_EVENT, TABS } from '../config'
import type { TabId } from '../config'
import './Workspace.css'

const ICONS: Record<TabId, IconName> = { upload: 'table', marketplaces: 'store', funnel: 'funnel', audit: 'camera' }

const fromHash = (): TabId | null => {
  let h = window.location.hash.slice(1)
  if (h === 'ledger') h = 'audit' // old link to the notebook tab
  return TABS.some((t) => t.id === h) ? (h as TabId) : null
}

/** All analysis tools in one place; panels stay mounted so loaded data survives tab switches. */
export default function Workspace() {
  const [tab, setTab] = useState<TabId>(() => (typeof window === 'undefined' ? 'upload' : fromHash() ?? 'upload'))
  const rootRef = useRef<HTMLElement>(null)

  const select = (id: TabId, scroll: boolean) => {
    setTab(id)
    history.replaceState(null, '', `#${id}`)
    window.dispatchEvent(new CustomEvent(TAB_EVENT, { detail: id }))
    if (scroll) rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // links like #funnel in the hero / nav open the matching tab
  useEffect(() => {
    const onHash = () => {
      const id = fromHash()
      if (id) select(id, true)
    }
    window.addEventListener('hashchange', onHash)
    // opened with #funnel etc.: wait for layout (3D hero, fonts) before jumping
    const t = fromHash() ? window.setTimeout(() => rootRef.current?.scrollIntoView({ block: 'start' }), 350) : 0
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.clearTimeout(t)
    }
  }, [])

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const i = TABS.findIndex((t) => t.id === tab)
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length].id
    select(next, false)
    document.getElementById(`ws-tab-${next}`)?.focus()
  }

  return (
    <section className="ws" id="workspace" ref={rootRef} aria-labelledby="ws-title">
      <div className="container">
        <div className="ws-head">
          <div>
            <span className="eyebrow">Анализ</span>
            <h2 id="ws-title">Что анализируем?</h2>
          </div>
          <p className="ws-privacy">
            <Icon name="check" size={14} /> Файлы читаются в браузере. ИИ получает только итоговые цифры.
          </p>
        </div>

        <div className="ws-tabs" role="tablist" aria-label="Инструменты" onKeyDown={onKey}>
          {TABS.map((t, i) => (
            <button
              key={t.id}
              id={`ws-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={t.id}
              tabIndex={tab === t.id ? 0 : -1}
              className={tab === t.id ? 'is-on' : ''}
              onClick={() => select(t.id, false)}
            >
              {tab === t.id && <motion.span layoutId="ws-tab" className="ws-tab-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <span className="ws-tab-icon" aria-hidden="true">
                <Icon name={ICONS[t.id]} size={18} />
              </span>
              <span className="ws-tab-text">
                <b>{t.label}</b>
                <span>{t.sub}</span>
              </span>
              <span className="ws-tab-n mono" aria-hidden="true">
                0{i + 1}
              </span>
            </button>
          ))}
        </div>

        {TABS.map((t) => (
          <div key={t.id} id={t.id} role="tabpanel" aria-labelledby={`ws-tab-${t.id}`} hidden={tab !== t.id} className="ws-panel">
            {t.id === 'upload' && <Upload />}
            {t.id === 'marketplaces' && <Marketplaces />}
            {t.id === 'funnel' && <Funnel />}
            {t.id === 'audit' && <SmallBiz />}
          </div>
        ))}
      </div>
    </section>
  )
}
