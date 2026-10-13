export type NodeId = 'core' | 'finance' | 'sales' | 'staff' | 'stock' | 'auto'

export type SystemNode = {
  id: NodeId
  label: string
  desc: string
  signal: string
  /** position in scene units */
  pos: [number, number, number]
  /** label placement relative to the node */
  side: 'left' | 'right'
}

export const NODES: SystemNode[] = [
  {
    id: 'finance',
    label: 'Финансы',
    desc: 'Маржа по категориям, структура расходов, денежный поток.',
    signal: 'Расходы на аренду и связь растут быстрее выручки',
    pos: [-2.15, 1.25, 0.2],
    side: 'left',
  },
  {
    id: 'sales',
    label: 'Продажи',
    desc: 'Выручка, средний чек, упущенные продажи и сезонность.',
    signal: 'Средний чек вечером ниже на 18% (пример)',
    pos: [2.05, 1.45, -0.4],
    side: 'right',
  },
  {
    id: 'staff',
    label: 'Сотрудники',
    desc: 'Загрузка смен, пиковые часы, время на ручные операции.',
    signal: 'Утренняя смена перегружена, вечерняя — простаивает',
    pos: [-2.35, -0.95, -0.5],
    side: 'left',
  },
  {
    id: 'stock',
    label: 'Склад',
    desc: 'Остатки, оборачиваемость, списания и точность закупок.',
    signal: '14% позиций не продаются дольше 30 дней (пример)',
    pos: [2.3, -0.85, 0.35],
    side: 'right',
  },
  {
    id: 'auto',
    label: 'Автоматизация',
    desc: 'Повторяющиеся задачи: заявки, документы, напоминания.',
    signal: '≈ 9 ч в неделю уходит на ручной ввод заказов (пример)',
    pos: [0.15, -2.0, 0.6],
    side: 'right',
  },
]

export const CORE: SystemNode = {
  id: 'core',
  label: 'Ядро анализа',
  desc: 'Связывает данные всех участков и ищет причины потерь, а не только симптомы.',
  signal: 'Закупки не учитывают фактический спрос → растут списания',
  pos: [0, 0, 0],
  side: 'right',
}

/** extra cross-links between business areas (besides node → core) */
export const LINKS: [NodeId, NodeId][] = [
  ['finance', 'sales'],
  ['sales', 'stock'],
  ['stock', 'auto'],
  ['staff', 'auto'],
  ['finance', 'staff'],
]
