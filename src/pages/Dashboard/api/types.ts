// src/pages/Dashboard/api/types.ts
// =====================================================
// ✅ Qaysi page(lar) ishlatadi?
// - src/pages/Dashboard/overview/OverviewDashboardPage.tsx
// - src/pages/Dashboard/api/dashboardApi.ts
// =====================================================

export type ChartRange = "1W" | "1M" | "3M" | "1Y"
export type FilterRange = "today" | "week" | "month" | "year"

export type DashboardFilter = {
  range?: FilterRange
  date?: string // YYYY-MM-DD
  currency?: string
}

export type StatTone = "neutral" | "success" | "danger"

export type Kpi = {
  title: string
  value: string | number
  sub: string
  icon?: string
  tone?: StatTone
  deltaPercent?: number // ✅ +12.5 / -3.1
}

export type ChartPoint = {
  label: string
  value: number
}

/**
 * ✅ Default dashboard recent table:
 * - SALE     -> sotuv
 * - MOVE_IN  -> ombor kirim (IN/ADJUST)
 * - MOVE_OUT -> ombor chiqim (OUT/WASTE)
 */
export type RecentRow = {
  id: number | string
  name: string
  qty: number
  meta?: string
  amount: number
  date: string // YYYY-MM-DD
  type: "SALE" | "MOVE_IN" | "MOVE_OUT" | "PAYMENT_IN" | "PAYMENT_OUT"
}

export type OverviewSummaryResponse = {
  salesKpis: Kpi[]
  skladKpis: Kpi[]
  salesSeries: ChartPoint[]
  skladSeries: ChartPoint[]
  rows: RecentRow[]
}

export type RecentQuery = {
  page: number
  pageSize: number
  q?: string
  sortKey?: "name" | "qty" | "amount" | "date" | "type"
  sortDir?: "asc" | "desc"
  // filterbar
  range?: FilterRange
  date?: string
  currency?: string
}
