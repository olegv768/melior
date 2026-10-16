export const SITE = {
  name: 'Melior',
  repo: 'https://github.com/olegv768/melior',
  city: 'Тараз, Казахстан',
  event: 'Zhambyl Hub · AI for SME & Local Business',
}

export const TABS = [
  { id: 'upload', label: 'Таблица', sub: 'Excel или CSV' },
  { id: 'marketplaces', label: 'Маркетплейсы', sub: 'Kaspi · WB · Ozon' },
  { id: 'funnel', label: 'Воронка', sub: 'Этапы продаж' },
  { id: 'audit', label: 'Малый бизнес', sub: 'Тетрадь или 4 вопроса' },
] as const

export type TabId = (typeof TABS)[number]['id']

/** fired when the workspace switches tab (the nav highlights it) */
export const TAB_EVENT = 'melior:tab'

export const NAV = TABS

