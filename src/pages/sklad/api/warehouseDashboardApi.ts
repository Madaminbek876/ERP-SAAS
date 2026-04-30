import { warehouseApi } from "@/pages/sklad/warehouse/api/warehouseApi"
import type { MovementItem, StockOnHandItem } from "@/pages/sklad/warehouse/api/types"

export type WarehouseDashboardFilterRange = "today" | "week" | "month"
export type WarehouseDashboardChartRange = "1W" | "1M" | "3M" | "1Y"
export type WarehouseMovementStageKey = "IN" | "OUT" | "TRANSFER" | "RETURN" | "WASTE" | "ADJUST"

export type WarehouseDashboardFilter = {
  range: WarehouseDashboardFilterRange
  date: string
}

export type WarehouseTrendPoint = {
  label: string
  incoming: number
  outgoing: number
  movements: number
}

export type WarehouseMovementMetric = {
  key: WarehouseMovementStageKey
  count: number
  qty: number
  value: number
}

export type WarehouseStockInsight = {
  id: string | number
  name: string
  qty: number
  value: number
  locationName: string
  itemType: string
}

export type WarehouseLocationInsight = {
  name: string
  qty: number
  value: number
  itemCount: number
}

export type WarehouseRecentMovement = MovementItem & {
  direction: "incoming" | "outgoing" | "neutral"
}

export type WarehouseDashboardSnapshot = {
  totals: {
    stockValue: number
    stockQty: number
    skuCount: number
    lowStockCount: number
    incomingQty: number
    outgoingQty: number
    inboundValue: number
    outboundValue: number
    movementCount: number
    netFlow: number
  }
  chart: WarehouseTrendPoint[]
  movementMetrics: WarehouseMovementMetric[]
  stockLeaders: WarehouseStockInsight[]
  lowStockItems: WarehouseStockInsight[]
  locationInsights: WarehouseLocationInsight[]
  recentMovements: WarehouseRecentMovement[]
  generatedAt: string
}

type DateWindow = {
  date_from: string
  date_to: string
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
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

export function buildFilterWindow(range: WarehouseDashboardFilterRange, anchorDate: string): DateWindow {
  if (range === "today") return { date_from: anchorDate, date_to: anchorDate }
  if (range === "week") return { date_from: shiftDate(anchorDate, -6), date_to: anchorDate }
  return { date_from: shiftDate(anchorDate, -29), date_to: anchorDate }
}

export function buildChartWindow(range: WarehouseDashboardChartRange, anchorDate: string): DateWindow {
  if (range === "1W") return { date_from: shiftDate(anchorDate, -6), date_to: anchorDate }
  if (range === "3M") return { date_from: shiftDate(anchorDate, -89), date_to: anchorDate }
  if (range === "1Y") return { date_from: shiftDate(anchorDate, -364), date_to: anchorDate }
  return { date_from: shiftDate(anchorDate, -29), date_to: anchorDate }
}

function normalizeMovementType(value: unknown): WarehouseMovementStageKey {
  const movement = safeText(value).toUpperCase()
  if (movement === "OUT" || movement === "ISSUE") return "OUT"
  if (movement === "TRANSFER") return "TRANSFER"
  if (movement === "RETURN") return "RETURN"
  if (movement === "WASTE") return "WASTE"
  if (movement === "ADJUST") return "ADJUST"
  return "IN"
}

function movementDirection(value: unknown) {
  const movement = normalizeMovementType(value)
  if (movement === "IN" || movement === "RETURN") return "incoming" as const
  if (movement === "OUT" || movement === "WASTE") return "outgoing" as const
  if (movement === "TRANSFER" || movement === "ADJUST") return "neutral" as const
  return "neutral" as const
}

function itemName(row: StockOnHandItem) {
  return safeText(row.item_name || row.product_name || row.raw_material_name || "-", "-")
}

function formatBucketLabel(date: Date, range: WarehouseDashboardChartRange, locale: string) {
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

function bucketKeyForDate(date: Date, range: WarehouseDashboardChartRange) {
  if (range === "1Y") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
  }

  if (range === "3M") {
    return startOfWeek(date).toISOString().slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function buildTrendBuckets(range: WarehouseDashboardChartRange, anchorDate: string, locale: string) {
  const anchor = parseDate(anchorDate) ?? parseDate(todayISO())!
  const buckets: WarehouseTrendPoint[] = []

  if (range === "1Y") {
    for (let index = 11; index >= 0; index -= 1) {
      const point = new Date(anchor.getFullYear(), anchor.getMonth() - index, 1)
      buckets.push({
        label: formatBucketLabel(point, range, locale),
        incoming: 0,
        outgoing: 0,
        movements: 0,
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
        incoming: 0,
        outgoing: 0,
        movements: 0,
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
      incoming: 0,
      outgoing: 0,
      movements: 0,
    })
  }

  return buckets
}

function buildTrendData(rows: MovementItem[], range: WarehouseDashboardChartRange, anchorDate: string, locale: string) {
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
    const eventDate = parseDate(row.date)
    if (!eventDate) return

    const bucketKey = bucketKeyForDate(eventDate, range)
    const index = bucketIndex.get(bucketKey)
    if (index === undefined) return

    const qty = Math.max(toNumber(row.qty), 0)
    const direction = movementDirection(row.movement_type ?? row.type)
    if (direction === "incoming") buckets[index].incoming += qty
    if (direction === "outgoing") buckets[index].outgoing += qty
    buckets[index].movements += 1
  })

  return buckets
}

async function fetchAllMovements(window: DateWindow) {
  const rows: MovementItem[] = []
  let page = 1
  let totalCount = Number.POSITIVE_INFINITY

  while (page <= 25 && rows.length < totalCount) {
    const response = await warehouseApi.listMovementsPage({
      page,
      page_size: 200,
      date_from: window.date_from,
      date_to: window.date_to,
    })

    totalCount = Math.max(toNumber(response.count, rows.length), rows.length)
    rows.push(...response.results)

    if (!response.results.length) break
    if (!response.next && rows.length >= totalCount) break

    page += 1
  }

  return rows
}

async function fetchAllStockRows() {
  const rows: StockOnHandItem[] = []
  let page = 1
  let totalCount = Number.POSITIVE_INFINITY

  while (page <= 25 && rows.length < totalCount) {
    const response = await warehouseApi.listStock({
      page,
      page_size: 200,
    })

    totalCount = Math.max(toNumber(response.count, rows.length), rows.length)
    rows.push(...response.results)

    if (!response.results.length) break
    if (!response.next && rows.length >= totalCount) break

    page += 1
  }

  return rows
}

function buildMovementMetrics(rows: MovementItem[]) {
  const order: WarehouseMovementStageKey[] = ["IN", "OUT", "TRANSFER", "RETURN", "WASTE", "ADJUST"]
  const map = new Map<WarehouseMovementStageKey, WarehouseMovementMetric>(
    order.map((key) => [
      key,
      {
        key,
        count: 0,
        qty: 0,
        value: 0,
      },
    ])
  )

  rows.forEach((row) => {
    const key = normalizeMovementType(row.movement_type ?? row.type)
    const current = map.get(key)
    if (!current) return
    current.count += 1
    current.qty += Math.max(toNumber(row.qty), 0)
    current.value += Math.abs(toNumber(row.total))
  })

  return order.map((key) => map.get(key)!)
}

function buildStockLeaders(rows: StockOnHandItem[]) {
  return [...rows]
    .sort((left, right) => toNumber(right.value_onhand) - toNumber(left.value_onhand))
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      name: itemName(row),
      qty: toNumber(row.balance_qty ?? row.qty_onhand),
      value: toNumber(row.value_onhand) || toNumber(row.balance_qty ?? row.qty_onhand) * toNumber(row.avg_unit_cost),
      locationName: safeText(row.location_name, "-"),
      itemType: safeText(row.item_type, "RAW_MATERIAL"),
    }))
}

function buildLowStockItems(rows: StockOnHandItem[]) {
  const ranked = [...rows].sort(
    (left, right) => toNumber(left.balance_qty ?? left.qty_onhand) - toNumber(right.balance_qty ?? right.qty_onhand)
  )
  const critical = ranked.filter((row) => toNumber(row.balance_qty ?? row.qty_onhand) <= 0)
  const source = critical.length > 0 ? critical : ranked

  return source.slice(0, 5).map((row) => ({
    id: row.id,
    name: itemName(row),
    qty: toNumber(row.balance_qty ?? row.qty_onhand),
    value: toNumber(row.value_onhand) || toNumber(row.balance_qty ?? row.qty_onhand) * toNumber(row.avg_unit_cost),
    locationName: safeText(row.location_name, "-"),
    itemType: safeText(row.item_type, "RAW_MATERIAL"),
  }))
}

function buildLocationInsights(rows: StockOnHandItem[]) {
  const grouped = new Map<string, WarehouseLocationInsight>()

  rows.forEach((row) => {
    const key = safeText(row.location_name, `Warehouse #${safeText(row.location, "-")}`)
    const current = grouped.get(key) ?? {
      name: key,
      qty: 0,
      value: 0,
      itemCount: 0,
    }

    current.qty += Math.max(toNumber(row.balance_qty ?? row.qty_onhand), 0)
    current.value += toNumber(row.value_onhand) || toNumber(row.balance_qty ?? row.qty_onhand) * toNumber(row.avg_unit_cost)
    current.itemCount += 1
    grouped.set(key, current)
  })

  return Array.from(grouped.values())
    .sort((left, right) => right.value - left.value)
    .slice(0, 5)
}

function buildRecentMovements(rows: MovementItem[]) {
  return [...rows]
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 8)
    .map((row) => ({
      ...row,
      direction: movementDirection(row.movement_type ?? row.type),
    }))
}

export async function getWarehouseDashboardSnapshot({
  filters,
  chartRange,
  locale,
}: {
  filters: WarehouseDashboardFilter
  chartRange: WarehouseDashboardChartRange
  locale: string
}): Promise<WarehouseDashboardSnapshot> {
  const summaryWindow = buildFilterWindow(filters.range, filters.date)
  const chartWindow = buildChartWindow(chartRange, filters.date)
  const sameWindow =
    summaryWindow.date_from === chartWindow.date_from &&
    summaryWindow.date_to === chartWindow.date_to

  const [overviewResult, stockResult, summaryResult, chartResult] = await Promise.allSettled([
    warehouseApi.overview(),
    fetchAllStockRows(),
    fetchAllMovements(summaryWindow),
    sameWindow ? Promise.resolve<MovementItem[]>([]) : fetchAllMovements(chartWindow),
  ])

  const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null
  const stockRows = stockResult.status === "fulfilled" ? stockResult.value : []
  const summaryMovements = summaryResult.status === "fulfilled" ? summaryResult.value : []
  const chartMovements = chartResult.status === "fulfilled" ? chartResult.value : []
  const trendRows = sameWindow ? summaryMovements : chartMovements

  if (!overview && stockRows.length === 0 && summaryMovements.length === 0 && trendRows.length === 0) {
    throw new Error("Warehouse dashboard endpoints returned no usable data")
  }

  const stockQtyFromRows = stockRows.reduce((sum, row) => sum + Math.max(toNumber(row.balance_qty ?? row.qty_onhand), 0), 0)
  const stockValueFromRows = stockRows.reduce(
    (sum, row) => sum + (toNumber(row.value_onhand) || toNumber(row.balance_qty ?? row.qty_onhand) * toNumber(row.avg_unit_cost)),
    0
  )
  const lowStockFromRows = stockRows.filter((row) => toNumber(row.balance_qty ?? row.qty_onhand) <= 0).length

  const incomingRows = summaryMovements.filter((row) => movementDirection(row.movement_type ?? row.type) === "incoming")
  const outgoingRows = summaryMovements.filter((row) => movementDirection(row.movement_type ?? row.type) === "outgoing")

  const incomingQtyFromRows = incomingRows.reduce((sum, row) => sum + Math.max(toNumber(row.qty), 0), 0)
  const outgoingQtyFromRows = outgoingRows.reduce((sum, row) => sum + Math.max(toNumber(row.qty), 0), 0)

  const incomingQty =
    filters.range === "today" && incomingQtyFromRows === 0
      ? toNumber(overview?.movements_today?.in_qty, incomingQtyFromRows)
      : incomingQtyFromRows
  const outgoingQty =
    filters.range === "today" && outgoingQtyFromRows === 0
      ? toNumber(overview?.movements_today?.out_qty, outgoingQtyFromRows)
      : outgoingQtyFromRows

  const inboundValue = incomingRows.reduce((sum, row) => sum + Math.abs(toNumber(row.total)), 0)
  const outboundValue = outgoingRows.reduce((sum, row) => sum + Math.abs(toNumber(row.total)), 0)

  return {
    totals: {
      stockValue: overview?.total_value ?? stockValueFromRows,
      stockQty: overview?.total_qty ?? stockQtyFromRows,
      skuCount: overview?.total_items ?? stockRows.length,
      lowStockCount: overview?.low_stock_count ?? lowStockFromRows,
      incomingQty,
      outgoingQty,
      inboundValue,
      outboundValue,
      movementCount: summaryMovements.length,
      netFlow: incomingQty - outgoingQty,
    },
    chart: buildTrendData(trendRows, chartRange, filters.date, locale),
    movementMetrics: buildMovementMetrics(summaryMovements),
    stockLeaders: buildStockLeaders(stockRows),
    lowStockItems: buildLowStockItems(stockRows),
    locationInsights: buildLocationInsights(stockRows),
    recentMovements: buildRecentMovements(summaryMovements),
    generatedAt: new Date().toISOString(),
  }
}
