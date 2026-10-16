import { useState } from 'react'
import { motion } from 'framer-motion'
import Ledger from './Ledger'
import type { LedgerPlan } from './Ledger'
import Audit from './Audit'
import type { AuditPrefill } from './Audit'
import Icon from './ui/Icon'

type Mode = 'ledger' | 'audit'

/** «Малый бизнес»: a photo of the paper ledger, or four questions when there are no records at all. */
export default function SmallBiz() {
  const [mode, setMode] = useState<Mode>('ledger')
  const [prefill, setPrefill] = useState<AuditPrefill | undefined>()

  const toPlan = (p: LedgerPlan) => {
    setPrefill({ ...p, key: Date.now() })
    setMode('audit')
  }

  return (
    <div className="ws-body sb">
      <div className="sb-switch" role="tablist" aria-label="Как начать">
        {(
          [
            { id: 'ledger', icon: 'camera', title: 'Есть тетрадь', sub: 'Сфотографируйте записи' },
            { id: 'audit', icon: 'form', title: 'Записей нет', sub: 'Ответьте на 4 вопроса' },
          ] as const
        ).map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'is-on' : ''} onClick={() => setMode(m.id)}>
            {mode === m.id && <motion.span layoutId="sb-pill" className="sb-pill" />}
            <Icon name={m.icon} size={20} />
            <span>
              <b>{m.title}</b>
              <span>{m.sub}</span>
            </span>
          </button>
        ))}
      </div>

      <div hidden={mode !== 'ledger'}>
        <Ledger onPlan={toPlan} />
      </div>
      <div hidden={mode !== 'audit'}>
        <Audit prefill={prefill} />
      </div>
    </div>
  )
}
