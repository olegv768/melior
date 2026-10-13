import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Logo from './ui/Logo'
import { NAV, TAB_EVENT } from '../config'
import './Nav.css'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<string>('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const sync = () => setActive(window.location.hash.slice(1))
    const onTab = (e: Event) => setActive((e as CustomEvent<string>).detail)
    sync()
    window.addEventListener('hashchange', sync)
    window.addEventListener(TAB_EVENT, onTab)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener(TAB_EVENT, onTab)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header className={`nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="container nav-inner">
        <a href="#top" className="nav-logo" aria-label="Melior — на главную" onClick={() => setOpen(false)}>
          <Logo />
          <span>Melior</span>
        </a>

        <nav className="nav-links" aria-label="Основная навигация">
          {NAV.map((item) => (
            <a key={item.id} href={`#${item.id}`} className={active === item.id ? 'is-active' : ''}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="nav-actions">
          <a href="#upload" className="btn btn-primary btn-sm nav-cta">
            Загрузить данные
          </a>
          <button
            className="nav-burger"
            aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className={open ? 'is-open' : ''} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="nav-mobile"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {NAV.map((item, i) => (
              <motion.a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setOpen(false)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i }}
              >
                {item.label}
              </motion.a>
            ))}
            <a href="#upload" className="btn btn-primary" onClick={() => setOpen(false)}>
              Загрузить данные
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
