import { api } from "@/lib/api"
import { warehouseEvents } from "./events"
import { apiAxios } from "@/Api/api.axios"
import type {
  AlertItem,
  LookupItem,
  MovementItem,
  OverviewSummary,
  WarehouseStockMeta,
  StockOnHandItem,
  WarehouseAction,
} from "./types"

function toNum(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function toPositiveInt(v: any) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}

function normalizeItemType(value: any) {
  const raw = String(value || "").toUpperCase()
  if (raw === "PRODUCT") return "FINISHED_PRODUCT"
  if (raw === "FINISHED_PRODUCT") return "FINISHED_PRODUCT"
  if (raw === "RAW_MATERIAL") return "RAW_MATERIAL"
  return raw || "RAW_MATERIAL"
}

function normalizeMovementType(value: any) {
  const raw = String(value || "").toUpperCase().trim()
  if (raw === "IN" || raw === "RECEIPT") return "IN"
  if (raw === "OUT" || raw === "ISSUE") return "OUT"
  if (raw === "RETURN") return "RETURN"
  if (raw === "ADJUST") return "ADJUST"
  if (raw === "WASTE") return "WASTE"
  if (raw === "TRANSFER") return "TRANSFER"
  return raw
}

function normalizeLedgerMovementType(value: any, refType: any) {
  const normalizedRefType = String(refType || "").toUpperCase().trim()
  if (normalizedRefType === "MANUAL_WASTE") return "WASTE"
  if (normalizedRefType === "MANUAL_TRANSFER") return "TRANSFER"
  return normalizeMovementType(value)
}

function normalizeQty(value: any) {
  const qty = Number(value)
  if (!Number.isFinite(qty)) return "0.000000"
  return qty.toFixed(6)
}

const WAREHOUSE_BASE_CANDIDATES = ["/api/v1/dicts/locations/"]
const WAREHOUSE_DICT_BASE_CANDIDATES = ["/api/v1/dicts/locations/"]
const WAREHOUSE_DASHBOARD_CANDIDATES = ["/api/v1/dashboard/warehouse/", "/api/v1/dashboard/warehouse"]
const WAREHOUSE_OVERVIEW_CANDIDATES = ["/api/v1/warehouse/overview/", "/api/v1/warehouse/overview"]
const WAREHOUSE_STOCK_CANDIDATES = ["/api/v1/warehouse/stock/"]
const DEFAULT_STOCK_META: WarehouseStockMeta = {
  item_type_choices: [
    { value: "RAW_MATERIAL", label: "Raw Material" },
    { value: "FINISHED_PRODUCT", label: "Finished Product" },
  ],
  movement_type_choices: [
    { value: "IN", label: "In" },
    { value: "OUT", label: "Out" },
    { value: "RETURN", label: "Return" },
    { value: "WASTE", label: "Waste" },
    { value: "ADJUST", label: "Adjust" },
  ],
}

function normalizeStockMeta(data: any): WarehouseStockMeta {
  const toChoices = (input: unknown, fallback: WarehouseStockMeta["item_type_choices"]) => {
    const rows = Array.isArray(input) ? input : fallback
    return rows
      .map((row) => ({
        value: String((row as any)?.value ?? "").trim().toUpperCase(),
        label: String((row as any)?.label ?? (row as any)?.value ?? "").trim(),
      }))
      .filter((row) => row.value && row.label)
  }

  const itemTypeChoices = toChoices(data?.item_type_choices, DEFAULT_STOCK_META.item_type_choices)
  const movementTypeChoices = toChoices(data?.movement_type_choices, DEFAULT_STOCK_META.movement_type_choices)

  return {
    item_type_choices: itemTypeChoices.length > 0 ? itemTypeChoices : DEFAULT_STOCK_META.item_type_choices,
    movement_type_choices: movementTypeChoices.length > 0 ? movementTypeChoices : DEFAULT_STOCK_META.movement_type_choices,
  }
}

function hasOverviewTotals(data: any) {
  return Boolean(
    data &&
      typeof data === "object" &&
      (data.total_items !== undefined ||
        data.items_count !== undefined ||
        data.total_qty !== undefined ||
        data.qty_total !== undefined ||
        data.total_value !== undefined ||
        data.value_total !== undefined ||
        data.low_stock_count !== undefined ||
        data.critical_count !== undefined)
  )
}

function readOverviewMovementQty(source: any, keys: string[]) {
  const payload = source?.movements_today
  if (!payload || typeof payload !== "object") return 0

  for (const key of keys) {
    const value = (payload as Record<string, unknown>)[key]
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return toNum(value)
    }
  }

  return 0
}

async function getFirstAvailableData(candidates: string[]) {
  let lastError: unknown = null

  for (const url of candidates) {
    try {
      const { data } = await api.get(url)
      return data
    } catch (error: any) {
      const status = Number(error?.response?.status || 0)
      if (status === 404) {
        lastError = error
        continue
      }
      throw error
    }
  }

  if (lastError) throw lastError
  return null
}

function buildDetailCandidates(id: number, bases: string[]) {
  return bases.flatMap((base) => {
    const withSlash = `${base}${id}/`
    const withoutSlash = withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash
    return [withSlash, withoutSlash]
  })
}

// Backenddan kelgan list/paginated javobni bir xil ko'rinishga keltiradi.
function asArray(data: any) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.rows)) return data.rows
  if (Array.isArray(data?.data)) return data.data
  if (data && typeof data === "object") {
    if (
      data.balance_qty !== undefined ||
      data.qty_onhand !== undefined ||
      data.raw_material_name !== undefined ||
      data.product_name !== undefined
    ) {
      return [data]
    }
  }
  return []
}

type WarehouseLocationDictRow = {
  id: number
  name: string
  warehouse_id?: number
  warehouse_name?: string
}

function normalizeWarehouseLocationDictRow(row: any): WarehouseLocationDictRow {
  const nestedWarehouse =
    typeof row?.warehouse === "object" && row?.warehouse !== null ? row.warehouse : null
  const id = Number(row?.id ?? row?.location_id ?? row?.value ?? 0) || 0
  const warehouseId = Number(row?.warehouse_id ?? row?.warehouse ?? nestedWarehouse?.id ?? 0) || 0
  const warehouseName = String(row?.warehouse_name ?? nestedWarehouse?.name ?? "").trim()

  return {
    id,
    name: String(
      row?.name ??
        row?.label ??
        row?.title ??
        (warehouseName ? `${warehouseName} - #${id}` : `Location #${id || "-"}`)
    ),
    warehouse_id: warehouseId > 0 ? warehouseId : undefined,
    warehouse_name: warehouseName || undefined,
  }
}

function isHiddenDefaultWarehouseName(name: string | undefined) {
  const normalized = String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  return normalized === "warehouse 1" || normalized === "склад производства" || normalized === "склад сырья"
}

async function fetchWarehouseLocationDictRows() {
  const { data } = await api.get("/api/v1/dicts/locations/")
  return asArray(data?.locations ?? data)
    .map((row: any) => normalizeWarehouseLocationDictRow(row))
    .filter(
      (row: WarehouseLocationDictRow) =>
        row.id > 0 &&
        !isHiddenDefaultWarehouseName(row.name) &&
        !isHiddenDefaultWarehouseName(row.warehouse_name)
    )
}

function buildStockQueryParams(params?: Record<string, any>) {
  const next: Record<string, string | number> = {}
  if (!params) return next

  const page = toPositiveInt(params.page)
  const pageSize = toPositiveInt(params.page_size)
  const location = toPositiveInt(params.location ?? params.location_id)
  const productId = toPositiveInt(params.product_id ?? params.product)
  const rawMaterialId = toPositiveInt(params.raw_material_id ?? params.raw_material)
  const itemId = toPositiveInt(params.item_id)
  const q = String(params.q ?? "").trim()
  const itemType = String(params.item_type ?? "").trim()

  if (page) next.page = page
  if (pageSize) next.page_size = pageSize
  if (location) next.location = location
  if (itemType) next.item_type = normalizeItemType(itemType)
  if (q) next.q = q
  if (productId) next.product_id = productId
  if (rawMaterialId) next.raw_material_id = rawMaterialId
  if (itemId) next.item_id = itemId

  return next
}

async function getWarehouseStockResponse(params?: Record<string, any>) {
  const query = buildStockQueryParams(params)
  let lastError: unknown = null

  for (const url of WAREHOUSE_STOCK_CANDIDATES) {
    try {
      return await api.get(url, { params: query })
    } catch (error: any) {
      const status = Number(error?.response?.status || 0)
      if (status === 404) {
        lastError = error
        continue
      }
      throw error
    }
  }

  throw lastError ?? new Error("Warehouse stock endpoint topilmadi")
}

async function getWarehouseStockRows(params?: Record<string, any>) {
  const { data } = await getWarehouseStockResponse(params)
  return asArray(data).map((x: any, idx: number) => mapStockRow(x, idx))
}

function buildLedgerQueryParams(params?: Record<string, any>) {
  const next: Record<string, string | number> = {}
  if (!params) return next

  const page = toPositiveInt(params.page)
  const pageSize = toPositiveInt(params.page_size)
  const location = toPositiveInt(params.location ?? params.location_id)
  const itemType = String(params.item_type ?? "").trim()
  const movementType = normalizeMovementType(params.movement_type)
  const refType = String(params.ref_type ?? "").trim()
  const dateFrom = String(params.date_from ?? "").trim()
  const dateTo = String(params.date_to ?? "").trim()

  if (page) next.page = page
  if (pageSize) next.page_size = pageSize
  if (location) next.location = location
  if (itemType) next.item_type = normalizeItemType(itemType)
  if (refType) next.ref_type = refType
  if (movementType === "TRANSFER") {
    if (!next.ref_type) next.ref_type = "MANUAL_TRANSFER"
  } else if (movementType) {
    next.movement_type = movementType
  }
  if (dateFrom) next.date_from = dateFrom
  if (dateTo) next.date_to = dateTo

  return next
}

async function fetchAllCatalogRows(url: string) {
  const all: any[] = []
  let nextUrl: string | null = url
  let page = 1

  type CatalogPageResponse = {
    next?: unknown
    results?: unknown
    count?: unknown
    [key: string]: unknown
  }

  while (nextUrl) {
    const withFirstPageParams = (base: string) => {
      const sep = base.includes("?") ? "&" : "?"
      return `${base}${sep}page=1&page_size=1000&limit=1000`
    }
    const withPageParams = (base: string, p: number) => {
      const sep = base.includes("?") ? "&" : "?"
      return `${base}${sep}page=${p}&page_size=1000&limit=1000`
    }
    const normalizePageUrl = (candidate: string, fallbackBase: string, fallbackPage: number) => {
      const raw = String(candidate || "").trim()
      if (!raw) return withPageParams(fallbackBase, fallbackPage)
      if (!raw.startsWith("http")) return raw
      try {
        const parsed = new URL(raw)
        return `${parsed.pathname}${parsed.search}`
      } catch {
        return withPageParams(fallbackBase, fallbackPage)
      }
    }
    const requestUrl: string = nextUrl.startsWith("http")
      ? normalizePageUrl(nextUrl, url, page)
      : page === 1
        ? withFirstPageParams(nextUrl)
        : withPageParams(url, page)

    const response: { data: CatalogPageResponse | any[] } = await api.get(requestUrl)
    const data: CatalogPageResponse | any[] = response.data
    const rows = asArray(data)
    all.push(...rows)

    if (Array.isArray(data) || (!data?.next && !Array.isArray(data?.results))) {
      break
    }

    const next: unknown = Array.isArray(data) ? undefined : data?.next
    if (typeof next === "string" && next.trim()) {
      nextUrl = normalizePageUrl(next, url, page + 1)
      page += 1
    } else if (Array.isArray(data?.results) && Number(data?.count || 0) > all.length) {
      page += 1
      nextUrl = url
    } else {
      nextUrl = null
    }
  }

  const uniq = new Map<number, any>()
  for (const row of all) {
    const id = Number(row?.id ?? 0)
    if (id > 0 && !uniq.has(id)) uniq.set(id, row)
  }
  return Array.from(uniq.values())
}

// Stock endpointdan kelgan satrni UI ishlatadigan standart shape'ga map qiladi.
function mapStockRow(x: any, idx: number): StockOnHandItem {
  const qty = toNum(
    x?.balance_qty ??
      x?.available_qty ??
      x?.qty_onhand ??
      x?.total_qty ??
      x?.qty ??
      x?.quantity
  )
  const avgUnitCost = toNum(x?.avg_unit_cost ?? x?.unit_cost ?? x?.avg_cost)
  return {
    id:
      x?.id ??
      `${x?.item_type ?? "ITEM"}-${x?.item_id ?? x?.product_id ?? x?.product ?? x?.raw_material_id ?? x?.raw_material ?? idx}`,
    item_name: String(x?.item_name ?? x?.product_name ?? x?.raw_material_name ?? x?.name ?? "-"),
    item_type: normalizeItemType(x?.item_type ?? (x?.raw_material || x?.raw_material_id ? "RAW_MATERIAL" : x?.product || x?.product_id ? "FINISHED_PRODUCT" : "-")),
    qty_onhand: qty,
    value_onhand: toNum(x?.value_onhand ?? x?.total_value ?? x?.value ?? qty * avgUnitCost),
    avg_unit_cost: avgUnitCost,
    currency: String(x?.currency ?? "UZS"),
    location: toNum(x?.location ?? x?.location_id),
    location_name: String(x?.location_name ?? ""),
    product: toNum(x?.product ?? x?.product_id),
    product_name: String(x?.product_name ?? ""),
    raw_material: toNum(x?.raw_material ?? x?.raw_material_id),
    raw_material_name: String(x?.raw_material_name ?? ""),
    balance_qty: String(
      x?.balance_qty ??
        x?.available_qty ??
        x?.qty_onhand ??
        x?.total_qty ??
        x?.qty ??
        x?.quantity ??
        "0"
    ),
  }
}

// warehouse location maydoni backendga qarab nomlanishi farq qilsa (warehouse_location/location),
// avval berilgan payload bilan yuboradi, keyin kerak bo'lsa location kalitiga fallback qiladi.
async function postStockAction(url: string, payload: any) {
  const resolveItemType = (src: any) =>
    normalizeItemType(
      src?.item_type ?? (src?.raw_material ?? src?.raw_material_id ? "RAW_MATERIAL" : "FINISHED_PRODUCT")
    )
  const resolveItemId = (src: any) =>
    toPositiveInt(src?.item_id ?? src?.product_id ?? src?.product ?? src?.raw_material_id ?? src?.raw_material)
  const resolveLocation = (...values: any[]) => values.map((x) => toPositiveInt(x)).find((x) => x > 0) ?? 0
  const resolveNote = (src: any) => {
    const note = String(src?.note ?? src?.comment ?? "").trim()
    return note || undefined
  }

  const action =
    url.includes("/receipt/") ? "receipt" :
    url.includes("/issue/") ? "issue" :
    url.includes("/return/") ? "return" :
    url.includes("/transfer/") ? "transfer" :
    url.includes("/waste/") ? "waste" :
    "adjust"

  const cleanedPayload: Record<string, unknown> = {
    item_type: resolveItemType(payload),
    item_id: resolveItemId(payload),
    qty: normalizeQty(payload?.qty ?? payload?.quantity),
  }

  const note = resolveNote(payload)
  if (note) cleanedPayload.note = note
  const occurredAt = String(payload?.occurred_at ?? payload?.occurred_on ?? payload?.date ?? "").trim()
  if (occurredAt) cleanedPayload.occurred_at = occurredAt

  if (action === "transfer") {
    cleanedPayload.from_location = resolveLocation(
      payload?.from_location,
      payload?.from_location_id,
      payload?.warehouse_location,
      payload?.from_warehouse_location,
      payload?.location,
      payload?.location_id
    )
    cleanedPayload.to_location = resolveLocation(
      payload?.to_location,
      payload?.to_location_id,
      payload?.to_warehouse_location
    )
  } else {
    cleanedPayload.location = resolveLocation(
      payload?.location,
      payload?.location_id,
      payload?.warehouse_location,
      payload?.from_location,
      payload?.from_location_id
    )
  }

  if (action === "receipt") {
    cleanedPayload.unit_cost = toNum(payload?.unit_cost)
  }

  const isTransferPayload =
    cleanedPayload?.from_location !== undefined ||
    cleanedPayload?.to_location !== undefined

  const isUnknownFieldError = (value: unknown) => {
    const s = String(value || "").toLowerCase()
    return (
      s.includes("unknown field") ||
      s.includes("not allowed") ||
      s.includes("cannot be sent") ||
      s.includes("bu fieldni yuborish mumkin emas") ||
      s.includes("нельзя отправлять это поле")
    )
  }

  const isRequiredFieldError = (value: unknown) => {
    const s = String(value || "").toLowerCase()
    return (
      s.includes("required") ||
      s.includes("majburiy") ||
      s.includes("обязател") ||
      s.includes("this field is required")
    )
  }

  const temporalFields = new Set(["occurred_at", "occurred_on", "date"])

  const readTemporalValue = (src: any) => String(src?.occurred_at ?? src?.occurred_on ?? src?.date ?? "").trim()

  const buildTemporalPayload = (
    src: Record<string, unknown>,
    target: "occurred_at" | "occurred_on" | "date" | null
  ) => {
    const next = { ...src }
    delete next.occurred_at
    delete next.occurred_on
    delete next.date

    const occurredAt = readTemporalValue(src)
    const occurredOn = occurredAt ? occurredAt.slice(0, 10) : ""

    if (target === "occurred_at" && occurredAt) next.occurred_at = occurredAt
    if (target === "occurred_on" && occurredOn) next.occurred_on = occurredOn
    if (target === "date" && occurredOn) next.date = occurredOn

    return next
  }

  const remapPayloadForStrictSerializer = (src: any, errors: Record<string, unknown>) => {
    const next = { ...src }

    const setIf = (to: string, from: string) => {
      if (next[from] !== undefined && next[to] === undefined) next[to] = next[from]
    }

    if (isUnknownFieldError(errors?.warehouse_location) && !isTransferPayload) {
      setIf("warehouse_location", "location")
    }
    if (isUnknownFieldError(errors?.item_id)) {
      if (String(next.item_type || "").toUpperCase() === "RAW_MATERIAL") {
        setIf("raw_material", "item_id")
        setIf("raw_material_id", "item_id")
      } else {
        setIf("product", "item_id")
        setIf("product_id", "item_id")
      }
    }
    if (isUnknownFieldError(errors?.qty)) setIf("quantity", "qty")
    if (isUnknownFieldError(errors?.note)) setIf("comment", "note")
    if (isRequiredFieldError(errors?.warehouse_location) && !isTransferPayload) {
      setIf("warehouse_location", "location")
    }
    if (isRequiredFieldError(errors?.from_location)) {
      setIf("from_location", "location")
    }
    if (isRequiredFieldError(errors?.to_warehouse_location)) {
      setIf("to_warehouse_location", "to_location")
    }
    if (isRequiredFieldError(errors?.to_location)) {
      setIf("to_location", "to_warehouse_location")
    }
    if (isRequiredFieldError(errors?.item_id)) {
      if (String(next.item_type || "").toUpperCase() === "RAW_MATERIAL") {
        setIf("item_id", "raw_material")
        setIf("item_id", "raw_material_id")
      } else {
        setIf("item_id", "product")
        setIf("item_id", "product_id")
      }
    }
    if (isRequiredFieldError(errors?.raw_material) || isRequiredFieldError(errors?.raw_material_id)) {
      setIf("raw_material", "item_id")
      setIf("raw_material_id", "item_id")
    }
    if (isRequiredFieldError(errors?.product) || isRequiredFieldError(errors?.product_id)) {
      setIf("product", "item_id")
      setIf("product_id", "item_id")
    }
    if (isRequiredFieldError(errors?.qty)) setIf("qty", "quantity")
    if (isRequiredFieldError(errors?.quantity)) setIf("quantity", "qty")
    if (isRequiredFieldError(errors?.note)) setIf("note", "comment")
    if (isRequiredFieldError(errors?.comment)) setIf("comment", "note")
    for (const [field, message] of Object.entries(errors || {})) {
      if (temporalFields.has(field)) continue
      if (isUnknownFieldError(message)) delete next[field]
    }

    const temporalTargets: Array<"occurred_at" | "occurred_on" | "date" | null> = []
    const pushTemporalTarget = (target: "occurred_at" | "occurred_on" | "date" | null) => {
      if (!temporalTargets.includes(target)) temporalTargets.push(target)
    }

    if (isRequiredFieldError(errors?.occurred_at)) pushTemporalTarget("occurred_at")
    if (isRequiredFieldError(errors?.occurred_on)) pushTemporalTarget("occurred_on")
    if (isRequiredFieldError(errors?.date)) pushTemporalTarget("date")

    if (isUnknownFieldError(errors?.occurred_at)) {
      pushTemporalTarget("occurred_on")
      pushTemporalTarget("date")
      pushTemporalTarget(null)
    }
    if (isUnknownFieldError(errors?.occurred_on)) {
      pushTemporalTarget("occurred_at")
      pushTemporalTarget("date")
      pushTemporalTarget(null)
    }
    if (isUnknownFieldError(errors?.date)) {
      pushTemporalTarget("occurred_on")
      pushTemporalTarget("occurred_at")
      pushTemporalTarget(null)
    }

    if (temporalTargets.length === 0) {
      return [next]
    }

    return temporalTargets.map((target) => buildTemporalPayload(next, target))
  }

  const queue: Record<string, unknown>[] = [cleanedPayload]
  const seen = new Set<string>()
  let lastError: any = null

  while (queue.length > 0) {
    const currentPayload = queue.shift()
    if (!currentPayload) continue

    const currentKey = JSON.stringify(currentPayload)
    if (seen.has(currentKey)) continue
    seen.add(currentKey)

    try {
      return await api.post(url, currentPayload)
    } catch (error: any) {
      lastError = error
      const data = error?.response?.data

      if (data && typeof data === "object" && !Array.isArray(data)) {
        const retryPayloads = remapPayloadForStrictSerializer(currentPayload, data as Record<string, unknown>)
        retryPayloads.forEach((candidate) => {
          const candidateKey = JSON.stringify(candidate)
          if (candidateKey !== currentKey && !seen.has(candidateKey)) queue.push(candidate)
        })
      }
    }
  }

  throw lastError
}

export const warehouseApi = {
  // Warehouse overview KPI ma'lumotlarini oladi.
  async overview(): Promise<OverviewSummary> {
    try {
      const [dashboardData, overviewData] = await Promise.all([
        getFirstAvailableData(WAREHOUSE_DASHBOARD_CANDIDATES).catch(() => null),
        getFirstAvailableData(WAREHOUSE_OVERVIEW_CANDIDATES).catch(() => null),
      ])
      const totalsSource = hasOverviewTotals(dashboardData) ? dashboardData : hasOverviewTotals(overviewData) ? overviewData : null
      const movementSource = overviewData && typeof overviewData === "object" ? overviewData : dashboardData
      const stockRows =
        totalsSource
          ? null
          : await getWarehouseStockRows({ page: 1, page_size: 5000 }).catch(() => [])
      return {
        total_items: toNum(totalsSource?.total_items ?? totalsSource?.items_count ?? stockRows?.length ?? 0),
        total_qty: toNum(
          totalsSource?.total_qty ??
            totalsSource?.qty_total ??
            stockRows?.reduce((sum: number, row: StockOnHandItem) => sum + toNum(row.balance_qty), 0) ??
            0
        ),
        total_value: toNum(
          totalsSource?.total_value ??
            totalsSource?.value_total ??
            stockRows?.reduce(
              (sum: number, row: StockOnHandItem) => sum + toNum(row.balance_qty) * toNum(row.avg_unit_cost),
              0
            ) ??
            0
        ),
        low_stock_count: toNum(
          totalsSource?.low_stock_count ??
            totalsSource?.critical_count ??
            stockRows?.filter((row: StockOnHandItem) => toNum(row.balance_qty) <= 0).length ??
            0
        ),
        today: movementSource?.today ? String(movementSource.today) : undefined,
        movements_today:
          movementSource?.movements_today && typeof movementSource.movements_today === "object"
            ? {
                in_qty: readOverviewMovementQty(movementSource, ["in_qty", "IN", "in", "incoming", "receipt"]),
                out_qty: readOverviewMovementQty(movementSource, ["out_qty", "OUT", "out", "outgoing", "issue"]),
              }
            : undefined,
      }
    } catch {
      const rows = await getWarehouseStockRows({ page: 1, page_size: 5000 })
      return {
        total_items: rows.length,
        total_qty: rows.reduce((sum: number, row: StockOnHandItem) => sum + toNum(row.balance_qty), 0),
        total_value: rows.reduce((sum: number, row: StockOnHandItem) => sum + toNum(row.balance_qty) * toNum(row.avg_unit_cost), 0),
        low_stock_count: rows.filter((row: StockOnHandItem) => toNum(row.balance_qty) <= 0).length,
        today: new Date().toISOString().slice(0, 10),
        movements_today: {
          in_qty: 0,
          out_qty: 0,
        },
      }
    }
  },

  // Dashboard uchun eski nom mosligi: summary = overview.
  async getSummary() {
    return this.overview()
  },

  // Stock meta ichidan alert/low-stock ro'yxatini soddalashtirib qaytaradi.
  async getCriticalAlerts(): Promise<AlertItem[]> {
    try {
      const { data } = await api.get("/api/v1/warehouse/stock/meta/")
      const lows = asArray(data?.low_stock ?? data?.alerts ?? [])
      if (lows.length === 0) {
        const stockRows = await getWarehouseStockRows({ page: 1, page_size: 5000 })
        return stockRows
          .filter((row: StockOnHandItem) => toNum(row.balance_qty) <= 0)
          .map((row: StockOnHandItem, i: number) => ({
            id: row.id ?? i,
            title: String(row.item_name ?? "Low stock"),
            message: `${row.location_name || "Joylashuv"} uchun qoldiq tugagan`,
          }))
      }
      return lows.map((x: any, i: number) => ({
        id: x?.id ?? i,
        title: String(x?.item_name ?? x?.name ?? "Low stock"),
        message: String(x?.message ?? "Stock kamaygan"),
      }))
    } catch {
      return []
    }
  },

  // /warehouse/stock/ dan stock listni pagination bilan oladi.
  async listStock(params?: Record<string, any>) {
    const { data } = await getWarehouseStockResponse(params)
    const list = asArray(data).map((x: any, idx: number) => mapStockRow(x, idx))
    return {
      results: list,
      count: Number(data?.count ?? list.length),
      next: data?.next ?? null,
      previous: data?.previous ?? null,
    }
  },

  // /warehouse/stock/meta/ ni xom ko'rinishda qaytaradi.
  async stockMeta(): Promise<WarehouseStockMeta> {
    const { data } = await api.get("/api/v1/warehouse/stock/meta/")
    return normalizeStockMeta(data)
  },

  // Warehouse stock ro'yxatini xom ko'rinishda qaytaradi.
  async stockOnHand(params?: Record<string, any>) {
    const { data } = await getWarehouseStockResponse(params)
    return data
  },

  // Stock page uchun on-hand javobini UI formatiga map qiladi.
  async fetchStock(params?: Record<string, any>) {
    const { data } = await getWarehouseStockResponse(params)
    const list = asArray(data).map((x: any, idx: number) => mapStockRow(x, idx))

    return {
      results: list,
      count: Number(data?.count ?? list.length),
      next: data?.next ?? null,
      previous: data?.previous ?? null,
    }
  },

  // /warehouse/ledger/ dan movement (kirim/chiqim) tarixini oladi.
  async listMovementsPage(params?: {
    page?: number
    page_size?: number
    item_type?: string
    item_id?: number
    product?: number
    product_id?: number
    raw_material?: number
    raw_material_id?: number
    location?: number
    movement_type?: string
    ref_type?: string
    date_from?: string
    date_to?: string
  }) {
    const { data } = await api.get("/api/v1/warehouse/ledger/", { params: buildLedgerQueryParams(params as Record<string, any>) })
    let rows = asArray(data).map((x: any) => ({
      id: x?.id,
      type: normalizeLedgerMovementType(x?.movement_type ?? x?.type ?? "IN", x?.ref_type),
      movement_type: normalizeLedgerMovementType(x?.movement_type ?? x?.type ?? "IN", x?.ref_type),
      item_type: normalizeItemType(
        x?.item_type ??
          (x?.raw_material || x?.raw_material_id ? "RAW_MATERIAL" : x?.product || x?.product_id ? "FINISHED_PRODUCT" : "ITEM")
      ),
      item_id: toNum(x?.item_id ?? x?.raw_material ?? x?.raw_material_id ?? x?.product ?? x?.product_id),
      location: toNum(x?.location ?? x?.location_id ?? x?.warehouse_location ?? x?.from_location),
      location_name: String(x?.location_name ?? ""),
      from_location_name: String(x?.from_location_name ?? x?.source_location_name ?? x?.location_name ?? ""),
      to_location_name: String(x?.to_location_name ?? x?.target_location_name ?? ""),
      from_location: toNum(x?.from_location ?? x?.location ?? x?.location_id),
      to_location: toNum(x?.to_location),
      itemName: String(x?.item_name ?? x?.product_name ?? x?.raw_material_name ?? "-"),
      qty: toNum(x?.qty ?? x?.quantity),
      unit_cost: toNum(x?.unit_cost),
      total: toNum(x?.total_cost ?? x?.total ?? x?.amount ?? x?.value),
      currency: String(x?.currency ?? "UZS"),
      ref_type: x?.ref_type ? String(x.ref_type) : undefined,
      ref_id: x?.ref_id === null || x?.ref_id === undefined ? null : toNum(x.ref_id),
      date: String(x?.occurred_at ?? x?.date ?? x?.created_at ?? new Date().toISOString()),
      note: x?.note ? String(x.note) : undefined,
    }))

    const targetItemId = toPositiveInt(params?.item_id ?? params?.product_id ?? params?.product ?? params?.raw_material_id ?? params?.raw_material)
    if (targetItemId) {
      rows = rows.filter((row: MovementItem) => toPositiveInt(row.item_id) === targetItemId)
    }

    return {
      results: rows,
      count: Number(targetItemId ? rows.length : data?.count ?? rows.length),
      next: data?.next ?? null,
      previous: data?.previous ?? null,
    }
  },

  // /warehouse/ledger/ dan movement (kirim/chiqim) tarixini oladi.
  async listMovements(): Promise<MovementItem[]> {
    const res = await this.listMovementsPage({ page: 1, page_size: 100 })
    return res.results
  },

  // Dashboarddagi eski chaqiriqlar uchun mos wrapper.
  async ledgerList() {
    const rows = await this.listMovements()
    return { results: rows, count: rows.length }
  },

  async ledgerDetail(id: number) {
    const { data } = await api.get(`/api/v1/warehouse/ledger/${id}/`)
    return data
  },

  async deleteLedgerMovement(id: number) {
    const candidates = [
      `/api/v1/warehouse/ledger/${id}/`,
      `/api/v1/warehouse/ledger/${id}`,
    ]
    for (const url of candidates) {
      try {
        const { data } = await api.delete(url)
        warehouseEvents.emit()
        return data
      } catch (error: any) {
        const status = Number(error?.response?.status || 0)
        if (status === 404) continue
        throw error
      }
    }
    throw new Error("Ledger delete endpoint topilmadi")
  },

  ledgerExportUrl(params?: Record<string, any>) {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== null && value !== "") qs.set(key, String(value))
    }
    const query = qs.toString()
    return `/api/v1/warehouse/ledger/export/${query ? `?${query}` : ""}`
  },

  async ledgerExport(params?: Record<string, any>) {
    const { data, headers } = await api.get(this.ledgerExportUrl(params), {
      responseType: "blob",
    })
    return {
      data,
      contentType: headers?.["content-type"],
    }
  },

  async ledgerDetailExport(id: number) {
    const { data, headers } = await api.get(`/api/v1/warehouse/ledger/${id}/export/`, {
      responseType: "blob",
    })
    return {
      data,
      contentType: headers?.["content-type"],
    }
  },

  // Stock issue (chiqim) action endpointi.
  async issue(payload: any) {
    const { data } = await postStockAction("/api/v1/warehouse/stock/issue/", payload)
    warehouseEvents.emit()
    return data
  },

  // Stock receipt (kirim) action endpointi.
  async receipt(payload: any) {
    const { data } = await postStockAction("/api/v1/warehouse/stock/receipt/", payload)
    warehouseEvents.emit()
    return data
  },

  // Stock return action endpointi.
  async returnStock(payload: any) {
    const { data } = await postStockAction("/api/v1/warehouse/stock/return/", payload)
    warehouseEvents.emit()
    return data
  },

  // Stock transfer action endpointi.
  async transfer(payload: any) {
    const { data } = await postStockAction("/api/v1/warehouse/stock/transfer/", payload)
    warehouseEvents.emit()
    return data
  },

  // Stock waste action endpointi.
  async waste(payload: any) {
    const { data } = await postStockAction("/api/v1/warehouse/stock/waste/", payload)
    warehouseEvents.emit()
    return data
  },

  // Stock adjust action endpointi.
  async adjust(payload: any) {
    const { data } = await postStockAction("/api/v1/warehouse/stock/adjust/", payload)
    warehouseEvents.emit()
    return data
  },

  // Legacy moslik uchun eski waste-adjust actionini yangi endpointlarga yo'naltiradi.
  async wasteAdjust(payload: any) {
    const movementType = normalizeMovementType(payload?.movement_type || "WASTE")
    if (movementType === "ADJUST") return this.adjust(payload)
    return this.waste(payload)
  },

  // Action nomiga qarab tegishli warehouse stock endpointiga yuboradi.
  async stockAction(action: WarehouseAction, payload: any) {
    if (action === "issue") return this.issue(payload)
    if (action === "receipt") return this.receipt(payload)
    if (action === "return") return this.returnStock(payload)
    if (action === "transfer") return this.transfer(payload)
    if (action === "waste") return this.waste(payload)
    if (action === "adjust") return this.adjust(payload)
    return this.wasteAdjust(payload)
  },

  // Legacy moslik: eski code createMovement desa receipt ishlatiladi.
  async createMovement(payload: any) {
    return this.receipt(payload)
  },

  // Legacy moslik: eski code createInventoryCount desa waste-adjust ishlatiladi.
  async createInventoryCount(payload: any) {
    const movementType = normalizeMovementType(payload?.movement_type || "ADJUST")
    return movementType === "WASTE" ? this.waste(payload) : this.adjust(payload)
  },

  // Warehouse ro'yxatini dropdown/select uchun qaytaradi.
  async listWarehouses(): Promise<LookupItem[]> {
    const rows = await fetchWarehouseLocationDictRows()
    return rows.map((row: WarehouseLocationDictRow) => ({
      id: row.id,
      name: row.name,
    }))
  },

  // Warehouse select uchun location ro'yxatidan warehouselarni hosil qiladi.
  // location row ichida warehouse maydoni bo'lsa o'shani oladi, bo'lmasa id/name fallback qiladi.
  async listWarehousesFromLocations(): Promise<Array<LookupItem & { default_location_id?: number }>> {
    const rows = await fetchWarehouseLocationDictRows()
    const mapped = rows.map((row: WarehouseLocationDictRow) => ({
      id: row.warehouse_id ?? row.id,
      name: row.warehouse_name ?? row.name,
      default_location_id: row.id,
    }))

    const uniq = new Map<number, { name: string; default_location_id?: number }>()
    for (const item of mapped) {
      if (!uniq.has(item.id)) {
        uniq.set(item.id, { name: item.name, default_location_id: item.default_location_id })
      }
    }
    return Array.from(uniq.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      default_location_id: v.default_location_id,
    }))
  },

  // Product ro'yxatini dropdown/select uchun qaytaradi.
  async listProducts(): Promise<LookupItem[]> {
    const rows = await fetchAllCatalogRows("/api/v1/catalog/products/")
    return rows
      .map((x: any) => ({
        id: Number(x?.id ?? 0),
        name: String(x?.name ?? `Product #${x?.id ?? "-"}`),
        category_name: x?.category_name ? String(x.category_name) : null,
      }))
      .filter((x: LookupItem) => x.id > 0)
  },

  // Raw material ro'yxatini dropdown/select uchun qaytaradi.
  async listMaterials(): Promise<LookupItem[]> {
    return []
  },

  // Supplier ro'yxatini prixod dialogida tanlash uchun qaytaradi.
  async listSuppliers(): Promise<LookupItem[]> {
    const suppliers = await apiAxios.listSuppliersPage({
      page: 1,
      page_size: 500,
      ordering: "name",
      is_active: true,
    })
    return suppliers.items
      .map((x: any) => ({
        id: Number(x?.id ?? 0),
        name: String(x?.name ?? x?.company ?? `Supplier #${x?.id ?? "-"}`),
      }))
      .filter((x: LookupItem) => x.id > 0)
  },

  // Warehouse tanlanganda location API listini oladi. Endpoint nomlari turli bo'lishi mumkin.
  async listWarehouseLocations(warehouseId?: number): Promise<LookupItem[]> {
    const rows = await fetchWarehouseLocationDictRows()
    return rows
      .filter((row: WarehouseLocationDictRow) => !warehouseId || !row.warehouse_id || row.warehouse_id === warehouseId)
      .map((row: WarehouseLocationDictRow) => ({
        id: row.id,
        name: row.name,
      }))
      .filter((x: LookupItem) => x.id > 0)
  },

  // Warehouse location select uchun location+warehouse bog'lanishini qaytaradi.
  async listWarehouseLocationOptions(warehouseId?: number): Promise<Array<LookupItem & { warehouse_id?: number }>> {
    return (await fetchWarehouseLocationDictRows())
      .filter((row: WarehouseLocationDictRow) => !warehouseId || !row.warehouse_id || row.warehouse_id === warehouseId)
      .map((row: WarehouseLocationDictRow) => ({
        id: row.id,
        name: row.name,
        warehouse_id: row.warehouse_id ?? row.id,
      }))
      .filter((x: LookupItem & { warehouse_id?: number }) => x.id > 0)
  },

  // Ichki buyurtma yaratadi (candidate endpointlar + fallback /orders/).
  async createInternalOrder(payload: any) {
    const firstItem = Array.isArray(payload?.items) ? payload.items[0] : null
    const itemType = normalizeItemType(payload?.item_type ?? firstItem?.item_type)
    const itemId = toPositiveInt(
      payload?.item_id ??
        firstItem?.item_id ??
        firstItem?.product ??
        firstItem?.product_id ??
        firstItem?.raw_material ??
        firstItem?.raw_material_id
    )
    const fromLocation = toPositiveInt(
      payload?.from_location ?? payload?.from_location_id ?? payload?.warehouse_location ?? payload?.location
    )
    const toLocation = toPositiveInt(
      payload?.to_location ?? payload?.to_location_id ?? payload?.to_warehouse_location ?? payload?.to_location_id
    )

    if (!itemId) throw new Error("Internal transfer uchun item topilmadi")
    if (!fromLocation || !toLocation) throw new Error("Internal transfer uchun from/to location topilmadi")

    return this.transfer({
      item_type: itemType,
      item_id: itemId,
      from_location: fromLocation,
      to_location: toLocation,
      qty: normalizeQty(payload?.qty ?? firstItem?.qty),
      note: String(payload?.note ?? "").trim() || undefined,
    })
  },

  // Warehouse yaratadi.
  async createWarehouse(payload: any) {
    const body = { name: String(payload?.name ?? "").trim() }
    const candidates = [...WAREHOUSE_BASE_CANDIDATES, ...WAREHOUSE_DICT_BASE_CANDIDATES]
    for (const url of candidates) {
      try {
        const { data } = await api.post(url, body)
        warehouseEvents.emit()
        return data
      } catch (error: any) {
        const status = Number(error?.response?.status || 0)
        if (status !== 404) throw error
      }
    }
    throw new Error("Warehouse create endpoint topilmadi")
  },

  // Warehouse o'chiradi.
  async deleteWarehouse(warehouseId: number) {
    const candidates = [
      ...buildDetailCandidates(warehouseId, WAREHOUSE_BASE_CANDIDATES),
      ...buildDetailCandidates(warehouseId, WAREHOUSE_DICT_BASE_CANDIDATES),
    ]
    for (const url of candidates) {
      try {
        const { data } = await api.delete(url)
        warehouseEvents.emit()
        return data
      } catch (error: any) {
        const status = Number(error?.response?.status || 0)
        if (status !== 404) throw error
      }
    }
    throw new Error("Warehouse delete endpoint topilmadi")
  },

  // Warehouse nomini yangilaydi.
  async updateWarehouse(warehouseId: number, payload: { name: string }) {
    const body = { name: String(payload?.name ?? "").trim() }
    const candidates = [
      ...buildDetailCandidates(warehouseId, WAREHOUSE_BASE_CANDIDATES),
      ...buildDetailCandidates(warehouseId, WAREHOUSE_DICT_BASE_CANDIDATES),
    ]
    for (const url of candidates) {
      try {
        const { data } = await api.patch(url, body)
        warehouseEvents.emit()
        return data
      } catch (error: any) {
        const status = Number(error?.response?.status || 0)
        if (status === 404) continue
        try {
          const { data } = await api.put(url, body)
          warehouseEvents.emit()
          return data
        } catch (putError: any) {
          const putStatus = Number(putError?.response?.status || 0)
          if (putStatus !== 404) throw putError
        }
      }
    }
    throw new Error("Warehouse update endpoint topilmadi")
  },

  // Warehouse location yaratadi.
  async createWarehouseLocation(payload: any) {
    const { data } = await api.post("/api/v1/dicts/locations/", {
      name: String(payload?.name ?? "").trim(),
    })
    warehouseEvents.emit()
    return data
  },
}
