import {
  fetchAllOrders as fetchAllOrdersRequest,
  isOrderStatus,
  normalizeOrderStatus,
  ORDER_STATUS_VALUES,
  type KnownOrderStatus,
  type OrderSummary,
  type OrdersListParams,
} from "@/pages/orders/api/ordersApi"
import { http } from "@/shared/http"

export type SalesDashboardFilterRange = "today" | "week" | "month"
export type SalesDashboardChartRange = "1W" | "1M" | "3M" | "1Y"
export type SalesStageKey = KnownOrderStatus

export type SalesDashboardFilter = {
  range: SalesDashboardFilterRange
  date: string
}

export type SalesTrendPoint = {
  label: string
  revenue: number
  paid: number
  orders: number
}

export type SalesStageMetric = {
  key: SalesStageKey
  count: number
  amount: number
}

export type SalesClientInsight = {
  name: string
  totalRevenue: number
  orderCount: number
}

export type SalesDashboardSnapshot = {
  totals: {
    revenue: number
    paid: number
    remaining: number
    grossProfit: number
    cogs: number
    averageCheck: number
    collectionRate: number
    orderCount: number
    unpaidCount: number
    partialCount: number
    paidCount: number
  }
  chart: SalesTrendPoint[]
  stageMetrics: SalesStageMetric[]
  recentOrders: OrderSummary[]
  topClients: SalesClientInsight[]
  largestOrder: OrderSummary | null
  profitabilityAvailable: boolean
  generatedAt: string
}

type ProfitabilityResponse = Record<string, any>
type SalesSummaryResponse = Record<string, any>
type DateWindow = { date_from: string; date_to: string }

const SUMMARY_ENDPOINTS = ["/api/v1/dashboard/sales/summary/", "/api/v1/dashboard/sales/summary"]
const PROFITABILITY_ENDPOINTS = ["/api/v1/dashboard/sales/profitability/", "/api/v1/dashboard/sales/profitability"]

function isNotFound(error: any) {
  return Number(error?.response?.status || 0) === 404
}

async function withEndpointFallback<T>(candidates: string[], params?: Record<string, unknown>) {
  let lastError: unknown = null

  for (const url of candidates) {
    try {
      return await http.get<T>(url, params)
    } catch (error: any) {
      if (!isNotFound(error)) throw error
      lastError = error
    }
  }

  throw lastError ?? new Error("Endpoint topilmadi")
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeStatus(value: unknown): SalesStageKey {
  const status = normalizeOrderStatus(value)
  return isOrderStatus(status) ? status : "NEW"
}

function hasKnownOrderStatus(row: OrderSummary) {
  return isOrderStatus(row.status)
}

function normalizePaymentStatus(value: unknown) {
  const status = String(value ?? "").trim().toUpperCase()
  if (status === "PAID") return "PAID"
  if (status === "PARTIAL" || status === "PARTIALLY_PAID") return "PARTIAL"
  return "UNPAID"
}

function safeText(value: unknown, fallback = "") {
  const normalized = String(value ?? "").trim()
  return normalized || fallback
}

function parseDate(value?: string | null) {
  if (!value) return null
  const raw = safeText(value).slice(0, 10)
  const parsed = new Date(`${raw}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function todayISO() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function shiftDate(isoDate: string, days: number) {
  const date = parseDate(isoDate) ?? parseDate(todayISO())!
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function startOfWeek(date: Date) {
  const result = new Date(date)
  const day = result.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  result.setDate(result.getDate() + diff)
  result.setHours(0, 0, 0, 0)
  return result
}

export function buildFilterWindow(range: SalesDashboardFilterRange, anchorDate: string): DateWindow {
  if (range === "today") {
    return { date_from: anchorDate, date_to: anchorDate }
  }
  if (range === "week") {
    return { date_from: shiftDate(anchorDate, -6), date_to: anchorDate }
  }
  return { date_from: shiftDate(anchorDate, -29), date_to: anchorDate }
}

export function buildChartWindow(range: SalesDashboardChartRange, anchorDate: string): DateWindow {
  if (range === "1W") {
    return { date_from: shiftDate(anchorDate, -6), date_to: anchorDate }
  }
  if (range === "3M") {
    return { date_from: shiftDate(anchorDate, -89), date_to: anchorDate }
  }
  if (range === "1Y") {
    return { date_from: shiftDate(anchorDate, -364), date_to: anchorDate }
  }
  return { date_from: shiftDate(anchorDate, -29), date_to: anchorDate }
}

function buildSummaryParams(filters: SalesDashboardFilter) {
  const window = buildFilterWindow(filters.range, filters.date)
  return {
    ...window,
    currency: "UZS",
    top_n: 5,
  }
}

function buildProfitabilityParams(filters: SalesDashboardFilter) {
  if (filters.range === "today") {
    return {
      period: "DAILY",
      anchor_date: filters.date,
      currency: "UZS",
      status_scope: "DELIVERED_AND_ON_DELIVERY",
    }
  }

  if (filters.range === "week") {
    return {
      period: "WEEKLY",
      anchor_date: filters.date,
      currency: "UZS",
      status_scope: "DELIVERED_AND_ON_DELIVERY",
    }
  }

  return {
    period: "MONTHLY",
    anchor_date: filters.date,
    currency: "UZS",
    status_scope: "DELIVERED_AND_ON_DELIVERY",
  }
}

async function fetchAllOrders(params: OrdersListParams) {
  return fetchAllOrdersRequest({
    search: params.search,
    ordering: params.ordering,
    status: params.status,
    payment_status: params.payment_status,
    client: params.client,
    date_from: params.date_from,
    date_to: params.date_to,
    shipment_state: params.shipment_state,
  })
}

function formatBucketLabel(date: Date, range: SalesDashboardChartRange, locale: string) {
  if (range === "1Y") {
    return new Intl.DateTimeFormat(locale, { month: "short" }).format(date)
  }

  if (range === "1W") {
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date)
  }

  if (range === "3M") {
    return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(date)
  }

  return new Intl.DateTimeFormat(locale, { day: "2-digit" }).format(date)
}

function bucketKeyForDate(date: Date, range: SalesDashboardChartRange) {
  if (range === "1Y") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
  }

  if (range === "3M") {
    return startOfWeek(date).toISOString().slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function buildTrendBuckets(range: SalesDashboardChartRange, anchorDate: string, locale: string) {
  const anchor = parseDate(anchorDate) ?? parseDate(todayISO())!
  const buckets: SalesTrendPoint[] = []

  if (range === "1Y") {
    for (let index = 11; index >= 0; index -= 1) {
      const point = new Date(anchor.getFullYear(), anchor.getMonth() - index, 1)
      buckets.push({
        label: formatBucketLabel(point, range, locale),
        revenue: 0,
        paid: 0,
        orders: 0,
      })
    }
    return buckets
  }

  if (range === "3M") {
    const currentWeek = startOfWeek(anchor)
    for (let index = 11; index >= 0; index -= 1) {
      const point = new Date(currentWeek)
      point.setDate(point.getDate() - index * 7)
      buckets.push({
        label: formatBucketLabel(point, range, locale),
        revenue: 0,
        paid: 0,
        orders: 0,
      })
    }
    return buckets
  }

  const days = range === "1W" ? 6 : 29
  for (let index = days; index >= 0; index -= 1) {
    const point = new Date(anchor)
    point.setDate(point.getDate() - index)
    buckets.push({
      label: formatBucketLabel(point, range, locale),
      revenue: 0,
      paid: 0,
      orders: 0,
    })
  }

  return buckets
}

function buildTrendData(rows: OrderSummary[], range: SalesDashboardChartRange, anchorDate: string, locale: string) {
  const anchor = parseDate(anchorDate) ?? parseDate(todayISO())!
  const buckets = buildTrendBuckets(range, anchorDate, locale)
  const bucketIndex = new Map<string, number>()

  if (range === "1Y") {
    buckets.forEach((_, index) => {
      const date = new Date(anchor.getFullYear(), anchor.getMonth() - (11 - index), 1)
      bucketIndex.set(bucketKeyForDate(date, range), index)
    })
  } else if (range === "3M") {
    const currentWeek = startOfWeek(anchor)
    buckets.forEach((_, index) => {
      const date = new Date(currentWeek)
      date.setDate(date.getDate() - (11 - index) * 7)
      bucketIndex.set(bucketKeyForDate(date, range), index)
    })
  } else {
    const days = range === "1W" ? 6 : 29
    buckets.forEach((_, index) => {
      const date = new Date(anchor)
      date.setDate(date.getDate() - (days - index))
      bucketIndex.set(bucketKeyForDate(date, range), index)
    })
  }

  rows.forEach((row) => {
    if (!hasKnownOrderStatus(row)) return
    const orderDate = parseDate(row.order_date)
    if (!orderDate) return

    const bucketKey = bucketKeyForDate(orderDate, range)
    const index = bucketIndex.get(bucketKey)
    if (index === undefined) return

    const safeRevenue = normalizeStatus(row.status) === "CANCELLED" ? 0 : Math.max(toNumber(row.total), 0)
    const safePaid = normalizeStatus(row.status) === "CANCELLED" ? 0 : Math.max(toNumber(row.paid_amount), 0)

    buckets[index].revenue += safeRevenue
    buckets[index].paid += Math.min(safePaid, safeRevenue)
    buckets[index].orders += 1
  })

  return buckets
}

function buildStageMetrics(rows: OrderSummary[]) {
  const initial = ORDER_STATUS_VALUES.reduce<Record<SalesStageKey, SalesStageMetric>>((acc, status) => {
    acc[status] = { key: status, count: 0, amount: 0 }
    return acc
  }, {} as Record<SalesStageKey, SalesStageMetric>)

  rows.forEach((row) => {
    if (!hasKnownOrderStatus(row)) return
    const status = normalizeStatus(row.status)
    initial[status].count += 1
    initial[status].amount += Math.max(toNumber(row.total), 0)
  })

  return Object.values(initial)
}

function buildTopClients(rows: OrderSummary[]) {
  const totals = new Map<string, SalesClientInsight>()

  rows.forEach((row) => {
    if (!hasKnownOrderStatus(row)) return
    if (normalizeStatus(row.status) === "CANCELLED") return
    const key = safeText(row.client_name, "Unknown client")
    const current = totals.get(key) ?? { name: key, totalRevenue: 0, orderCount: 0 }
    current.totalRevenue += Math.max(toNumber(row.total), 0)
    current.orderCount += 1
    totals.set(key, current)
  })

  return [...totals.values()]
    .sort((left, right) => right.totalRevenue - left.totalRevenue || right.orderCount - left.orderCount)
    .slice(0, 3)
}

function extractTopClients(summary: SalesSummaryResponse | null, fallback: SalesClientInsight[]) {
  const rawClients =
    (Array.isArray(summary?.top_clients) && summary.top_clients) ||
    (Array.isArray(summary?.clients) && summary.clients) ||
    (Array.isArray(summary?.leaders?.clients) && summary.leaders.clients) ||
    []

  const normalized = rawClients
    .map((row: any) => ({
      name: safeText(row?.client_name ?? row?.name),
      totalRevenue: toNumber(row?.total ?? row?.amount ?? row?.orders_total),
      orderCount: toNumber(row?.count ?? row?.orders_count ?? row?.orders),
    }))
    .filter((row: SalesClientInsight) => row.name && (row.totalRevenue > 0 || row.orderCount > 0))

  return normalized.length > 0 ? normalized.slice(0, 3) : fallback
}

function extractSummaryTotals(summary: SalesSummaryResponse | null, fallbackRevenue: number, fallbackPaid: number) {
  const totalRevenue = toNumber(
    summary?.totals?.total ??
      summary?.totals?.orders_total ??
      summary?.total ??
      summary?.orders_total,
    fallbackRevenue
  )

  const totalPaid = toNumber(
    summary?.totals?.paid ??
      summary?.totals?.orders_paid ??
      summary?.paid ??
      summary?.orders_paid,
    fallbackPaid
  )

  return {
    totalRevenue,
    totalPaid,
  }
}

function extractProfitability(profitability: ProfitabilityResponse | null) {
  return {
    grossProfit: toNumber(
      profitability?.profit?.gross_profit ??
        profitability?.gross_profit ??
        profitability?.profit ??
        profitability?.totals?.gross_profit
    ),
    cogs: toNumber(
      profitability?.expenses?.cogs_total ??
        profitability?.cogs_total ??
        profitability?.expenses?.cogs ??
        profitability?.totals?.cogs_total
    ),
  }
}

function sortRecentOrders(rows: OrderSummary[]) {
  return [...rows].sort((left, right) => {
    const dateCompare = safeText(right.order_date).localeCompare(safeText(left.order_date))
    if (dateCompare !== 0) return dateCompare
    return toNumber(right.id) - toNumber(left.id)
  })
}

export async function getSalesDashboardSnapshot(input: {
  filters: SalesDashboardFilter
  chartRange: SalesDashboardChartRange
  locale: string
}): Promise<SalesDashboardSnapshot> {
  const filterWindow = buildFilterWindow(input.filters.range, input.filters.date)
  const chartWindow = buildChartWindow(input.chartRange, input.filters.date)

  const filterOrdersPromise = fetchAllOrders({
    ordering: "-order_date",
    date_from: filterWindow.date_from,
    date_to: filterWindow.date_to,
  })

  const trendOrdersPromise =
    input.chartRange === "1M" && input.filters.range === "month"
      ? filterOrdersPromise
      : fetchAllOrders({
          ordering: "order_date",
          date_from: chartWindow.date_from,
          date_to: chartWindow.date_to,
        })

  const salesSummaryPromise = withEndpointFallback<SalesSummaryResponse>(SUMMARY_ENDPOINTS, buildSummaryParams(input.filters)).catch(
    () => null
  )
  const profitabilityPromise = withEndpointFallback<ProfitabilityResponse>(
    PROFITABILITY_ENDPOINTS,
    buildProfitabilityParams(input.filters)
  ).catch(() => null)

  const [filterOrders, trendOrders, salesSummary, profitability] = await Promise.all([
    filterOrdersPromise,
    trendOrdersPromise,
    salesSummaryPromise,
    profitabilityPromise,
  ])

  const knownFilterOrders = filterOrders.filter(hasKnownOrderStatus)
  const knownTrendOrders = trendOrders.filter(hasKnownOrderStatus)
  const activeOrders = knownFilterOrders.filter((row) => normalizeStatus(row.status) !== "CANCELLED")
  const fallbackRevenue = activeOrders.reduce((sum, row) => sum + Math.max(toNumber(row.total), 0), 0)
  const fallbackPaid = activeOrders.reduce(
    (sum, row) => sum + Math.min(Math.max(toNumber(row.paid_amount), 0), Math.max(toNumber(row.total), 0)),
    0
  )
  const fallbackRemaining = activeOrders.reduce((sum, row) => sum + Math.max(toNumber(row.remaining), 0), 0)

  const { totalRevenue, totalPaid } = extractSummaryTotals(salesSummary, fallbackRevenue, fallbackPaid)
  const { grossProfit, cogs } = extractProfitability(profitability)

  const paymentBuckets = activeOrders.reduce(
    (acc, row) => {
      const paymentStatus = normalizePaymentStatus(row.payment_status)
      if (paymentStatus === "PAID") acc.paidCount += 1
      else if (paymentStatus === "PARTIAL") acc.partialCount += 1
      else acc.unpaidCount += 1
      return acc
    },
    { paidCount: 0, partialCount: 0, unpaidCount: 0 }
  )

  const recentOrders = sortRecentOrders(knownFilterOrders).slice(0, 6)
  const largestOrder =
    [...activeOrders].sort((left, right) => Math.max(toNumber(right.total), 0) - Math.max(toNumber(left.total), 0))[0] ?? null

  const orderCount = activeOrders.length
  const averageCheck = orderCount > 0 ? totalRevenue / orderCount : 0
  const collectionRate = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0

  return {
    totals: {
      revenue: totalRevenue,
      paid: totalPaid,
      remaining: Math.max(fallbackRemaining, Math.max(totalRevenue - totalPaid, 0)),
      grossProfit,
      cogs,
      averageCheck,
      collectionRate,
      orderCount,
      unpaidCount: paymentBuckets.unpaidCount,
      partialCount: paymentBuckets.partialCount,
      paidCount: paymentBuckets.paidCount,
    },
    chart: buildTrendData(
      knownTrendOrders.filter((row) => normalizeStatus(row.status) !== "CANCELLED"),
      input.chartRange,
      input.filters.date,
      input.locale
    ),
    stageMetrics: buildStageMetrics(knownFilterOrders),
    recentOrders,
    topClients: extractTopClients(salesSummary, buildTopClients(knownFilterOrders)),
    largestOrder,
    profitabilityAvailable: Boolean(profitability),
    generatedAt: new Date().toISOString(),
  }
}
