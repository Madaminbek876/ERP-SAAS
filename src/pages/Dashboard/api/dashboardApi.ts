import type { ChartRange, DashboardFilter, OverviewSummaryResponse, RecentQuery, RecentRow } from "./types"
import { buildOverviewDemo, demoSalesSeries, demoSkladSeries, sleep } from "./mock"

import { warehouseApi } from "@/pages/sklad/warehouse/api/warehouseApi"
import type { MovementItem } from "@/pages/sklad/warehouse/api/types"
import { financeClient } from "@/pages/moliya/shared/financeClient"
import type { FinanceEntry } from "@/pages/moliya/shared/types"
import { http } from "@/shared/http"
import { translate } from "@/i18n"

const USE_BACKEND = String((import.meta as any).env?.VITE_USE_BACKEND || "1") !== "0"

const ENDPOINTS = {
  overviewSummary: ["/api/v1/dashboard/overview/summary/", "/api/v1/dashboard/overview/summary"],
  financeSummary: ["/api/v1/dashboard/finance/summary/", "/api/v1/dashboard/finance/summary"],
  salesSummary: ["/api/v1/dashboard/sales/summary/", "/api/v1/dashboard/sales/summary"],
  salesProfitability: ["/api/v1/dashboard/sales/profitability/", "/api/v1/dashboard/sales/profitability"],
}

type ApiRow = Record<string, unknown>

function safeStr(value: unknown, fallback = "") {
  const normalized = String(value ?? "").trim()
  return normalized || fallback
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function asArray<T = ApiRow>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === "object") {
    const payload = value as { results?: T[]; rows?: T[]; items?: T[]; data?: T[] }
    if (Array.isArray(payload.results)) return payload.results
    if (Array.isArray(payload.rows)) return payload.rows
    if (Array.isArray(payload.items)) return payload.items
    if (Array.isArray(payload.data)) return payload.data
  }
  return []
}

function isNotFound(error: any) {
  return Number(error?.response?.status || 0) === 404
}

async function withEndpointFallback<T>(candidates: string[], params?: Record<string, unknown>): Promise<T> {
  let lastError: unknown = null

  for (const url of candidates) {
    try {
      return await http.get<T>(url, params)
    } catch (error: any) {
      if (!isNotFound(error)) throw error
      lastError = error
    }
  }

  throw lastError ?? new Error("Dashboard endpoint topilmadi")
}

function todayISO() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function shiftDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function buildDateWindow(range: string | undefined, anchorDate: string) {
  const normalized = String(range || "month").toLowerCase()

  if (normalized === "today") {
    return { date_from: anchorDate, date_to: anchorDate }
  }
  if (normalized === "week" || normalized === "1w") {
    return { date_from: shiftDate(anchorDate, -6), date_to: anchorDate }
  }
  if (normalized === "3m") {
    return { date_from: shiftDate(anchorDate, -89), date_to: anchorDate }
  }
  if (normalized === "year" || normalized === "1y") {
    return { date_from: shiftDate(anchorDate, -365), date_to: anchorDate }
  }

  return { date_from: shiftDate(anchorDate, -30), date_to: anchorDate }
}

function buildDashboardParams(filters?: Partial<DashboardFilter>) {
  const date = safeStr(filters?.date, todayISO())
  const currency = safeStr(filters?.currency, "UZS")

  return {
    ...buildDateWindow(filters?.range, date),
    currency,
  }
}

function buildChartParams(range: ChartRange, filters?: Partial<DashboardFilter>) {
  const date = safeStr(filters?.date, todayISO())
  const currency = safeStr(filters?.currency, "UZS")

  return {
    ...buildDateWindow(range, date),
    currency,
  }
}

function buildProfitabilityParams(range: ChartRange, filters?: Partial<DashboardFilter>) {
  const date = safeStr(filters?.date, todayISO())
  const currency = safeStr(filters?.currency, "UZS")

  if (range === "1W") {
    return {
      period: "WEEKLY",
      anchor_date: date,
      currency,
      status_scope: "DELIVERED_AND_ON_DELIVERY",
    }
  }

  if (range === "1Y") {
    return {
      period: "YEARLY",
      anchor_date: date,
      currency,
      status_scope: "DELIVERED_AND_ON_DELIVERY",
    }
  }

  if (range === "3M") {
    return {
      period: "CUSTOM",
      ...buildDateWindow("3M", date),
      currency,
      status_scope: "DELIVERED_AND_ON_DELIVERY",
    }
  }

  return {
    period: "MONTHLY",
    anchor_date: date,
    currency,
    status_scope: "DELIVERED_AND_ON_DELIVERY",
  }
}

function formatAmount(value: unknown) {
  return num(value).toLocaleString("uz-UZ")
}

function formatQty(value: unknown) {
  const amount = num(value)
  const maximumFractionDigits = Number.isInteger(amount) ? 0 : 2
  return amount.toLocaleString("uz-UZ", { minimumFractionDigits: 0, maximumFractionDigits })
}

function resolveCurrency(overview: any, finance: any) {
  return safeStr(overview?.currency ?? finance?.currency, "UZS")
}

function buildSalesKpis(overview: any, finance: any): OverviewSummaryResponse["salesKpis"] {
  const currency = resolveCurrency(overview, finance)
  const sales = overview?.sales ?? {}
  const purchases = overview?.purchases ?? {}

  return [
    {
      title: translate("dashboard.kpi.salesTotal", "Sotuv jami"),
      value: formatAmount(sales?.orders_total),
      sub: currency,
      icon: "S",
      tone: "success",
    },
    {
      title: translate("dashboard.kpi.salesPaid", "Sotuv to'langan"),
      value: formatAmount(sales?.orders_paid),
      sub: translate("dashboard.kpi.unpaidCount", "{{count}} ta to'lanmagan", { count: num(sales?.unpaid_count) }),
      icon: "P",
      tone: "success",
    },
    {
      title: translate("dashboard.kpi.purchaseTotal", "Xarid jami"),
      value: formatAmount(purchases?.purchases_total),
      sub: currency,
      icon: "X",
      tone: "neutral",
    },
    {
      title: translate("dashboard.kpi.purchasePaid", "Xarid to'langan"),
      value: formatAmount(purchases?.purchases_paid),
      sub: currency,
      icon: "T",
      tone: "neutral",
    },
  ]
}

function buildWarehouseKpis(overview: any, finance: any): OverviewSummaryResponse["skladKpis"] {
  const currency = resolveCurrency(overview, finance)
  const financeBlock = overview?.finance ?? {}
  const warehouse = overview?.warehouse ?? {}

  return [
    {
      title: translate("dashboard.kpi.netResult", "Sof natija"),
      value: formatAmount(financeBlock?.net ?? finance?.net),
      sub: currency,
      icon: "N",
      tone: num(financeBlock?.net ?? finance?.net) >= 0 ? "success" : "danger",
    },
    {
      title: translate("dashboard.kpi.warehouseMovement", "Ombor harakati"),
      value: formatAmount(warehouse?.movements_count),
      sub: translate("dashboard.kpi.movementCount", "harakat soni"),
      icon: "W",
      tone: "neutral",
    },
    {
      title: translate("dashboard.kpi.incoming", "Kirim"),
      value: formatQty(warehouse?.in_qty),
      sub: `${formatAmount(warehouse?.in_cost)} ${currency}`,
      icon: "IN",
      tone: "success",
    },
    {
      title: translate("dashboard.kpi.outgoing", "Chiqim"),
      value: formatQty(warehouse?.out_qty),
      sub: `${formatAmount(warehouse?.out_cost)} ${currency}`,
      icon: "OUT",
      tone: "danger",
    },
  ]
}

function buildSalesSeries(salesSummary: any, profitability: any) {
  const points = [
    { label: translate("dashboard.series.total", "Jami"), value: num(salesSummary?.totals?.total) },
    { label: translate("dashboard.series.paid", "Paid"), value: num(salesSummary?.totals?.paid) },
    { label: "COGS", value: num(profitability?.expenses?.cogs_total) },
    { label: translate("dashboard.series.profit", "Profit"), value: num(profitability?.profit?.gross_profit) },
  ]

  return points.filter((point) => point.value > 0)
}

function buildWarehouseSeries(overview: any) {
  const warehouse = overview?.warehouse ?? {}
  const inCost = num(warehouse?.in_cost)
  const outCost = num(warehouse?.out_cost)
  const delta = Math.max(inCost - outCost, 0)

  return [
    { label: translate("dashboard.series.incoming", "Kirim"), value: inCost },
    { label: translate("dashboard.series.outgoing", "Chiqim"), value: outCost },
    { label: translate("dashboard.series.difference", "Farq"), value: delta },
  ]
}

function mapMovementToRecentRow(movement: MovementItem): RecentRow {
  const rawType = safeStr((movement as any).movement_type ?? (movement as any).type).toUpperCase()
  const type: RecentRow["type"] = rawType === "OUT" || rawType === "WASTE" ? "MOVE_OUT" : "MOVE_IN"

  const locationName =
    safeStr((movement as any).from_location_name) ||
    safeStr((movement as any).to_location_name) ||
    safeStr((movement as any).location_name)

  return {
    id: String((movement as any).id ?? `move-${safeStr((movement as any).date, todayISO())}`),
    name: safeStr((movement as any).itemName, translate("dashboard.recent.warehouseMovement", "Warehouse movement")),
    qty: num((movement as any).qty),
    meta: locationName || translate("dashboard.recent.units", "{{count}} birlik", { count: formatQty((movement as any).qty) }),
    amount: num((movement as any).total),
    date: safeStr((movement as any).date, todayISO()).slice(0, 10),
    type,
  }
}

function mapPaymentToRecentRow(row: ApiRow, type: RecentRow["type"]): RecentRow {
  const documentNo = safeStr(row.document_no)
  const refType = safeStr(row.ref_type)
  const refId = safeStr(row.ref_id)
  const method = safeStr(row.method)

  const metaParts = [
    documentNo,
    method,
    refType && refId ? `${refType} #${refId}` : refType || refId,
  ].filter(Boolean)

  return {
    id: safeStr(row.payment_id ?? row.id, `${type}-${Date.now()}`),
    name: safeStr(row.partner_name, translate("dashboard.recent.partner", "Partner")),
    qty: 0,
    meta: metaParts.join(" | ") || translate("dashboard.recent.payment", "To'lov"),
    amount: num(row.amount),
    date: safeStr(row.paid_at, todayISO()).slice(0, 10),
    type,
  }
}

function derivePostingRecentType(row: FinanceEntry): RecentRow["type"] {
  const refType = safeStr(row.referenceType).toUpperCase()
  const notes = safeStr(row.notes).toUpperCase()

  if (refType.includes("CLIENT") || refType.includes("ORDER") || refType.includes("SALE")) return "PAYMENT_IN"
  if (refType.includes("SUPPLIER") || refType.includes("PURCHASE") || refType.includes("EMPLOYEE") || refType.includes("SALARY")) {
    return "PAYMENT_OUT"
  }
  if (notes.includes("AVANS") || notes.includes("OYLIK") || notes.includes("BONUS")) return "PAYMENT_OUT"
  return row.entryType === "INCOME" ? "PAYMENT_IN" : "PAYMENT_OUT"
}

function mapPostingToRecentRow(row: FinanceEntry): RecentRow {
  const metaParts = [
    safeStr(row.paymentMethod),
    safeStr(row.reference),
    safeStr(row.referenceType) && safeStr(row.referenceId) ? `${safeStr(row.referenceType)} #${safeStr(row.referenceId)}` : "",
  ].filter(Boolean)

  return {
    id: safeStr(row.id, `payment-${Date.now()}`),
    name: safeStr(row.reference, translate("dashboard.recent.partner", "Partner")),
    qty: 0,
    meta: metaParts.join(" | ") || translate("dashboard.recent.payment", "To'lov"),
    amount: num(row.amount),
    date: safeStr(row.date, todayISO()).slice(0, 10),
    type: derivePostingRecentType(row),
  }
}

function sortRows(rows: RecentRow[], query: RecentQuery) {
  if (!query.sortKey) return rows

  const direction = query.sortDir === "asc" ? 1 : -1

  return [...rows].sort((a, b) => {
    if (query.sortKey === "name") return a.name.localeCompare(b.name) * direction
    if (query.sortKey === "qty") return (a.qty - b.qty) * direction
    if (query.sortKey === "amount") return (a.amount - b.amount) * direction
    if (query.sortKey === "type") return a.type.localeCompare(b.type) * direction
    return a.date.localeCompare(b.date) * direction
  })
}

export const dashboardApi = {
  async getOverviewSummary(filters: DashboardFilter): Promise<OverviewSummaryResponse> {
    const demo = buildOverviewDemo()

    if (!USE_BACKEND) {
      await sleep(150)
      return demo
    }

    const params = buildDashboardParams(filters)
    const [overviewResult, financeResult] = await Promise.allSettled([
      withEndpointFallback<any>(ENDPOINTS.overviewSummary, params),
      withEndpointFallback<any>(ENDPOINTS.financeSummary, params),
    ])

    const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null
    const finance = financeResult.status === "fulfilled" ? financeResult.value : null

    if (!overview && !finance) {
      throw new Error("Dashboard summary endpointlari javob bermadi")
    }

    return {
      salesKpis: buildSalesKpis(overview, finance),
      skladKpis: buildWarehouseKpis(overview, finance),
      salesSeries: [],
      skladSeries: buildWarehouseSeries(overview),
      rows: [],
    }
  },

  async getOverviewSeries(which: "sales" | "sklad", range: ChartRange, filters?: DashboardFilter) {
    if (!USE_BACKEND) {
      await sleep(150)
      return { range, series: which === "sales" ? demoSalesSeries(range) : demoSkladSeries(range) }
    }

    if (which === "sales") {
      const summaryParams = {
        ...buildChartParams(range, filters),
        top_n: 10,
      }

      const profitabilityParams = buildProfitabilityParams(range, filters)
      const [salesSummaryResult, profitabilityResult] = await Promise.allSettled([
        withEndpointFallback<any>(ENDPOINTS.salesSummary, summaryParams),
        withEndpointFallback<any>(ENDPOINTS.salesProfitability, profitabilityParams),
      ])

      const salesSummary = salesSummaryResult.status === "fulfilled" ? salesSummaryResult.value : null
      const profitability = profitabilityResult.status === "fulfilled" ? profitabilityResult.value : null
      const series = buildSalesSeries(salesSummary, profitability)

      return { range, series }
    }

    const overview = await withEndpointFallback<any>(
      ENDPOINTS.overviewSummary,
      buildChartParams(range, filters)
    ).catch(() => null)

    const series = buildWarehouseSeries(overview)
    const hasAnyValue = series.some((point) => point.value > 0)
    return { range, series: hasAnyValue ? series : demoSkladSeries(range) }
  },

  async getOverviewRecent(params: RecentQuery) {
    let data: RecentRow[] = []

    if (!USE_BACKEND) {
      await sleep(120)
      data = [...buildOverviewDemo().rows]
    } else {
      const backendParams = buildDashboardParams({
        range: params.range,
        date: params.date,
        currency: params.currency,
      })

      const [paymentsResult, movementsResult] = await Promise.allSettled([
        financeClient.listPostings(),
        warehouseApi.listMovementsPage({ page: 1, page_size: 20 }),
      ])

      const paymentRows =
        paymentsResult.status === "fulfilled"
          ? asArray<FinanceEntry>(paymentsResult.value).map(mapPostingToRecentRow)
          : []

      const movementRows =
        movementsResult.status === "fulfilled"
          ? asArray<MovementItem>((movementsResult.value as any)?.results ?? movementsResult.value).map(mapMovementToRecentRow)
          : []

      data = [...paymentRows, ...movementRows]
    }

    const query = safeStr(params.q).toLowerCase()
    if (query) {
      data = data.filter((row) => {
        const haystack = `${row.name} ${row.meta ?? ""} ${row.type}`.toLowerCase()
        return haystack.includes(query)
      })
    }

    const sorted = sortRows(data, params)
    const totalCount = sorted.length
    const start = Math.max(0, (params.page - 1) * params.pageSize)
    const rows = sorted.slice(start, start + params.pageSize)

    return { rows, totalCount }
  },
}
