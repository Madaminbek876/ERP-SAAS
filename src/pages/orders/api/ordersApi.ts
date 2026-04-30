// src/Api/orders.ts
import { api } from "@/lib/api" // sizdagi axios instance path moslang
import type { ReactNode } from "react"
import { unwrapResults } from "@/lib/unwrap"
import { salesEvents } from "./events"

export const ORDER_STATUS_VALUES = [
  "NEW",
  "IN_PROGRESS",
  "DELIVERED",
  "CANCELLED",
] as const

export type KnownOrderStatus = (typeof ORDER_STATUS_VALUES)[number]
export type OrderStatus = KnownOrderStatus | "UNKNOWN"

const ORDER_STATUS_ALIAS_MAP: Record<KnownOrderStatus, readonly string[]> = {
  NEW: ["NEW"],
  IN_PROGRESS: ["IN_PROGRESS", "INPROGRESS", "PROCESSING", "CONFIRMED"],
  DELIVERED: ["DELIVERED", "COMPLETED", "DONE", "CLOSED", "FULFILLED"],
  CANCELLED: ["CANCELLED", "CANCELED"],
}

export function isOrderStatus(value: unknown): value is KnownOrderStatus {
  return ORDER_STATUS_VALUES.includes(String(value ?? "").trim().toUpperCase() as KnownOrderStatus)
}

export function normalizeOrderStatus(value: unknown, fallback: OrderStatus = "UNKNOWN"): OrderStatus {
  const status = String(value ?? "").trim().toUpperCase()
  if (!status) return fallback
  for (const [canonicalStatus, aliases] of Object.entries(ORDER_STATUS_ALIAS_MAP) as Array<[KnownOrderStatus, readonly string[]]>) {
    if (aliases.includes(status)) return canonicalStatus
  }
  return isOrderStatus(status) ? status : fallback
}

export function canConfirmOrderStatus(value: unknown) {
  const status = normalizeOrderStatus(value)
  return status === "NEW" || status === "CANCELLED"
}

export function canCancelOrderStatus(value: unknown) {
  const status = normalizeOrderStatus(value)
  return status === "NEW" || status === "IN_PROGRESS"
}

export function canShipOrderStatus(value: unknown) {
  return false
}

export function canDeliverOrderStatus(value: unknown) {
  return normalizeOrderStatus(value) === "IN_PROGRESS"
}

export function getOrderStatusSelectOptions(value: unknown): OrderStatus[] {
  const current = normalizeOrderStatus(value)
  const options = new Set<OrderStatus>([current])

  if (canConfirmOrderStatus(current)) options.add("IN_PROGRESS")
  if (canCancelOrderStatus(current)) options.add("CANCELLED")
  if (canDeliverOrderStatus(current)) options.add("DELIVERED")

  return [current, ...ORDER_STATUS_VALUES.filter((status) => status !== current && options.has(status))]
}

export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID" | string

export interface OnHandRow {
  currency: ReactNode
  item_type: "FINISHED_PRODUCT" | "PRODUCT" | "RAW_MATERIAL"
  product_id: number | null
  raw_material_id: number | null
  location_id: number | null
  item_name: string | null
  qty_onhand: string // "1.000000"
  value_onhand: number
  avg_unit_cost: number
}

export async function getProductOnHand(params: {
  warehouse_id?: number
  location_id?: number
  product_id: number
}): Promise<number> {
  const { data } = await api.get<OnHandRow[]>(
    "/api/v1/warehouse/stock/",
    {
      params: {
        // ✅ odatda backend shunaqa qabul qiladi:
        location: params.location_id,
        item_type: "FINISHED_PRODUCT",
        product_id: params.product_id,
      },
    }
  )

  const rows = unwrapResults<OnHandRow>(data).filter((r) => {
    if (r.item_type !== "PRODUCT" && r.item_type !== "FINISHED_PRODUCT") return false
    if (r.product_id !== params.product_id) return false
    // agar location_id berilgan bo‘lsa frontda ham filtrlaymiz
    if (params.location_id && r.location_id !== params.location_id) return false
    return true
  })

  // hamma locationlar bo‘yicha yig‘ib yuboramiz (warehouse bo‘yicha filtr backend qilsa ham, qilmasa ham)
  return rows.reduce((sum, r) => sum + Number(r.qty_onhand || 0), 0)
}


export interface Kontragent {
  id: number
  kind: string
  code: string
  name: string
  phone?: string | null
  email?: string | null
  inn?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

function normalizeKontragentKind(value: unknown) {
  return toText(value).toUpperCase()
}

function isClientLikeKontragent(value: unknown) {
  const kind = normalizeKontragentKind(value)
  if (!kind) return true
  return kind.includes("CLIENT") || kind.includes("CUSTOMER") || kind.includes("BOTH")
}

function normalizeKontragent(row: any): Kontragent {
  return {
    id: Number(row?.id ?? 0),
    kind: toText(row?.kind ?? row?.type, "CLIENT"),
    code: toText(row?.code),
    name: toText(row?.name),
    phone: row?.phone ? toText(row.phone) : null,
    email: row?.email ? toText(row.email) : null,
    inn: row?.inn ? toText(row.inn) : row?.tax_id ? toText(row.tax_id) : null,
    is_active: row?.is_active === undefined ? true : Boolean(row.is_active),
    created_at: row?.created_at ? toText(row.created_at) : undefined,
    updated_at: row?.updated_at ? toText(row.updated_at) : undefined,
  }
}

export interface Product {
  id: number
  name: string
  category: number | null
  category_name: string | null
  uom: number
  uom_name: string
  default_selling_price: number | null
  currency: string
  nds_applies?: boolean
  nds_rate?: string
  nds_included?: boolean
  created_at?: string
}

export interface Branch {
  id: number
  name: string
}

export interface Warehouse {
  id: number
  name: string
  branch?: number
  branch_name?: string
}

export interface WarehouseLocation {
  id: number
  name: string
  warehouse_id: number | null
  warehouse_name?: string
}

function toPositiveInt(value: any): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeProduct(row: any): Product {
  return {
    id: Number(row?.id ?? 0),
    name: String(row?.name ?? ""),
    category: toNullableNumber(row?.category),
    category_name: row?.category_name ? String(row.category_name) : null,
    uom: Number(row?.uom ?? 0),
    uom_name: String(row?.uom_name ?? ""),
    default_selling_price: toNullableNumber(row?.default_selling_price ?? row?.selling_price),
    currency: String(row?.currency ?? "UZS"),
    nds_applies: row?.nds_applies === undefined ? undefined : Boolean(row.nds_applies),
    nds_rate: row?.nds_rate ? String(row.nds_rate) : undefined,
    nds_included: row?.nds_included === undefined ? undefined : Boolean(row.nds_included),
    created_at: row?.created_at ? String(row.created_at) : undefined,
  }
}

function toPositiveIntLoose(value: any): number {
  const direct = toPositiveInt(value)
  if (direct) return direct
  if (typeof value === "string") {
    const trimmed = value.trim()
    const asNumber = toPositiveInt(trimmed)
    if (asNumber) return asNumber
    // URL yoki matndan oxirgi sonni olish: "/api/v1/warehouses/12/" -> 12
    const m = trimmed.match(/(\d+)(?!.*\d)/)
    if (m) return toPositiveInt(m[1])
  }
  return 0
}

function extractWarehouseId(row: any): number {
  const nestedWarehouse =
    typeof row?.warehouse === "object" && row?.warehouse !== null ? row.warehouse : null
  const primitiveWarehouse =
    typeof row?.warehouse === "number" || typeof row?.warehouse === "string" ? row.warehouse : undefined

  return toPositiveIntLoose(
    row?.warehouse_id ??
      primitiveWarehouse ??
      nestedWarehouse?.id ??
      nestedWarehouse?.pk ??
      row?.warehouse_pk ??
      row?.warehouseId ??
      row?.warehouse_ref ??
      0
  )
}

function normalizeWarehouseLocationLookup(row: any): WarehouseLocation {
  const nestedWarehouse =
    typeof row?.warehouse === "object" && row?.warehouse !== null ? row.warehouse : null
  const locationId = toPositiveInt(row?.id ?? row?.location_id ?? row?.value ?? 0)
  const warehouseId = extractWarehouseId(row)
  const warehouseName = String(row?.warehouse_name ?? nestedWarehouse?.name ?? "").trim()
  const name = String(
    row?.name ??
      row?.label ??
      row?.title ??
      (warehouseName ? `${warehouseName} - #${locationId}` : `Location #${locationId || "-"}`)
  )

  return {
    id: locationId,
    name,
    warehouse_id: warehouseId || null,
    warehouse_name: warehouseName || undefined,
  }
}

async function fetchDictWarehouseLocationRows(): Promise<WarehouseLocation[]> {
  const { data } = await api.get("/api/v1/dicts/locations/")
  return unwrapResults<any>(data?.locations ?? data)
    .map((row) => normalizeWarehouseLocationLookup(row))
    .filter((row: WarehouseLocation) => row.id > 0)
}

// Stock shape (siz backenddan qanday berishini bilmaganim uchun minimal)
export interface StockResponse {
  qty: number
  uom_name?: string
}

export interface OrderItemCreate {
  // Create serializer uchun asosiy item maydonlari.
  // item_type backendda default bo'lsa yubormaslik ham mumkin.
  item_type?: "FINISHED_PRODUCT" | "RAW_MATERIAL" | string
  product?: number
  raw_material?: number
  qty: string
  unit_price: number
  nds_rate?: number | string
  line_total?: number
}

export interface OrderCreatePayload {
  client: number
  order_date: string
  currency?: "UZS" | "USD" | string
  discount_total?: number
  notes?: string
  delivery_address?: string
  courier_name?: string
  delivery_date?: string | null
  items: OrderItemCreate[]
}

export interface WarehouseStockRow {
  item_type: "FINISHED_PRODUCT" | "PRODUCT" | "RAW_MATERIAL"
  product_id: number | null
  raw_material_id: number | null
  location_id: number | null
  item_name: string | null
  qty_onhand: string // "1.000000"
  value_onhand: number
  avg_unit_cost: number
}

export async function getProductOnhand(params: {
  warehouse_id?: number
  location_id?: number
  product_id: number
}): Promise<number> {
  const { data } = await api.get<WarehouseStockRow[]>("/api/v1/warehouse/stock/", {
    params: {
      // backend qo‘llasa ishlaydi:
      location: params.location_id,
      item_type: "FINISHED_PRODUCT",
      product_id: params.product_id,
    },
  })

  // Agar backend filterlarni ishlatmasa ham, biz frontda filtrlaymiz:
  const rows = unwrapResults<WarehouseStockRow>(data).filter(
    (r) => (r.item_type === "PRODUCT" || r.item_type === "FINISHED_PRODUCT") && r.product_id === params.product_id
  )

  // locationlar bo‘yicha yig‘ib qo‘yamiz
  const sum = rows.reduce((s, r) => s + Number(r.qty_onhand || 0), 0)
  return sum
}

export type OrdersListParams = {
  status?: string
  payment_status?: string
  client?: number
  date_from?: string
  date_to?: string
  search?: string
  ordering?: string
  shipment_state?: "none" | "partial" | "full" | string
  page?: number
  page_size?: number
}

export type OrdersListResponse<T = any> = {
  count: number
  next?: string | null
  previous?: string | null
  results: T[]
}

export interface OrderSummary {
  id: number
  order_no: string
  client_code?: string
  client_name?: string
  order_date: string
  status: OrderStatus
  payment_status: string
  currency: string
  total: number
  paid_amount: number
  remaining: number
  delivery_date?: string | null
  created_at?: string
  updated_at?: string
}

export interface OrderDetailClient {
  id: number
  code?: string
  name?: string
  phone?: string | null
  inn?: string | null
}

export interface OrderDetailItem {
  id: number
  item_type?: "FINISHED_PRODUCT" | "RAW_MATERIAL" | string
  product?: number | null
  raw_material?: number | null
  product_name?: string | null
  raw_material_name?: string | null
  qty: string
  unit_price: number
  nds_rate?: string | number
  nds_included?: boolean
  line_subtotal?: number
  nds_amount?: number
  line_total?: number
}

export interface OrderReservation {
  id?: number
  reservation_id?: number
  item_id?: number
  item_name?: string | null
  location?: number | null
  location_name?: string | null
  qty?: string
  qty_issued?: string
  status?: string
  note?: string | null
  created_at?: string
  updated_at?: string
}

export interface OrderStatusHistoryRow {
  id?: number
  from_status?: string
  to_status?: string
  status?: string
  note?: string | null
  changed_at?: string | null
  created_at?: string
  created_by_name?: string | null
}

export interface OrderPaymentRow {
  id?: number
  method?: string
  amount?: number
  currency?: string
  note?: string | null
  paid_at?: string | null
  created_at?: string
}

export interface OrderDetailResponse {
  id: number
  order_no: string
  client?: OrderDetailClient | null
  order_date: string
  status: OrderStatus
  cancelled_reason?: string | null
  currency: string
  subtotal?: number
  nds_total?: number
  discount_total?: number
  total?: number
  payment_status?: string
  paid_amount?: number
  remaining?: number
  notes?: string | null
  delivery_address?: string | null
  courier_name?: string | null
  delivery_date?: string | null
  confirmed_at?: string | null
  items?: OrderDetailItem[]
  reservations?: OrderReservation[]
  status_history?: OrderStatusHistoryRow[]
  payments?: OrderPaymentRow[]
  created_at?: string
  updated_at?: string
}

type OrderActionResponse = {
  id?: number
  detail?: string
}

export interface OrderPaymentPayload {
  method: "CASH" | "CARD" | "BANK_TRANSFER" | string
  amount: number
  currency?: string
  note?: string
  paid_at?: string
}

export interface OrderReservationPayload {
  location: number
  item_id: number
  qty: string
  note?: string
}

export interface OrderReserveResponse {
  reservation_id: number
  location: number
  location_name: string
  order_qty: string
  reserved_open_total: string
  shipped_qty: string
  remaining_qty: string
}

export interface OrderUnreserveResponse {
  detail: string
}

export interface OrderReadyPayload {
  location: number
  note?: string
  detail?: OrderDetailResponse | null
}

export interface OrderReturnPayload {
  location: number
  item_id: number
  qty: string
  note?: string
}

export interface OrderShipLinePayload {
  item_id: number
  qty: string
}

export interface OrderShipPayload {
  location: number
  item_id?: number
  qty?: string
  shipments?: OrderShipLinePayload[]
  note?: string
}

export interface OrderSetStatusPayload {
  status: OrderStatus
  note?: string
  cancelled_reason?: string
}

export type OrderShipmentsListParams = {
  search?: string
  ordering?: string
  date?: string
  date_from?: string
  date_to?: string
  client?: number
  status?: string
  payment_status?: string
  payment_method?: string
  page?: number
}

export type OrderShipmentRow = Record<string, unknown> & {
  id?: number
  order_id?: number
  order_no?: string
  client_name?: string
  product_name?: string
  location_name?: string
  qty?: string
  created_at?: string
}

export type DownloadedFile = {
  blob: Blob
  fileName: string
}

function isEndpointMissing(error: any) {
  const status = Number(error?.response?.status || 0)
  return status === 404
}

function cleanObject<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as T
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function toDecimalString(value: unknown, digits = 6) {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num)) return (0).toFixed(digits)
  return num.toFixed(digits)
}

function normalizePaymentStatus(value: unknown) {
  const status = toText(value).toUpperCase()
  if (status === "PARTIALLY_PAID") return "PARTIAL"
  if (status === "PAID" || status === "PARTIAL" || status === "UNPAID") return status
  return status || "UNPAID"
}

function normalizeTaxRateValue(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return "0.00"
  const normalized = parsed > 1 ? parsed / 100 : parsed
  return Math.min(1, Math.max(0, normalized)).toFixed(2)
}

function normalizeOrderSummaryRow(row: any): OrderSummary {
  const total = toNumber(row?.total ?? row?.total_cost)
  return {
    id: Number(row?.id ?? 0),
    order_no: toText(row?.order_no),
    client_code: row?.client_code ? toText(row.client_code) : undefined,
    client_name: row?.client_name ? toText(row.client_name) : undefined,
    order_date: toText(row?.order_date),
    status: normalizeOrderStatus(row?.status),
    payment_status: normalizePaymentStatus(row?.payment_status),
    currency: toText(row?.currency, "UZS"),
    total,
    paid_amount: toNumber(row?.paid_amount),
    remaining: toNumber(row?.remaining, Math.max(total - toNumber(row?.paid_amount), 0)),
    delivery_date: row?.delivery_date ? toText(row.delivery_date) : null,
    created_at: row?.created_at ? toText(row.created_at) : undefined,
    updated_at: row?.updated_at ? toText(row.updated_at) : undefined,
  }
}

function normalizeOrderDetailClient(row: any): OrderDetailClient | null {
  if (!row || typeof row !== "object") return null
  return {
    id: Number(row?.id ?? 0),
    code: row?.code ? toText(row.code) : undefined,
    name: row?.name ? toText(row.name) : undefined,
    phone: row?.phone ? toText(row.phone) : null,
    inn: row?.inn ? toText(row.inn) : null,
  }
}

function normalizeOrderDetailItem(row: any): OrderDetailItem {
  return {
    id: Number(row?.id ?? 0),
    item_type: row?.item_type ? toText(row.item_type) : undefined,
    product: row?.product === null || row?.product === undefined ? null : Number(row.product),
    raw_material: row?.raw_material === null || row?.raw_material === undefined ? null : Number(row.raw_material),
    product_name: row?.product_name ? toText(row.product_name) : null,
    raw_material_name: row?.raw_material_name ? toText(row.raw_material_name) : null,
    qty: toText(row?.qty, "0.000000"),
    unit_price: toNumber(row?.unit_price),
    nds_rate: normalizeTaxRateValue(row?.nds_rate),
    nds_included: Boolean(row?.nds_included),
    line_subtotal: toNumber(row?.line_subtotal),
    nds_amount: toNumber(row?.nds_amount),
    line_total: toNumber(row?.line_total),
  }
}

function normalizeOrderReservation(row: any): OrderReservation {
  return {
    id: row?.id === undefined ? undefined : Number(row.id),
    reservation_id: row?.reservation_id === undefined ? undefined : Number(row.reservation_id),
    item_id: row?.item === undefined && row?.item_id === undefined ? undefined : Number(row?.item_id ?? row?.item),
    item_name: row?.item_name ? toText(row.item_name) : null,
    location: row?.location === undefined || row?.location === null ? null : Number(row.location),
    location_name: row?.location_name ? toText(row.location_name) : null,
    qty: row?.qty_reserved ? toText(row.qty_reserved) : row?.qty ? toText(row.qty) : undefined,
    qty_issued: row?.qty_issued ? toText(row.qty_issued) : undefined,
    status: row?.status ? toText(row.status) : undefined,
    note: row?.note ? toText(row.note) : null,
    created_at: row?.created_at ? toText(row.created_at) : undefined,
    updated_at: row?.updated_at ? toText(row.updated_at) : undefined,
  }
}

function normalizeOrderStatusHistoryRow(row: any): OrderStatusHistoryRow {
  const fromStatus = row?.from_status ? toText(row.from_status) : undefined
  const toStatus = row?.to_status ? toText(row.to_status) : undefined
  return {
    id: row?.id === undefined ? undefined : Number(row.id),
    from_status: fromStatus,
    to_status: toStatus,
    status: toStatus ?? (row?.status ? toText(row.status) : undefined),
    note: row?.note ? toText(row.note) : null,
    changed_at: row?.changed_at ? toText(row.changed_at) : null,
    created_at: row?.changed_at ? toText(row.changed_at) : row?.created_at ? toText(row.created_at) : undefined,
    created_by_name: row?.created_by_name ? toText(row.created_by_name) : null,
  }
}

function normalizeOrderPaymentRow(row: any): OrderPaymentRow {
  return {
    id: row?.id === undefined ? undefined : Number(row.id),
    method: row?.method ? toText(row.method) : undefined,
    amount: toNumber(row?.amount),
    currency: toText(row?.currency, "UZS"),
    note: row?.note ? toText(row.note) : null,
    paid_at: row?.paid_at ? toText(row.paid_at) : null,
    created_at: row?.created_at ? toText(row.created_at) : undefined,
  }
}

function normalizeOrderShipmentRow(row: any): OrderShipmentRow {
  return {
    ...(row && typeof row === "object" ? row : {}),
    id: row?.id === undefined ? undefined : Number(row.id),
    order_id: row?.order_id === undefined ? undefined : Number(row.order_id),
    order_no: row?.order_no ? toText(row.order_no) : undefined,
    client_name: row?.client_name ? toText(row.client_name) : row?.client ? toText(row.client) : undefined,
    product_name:
      row?.product_name ? toText(row.product_name) : row?.product ? toText(row.product) : row?.item_name ? toText(row.item_name) : undefined,
    location_name: row?.location_name ? toText(row.location_name) : undefined,
    qty: row?.qty ? toText(row.qty) : row?.shipped_qty ? toText(row.shipped_qty) : undefined,
    created_at:
      row?.created_at ? toText(row.created_at) : row?.shipped_at ? toText(row.shipped_at) : row?.date ? toText(row.date) : undefined,
  }
}

function normalizeOrderDetail(row: any): OrderDetailResponse {
  const summary = normalizeOrderSummaryRow(row)
  const notes =
    row?.notes !== undefined && row?.notes !== null && String(row.notes).trim()
      ? toText(row.notes)
      : row?.delivery_address
        ? toText(row.delivery_address)
        : null
  return {
    ...summary,
    client: normalizeOrderDetailClient(row?.client),
    cancelled_reason: row?.cancelled_reason ? toText(row.cancelled_reason) : null,
    subtotal: toNumber(row?.subtotal),
    nds_total: toNumber(row?.nds_total),
    discount_total: toNumber(row?.discount_total),
    total: toNumber(row?.total ?? row?.total_cost, summary.total),
    payment_status: normalizePaymentStatus(row?.payment_status),
    paid_amount: toNumber(row?.paid_amount),
    remaining: toNumber(row?.remaining, summary.remaining),
    notes,
    delivery_address: row?.delivery_address ? toText(row.delivery_address) : notes,
    courier_name: row?.courier_name ? toText(row.courier_name) : null,
    delivery_date: row?.delivery_date ? toText(row.delivery_date) : null,
    confirmed_at: row?.confirmed_at ? toText(row.confirmed_at) : null,
    items: Array.isArray(row?.items) ? row.items.map(normalizeOrderDetailItem) : [],
    reservations: Array.isArray(row?.reservations) ? row.reservations.map(normalizeOrderReservation) : [],
    status_history: Array.isArray(row?.status_history) ? row.status_history.map(normalizeOrderStatusHistoryRow) : [],
    payments: Array.isArray(row?.payments) ? row.payments.map(normalizeOrderPaymentRow) : [],
    created_at: row?.created_at ? toText(row.created_at) : undefined,
    updated_at: row?.updated_at ? toText(row.updated_at) : undefined,
  }
}

function orderBaseUrls() {
  return ["/api/v1/orders/", "/api/v1/orders"]
}

function orderDetailUrls(orderId: number) {
  return [`/api/v1/orders/${orderId}/`, `/api/v1/orders/${orderId}`]
}

function orderPartialUpdateUrls(orderId: number) {
  return orderDetailUrls(orderId)
}

function orderActionUrls(orderId: number, action: string) {
  return [`/api/v1/orders/${orderId}/${action}/`, `/api/v1/orders/${orderId}/${action}`]
}

function orderShipmentUrls() {
  return []
}

function orderShipmentExportUrls() {
  return []
}

async function getFirst<T>(urls: string[], params?: Record<string, unknown>): Promise<T> {
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      const { data } = await api.get<T>(url, params ? { params } : undefined)
      return data
    } catch (error: any) {
      if (!isEndpointMissing(error)) throw error
      lastErr = error
    }
  }
  if (lastErr) throw lastErr
  throw new Error("Endpoint topilmadi")
}

function parseContentDispositionFileName(value: unknown) {
  const raw = toText(value)
  if (!raw) return ""

  const utf8Match = raw.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const simpleMatch = raw.match(/filename=\"?([^\";]+)\"?/i)
  return simpleMatch?.[1] ? simpleMatch[1].trim() : ""
}

async function getBlobFirst(urls: string[], params?: Record<string, unknown>): Promise<DownloadedFile> {
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      const response = await api.get(url, {
        params,
        responseType: "blob",
      })
      return {
        blob: response.data as Blob,
        fileName: parseContentDispositionFileName(response.headers?.["content-disposition"]) || "shipments.xlsx",
      }
    } catch (error: any) {
      if (!isEndpointMissing(error)) throw error
      lastErr = error
    }
  }
  if (lastErr) throw lastErr
  throw new Error("Endpoint topilmadi")
}

async function postFirst<T>(urls: string[], payload: Record<string, unknown>): Promise<T> {
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      const { data } = await api.post<T>(url, payload)
      return data
    } catch (error: any) {
      if (!isEndpointMissing(error)) throw error
      lastErr = error
    }
  }
  if (lastErr) throw lastErr
  throw new Error("Endpoint topilmadi")
}

async function patchFirst<T>(urls: string[], payload: Record<string, unknown>): Promise<T> {
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      const { data } = await api.patch<T>(url, payload)
      return data
    } catch (error: any) {
      const status = Number(error?.response?.status || 0)
      if (status !== 404 && status !== 405) throw error
      try {
        const { data } = await api.put<T>(url, payload)
        return data
      } catch (fallbackError: any) {
        const fallbackStatus = Number(fallbackError?.response?.status || 0)
        if (fallbackStatus !== 404 && fallbackStatus !== 405) throw fallbackError
        lastErr = fallbackError
      }
    }
  }
  if (lastErr) throw lastErr
  throw new Error("Endpoint topilmadi")
}

async function patchOnlyFirst<T>(urls: string[], payload: Record<string, unknown>): Promise<T> {
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      const { data } = await api.patch<T>(url, payload)
      return data
    } catch (error: any) {
      if (!isEndpointMissing(error)) throw error
      lastErr = error
    }
  }
  if (lastErr) throw lastErr
  throw new Error("Endpoint topilmadi")
}

async function deleteFirst(urls: string[]) {
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      await api.delete(url)
      return
    } catch (error: any) {
      if (!isEndpointMissing(error)) throw error
      lastErr = error
    }
  }
  if (lastErr) throw lastErr
}

async function deleteFirstWithBody<T>(urls: string[]): Promise<T> {
  let lastErr: unknown = null
  for (const url of urls) {
    try {
      const { data } = await api.delete<T>(url)
      return data
    } catch (error: any) {
      if (!isEndpointMissing(error)) throw error
      lastErr = error
    }
  }
  if (lastErr) throw lastErr
  throw new Error("Endpoint topilmadi")
}

function normalizeOrderItemPayload(payload: OrderItemCreate) {
  const inferredItemType =
    payload.item_type ??
    (payload.raw_material !== undefined && payload.raw_material !== null
      ? "RAW_MATERIAL"
      : payload.product !== undefined && payload.product !== null
        ? "FINISHED_PRODUCT"
        : undefined)

  return cleanObject({
    item_type: inferredItemType,
    product: payload.product,
    raw_material: payload.raw_material,
    qty: toDecimalString(payload.qty),
    unit_price: Number(payload.unit_price || 0),
    nds_rate: normalizeTaxRateValue(payload.nds_rate),
  })
}

function isUnknownFieldError(value: unknown) {
  const s = String(value || "").toLowerCase()
  return (
    s.includes("unknown field") ||
    s.includes("not allowed") ||
    s.includes("cannot be sent") ||
    s.includes("unexpected field")
  )
}

function isRequiredFieldError(value: unknown) {
  const s = String(value || "").toLowerCase()
  return s.includes("required") || s.includes("this field is required")
}

function remapOrderCreateBodyForSerializer(body: Record<string, any>, errors: Record<string, unknown>) {
  const next: Record<string, any> = {
    ...body,
    items: Array.isArray(body.items) ? body.items.map((item: any) => ({ ...item })) : body.items,
  }

  const setIf = (to: string, from: string) => {
    if (next[from] !== undefined && next[to] === undefined) next[to] = next[from]
  }

  if (isUnknownFieldError(errors?.currency)) delete next.currency
  if (next.delivery_date === null || next.delivery_date === "") delete next.delivery_date
  if (isUnknownFieldError(errors?.client)) setIf("client_id", "client")
  if (isRequiredFieldError(errors?.client_id)) setIf("client_id", "client")
  if (isUnknownFieldError(errors?.notes)) setIf("delivery_address", "notes")

  const itemErrors = Array.isArray(errors?.items)
    ? (errors.items as Array<Record<string, unknown>>)
    : errors?.items && typeof errors.items === "object"
      ? [errors.items as Record<string, unknown>]
      : []

  const requiresItemType = itemErrors.some((itemError) => isRequiredFieldError(itemError?.item_type))
  const rejectsItemType = itemErrors.some((itemError) => isUnknownFieldError(itemError?.item_type))
  const needsFinishedProduct = itemErrors.some(
    (itemError) =>
      isRequiredFieldError(itemError?.finished_product) || isRequiredFieldError(itemError?.finished_product_id)
  )

  if (Array.isArray(next.items) && requiresItemType) {
    next.items = next.items.map((item: Record<string, any>) => ({
      ...item,
      item_type:
        item.item_type ??
        (item.raw_material !== undefined && item.raw_material !== null ? "RAW_MATERIAL" : "FINISHED_PRODUCT"),
    }))
  }

  if (Array.isArray(next.items) && rejectsItemType) {
    next.items = next.items.map((item: Record<string, any>) => {
      const cloned = { ...item }
      delete cloned.item_type
      return cloned
    })
  }

  if (Array.isArray(next.items) && itemErrors.some((itemError) => isUnknownFieldError(itemError?.nds_included))) {
    next.items = next.items.map((item: Record<string, any>) => {
      const cloned = { ...item }
      delete cloned.nds_included
      return cloned
    })
  }

  if (Array.isArray(next.items) && needsFinishedProduct) {
    next.items = next.items.map((item: Record<string, any>) => ({
      ...item,
      finished_product: item.finished_product ?? item.product,
    }))
  }

  return next
}

async function postOrderCreate(urls: string[], payload: Record<string, any>) {
  let lastErr: unknown = null

  for (const url of urls) {
    try {
      const { data } = await api.post<OrderDetailResponse>(url, payload)
      return data
    } catch (error: any) {
      const status = Number(error?.response?.status || 0)
      const responseData = error?.response?.data
      if (status === 400 && responseData && typeof responseData === "object" && !Array.isArray(responseData)) {
        const fallbackBody = remapOrderCreateBodyForSerializer(payload, responseData as Record<string, unknown>)
        if (JSON.stringify(fallbackBody) !== JSON.stringify(payload)) {
          const { data } = await api.post<OrderDetailResponse>(url, fallbackBody)
          return data
        }
      }
      if (!isEndpointMissing(error)) throw error
      lastErr = error
    }
  }

  if (lastErr) throw lastErr
  throw new Error("Endpoint topilmadi")
}

// Orders listini filter/pagination bilan oladi.
export async function fetchOrders(params?: OrdersListParams): Promise<OrdersListResponse<OrderSummary>> {
  const query = cleanObject({
    search: params?.search,
    ordering: params?.ordering,
    page: params?.page,
    status: params?.status,
    payment_status: params?.payment_status,
    client: params?.client,
    date_from: params?.date_from,
    date_to: params?.date_to,
    shipment_state: params?.shipment_state,
  })
  const data = await getFirst<any>(orderBaseUrls(), query)
  if (Array.isArray(data)) {
    const results = data.map(normalizeOrderSummaryRow)
    return { count: results.length, results }
  }
  const results = Array.isArray(data?.results) ? data.results.map(normalizeOrderSummaryRow) : []
  return {
    count: Number(data?.count ?? results.length),
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    results,
  }
}

export async function fetchAllOrders(params?: Omit<OrdersListParams, "page" | "page_size">): Promise<OrderSummary[]> {
  const rows: OrderSummary[] = []
  let page = 1
  let totalCount = Number.POSITIVE_INFINITY

  while (page <= 100 && rows.length < totalCount) {
    const response = await fetchOrders({
      ...params,
      page,
    })

    totalCount = Math.max(toNumber(response.count, rows.length), rows.length)
    rows.push(...response.results)

    if (!response.results.length) break
    if (!response.next && rows.length >= totalCount) break

    page += 1
  }

  return rows
}

export async function fetchAllOrderShipments(
  params: Omit<OrderShipmentsListParams, "page"> = {}
): Promise<OrderShipmentRow[]> {
  const rows: OrderShipmentRow[] = []
  let page = 1
  let totalCount = Number.POSITIVE_INFINITY

  try {
    while (orderShipmentUrls().length > 0 && page <= 100 && rows.length < totalCount) {
      const data = await getFirst<any>(
        orderShipmentUrls(),
        cleanObject({
          search: params.search?.trim() || undefined,
          ordering: params.ordering,
          date: params.date,
          date_from: params.date ? undefined : params.date_from,
          date_to: params.date ? undefined : params.date_to,
          client: params.client,
          status: params.status,
          payment_status: params.payment_status,
          payment_method: params.payment_method,
          page,
        })
      )

      const pageRows = unwrapResults<any>(data).map((row) => normalizeOrderShipmentRow(row))
      rows.push(...pageRows)

      if (Array.isArray(data)) break

      totalCount = Math.max(toNumber(data?.count, rows.length), rows.length)
      if (!pageRows.length) break
      if (!data?.next && rows.length >= totalCount) break
      page += 1
    }

    return rows
  } catch (error: any) {
    if (!isEndpointMissing(error)) throw error
  }

  const fallbackRows = await fetchAllOrders({
    search: params.search,
    ordering: params.ordering,
    status: params.status || "DELIVERED",
    payment_status: params.payment_status,
    client: params.client,
    date_from: params.date || params.date_from,
    date_to: params.date || params.date_to,
  })

  return fallbackRows.map((row) => ({
    id: row.id,
    order_id: row.id,
    order_no: row.order_no,
    client_name: row.client_name,
    total_sell: row.total,
    order_status: row.status,
    payment_status: row.payment_status,
    created_at: row.created_at ?? row.order_date,
  }))
}

function csvCell(value: unknown) {
  const text = String(value ?? "")
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function buildCsvBlob(rows: OrderShipmentRow[]) {
  const columns = ["order_no", "client_name", "total_sell", "order_status", "payment_status", "created_at"]
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ]
  return new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
}

export async function exportOrderShipmentsReport(
  params: Omit<OrderShipmentsListParams, "page"> = {}
): Promise<DownloadedFile> {
  try {
    const urls = orderShipmentExportUrls()
    if (urls.length > 0) {
      return await getBlobFirst(
        urls,
        cleanObject({
          search: params.search?.trim() || undefined,
          ordering: params.ordering,
          date: params.date,
          date_from: params.date ? undefined : params.date_from,
          date_to: params.date ? undefined : params.date_to,
          client: params.client,
          status: params.status,
          payment_status: params.payment_status,
          payment_method: params.payment_method,
        })
      )
    }
  } catch (error: any) {
    if (!isEndpointMissing(error)) throw error
  }

  const rows = await fetchAllOrderShipments(params)
  return {
    blob: buildCsvBlob(rows),
    fileName: "shipments.csv",
  }
}

// Bitta order detailini to'liq qaytaradi.
export async function fetchOrderDetail(orderId: number): Promise<OrderDetailResponse> {
  const data = await getFirst<OrderDetailResponse>(orderDetailUrls(orderId))
  return normalizeOrderDetail(data)
}

// Yangi order yaratadi (guide bo'yicha aniq serializer maydonlari bilan).
export async function createOrder(payload: OrderCreatePayload): Promise<OrderDetailResponse> {
  const normalized = cleanObject({
    client: payload.client,
    order_date: payload.order_date,
    discount_total: Number(payload.discount_total ?? 0),
    notes: payload.notes ?? payload.delivery_address ?? undefined,
    courier_name: payload.courier_name ?? undefined,
    delivery_date: payload.delivery_date ?? undefined,
    items: (payload.items || []).map(normalizeOrderItemPayload),
  })
  const data = await postOrderCreate(orderBaseUrls(), normalized)
  const result = normalizeOrderDetail(data)
  salesEvents.emit()
  return result
}

// Order headerini orders_partial_update orqali yangilaydi (PATCH /orders/{id}/).
export async function patchOrderHeader(
  orderId: number,
  payload: {
    client?: number
    order_date?: string | null
    discount_total?: number
    notes?: string | null
    delivery_address?: string | null
    courier_name?: string | null
    delivery_date?: string | null
  }
): Promise<OrderDetailResponse> {
  const data = await patchFirst<OrderDetailResponse>(
    orderPartialUpdateUrls(orderId),
    cleanObject({
      client: payload.client,
      order_date: payload.order_date,
      discount_total: payload.discount_total === undefined ? undefined : Number(payload.discount_total || 0),
      notes: payload.notes ?? payload.delivery_address,
      courier_name: payload.courier_name,
      delivery_date: payload.delivery_date ?? undefined,
    })
  )
  const result = normalizeOrderDetail(data)
  salesEvents.emit()
  return result
}

export async function deleteOrder(orderId: number) {
  await deleteFirst(orderDetailUrls(orderId))
  salesEvents.emit()
}

// Orderga item qo'shadi.
export async function addOrderItem(orderId: number, payload: OrderItemCreate): Promise<OrderDetailResponse> {
  const data = await postFirst<OrderDetailResponse>(
    [
      `/api/v1/orders/${orderId}/items/add/`,
    ],
    normalizeOrderItemPayload(payload)
  )
  const result = normalizeOrderDetail(data)
  salesEvents.emit()
  return result
}

// Order itemini yangilaydi.
export async function updateOrderItem(
  orderId: number,
  itemId: number,
  payload: Partial<OrderItemCreate>
): Promise<OrderDetailResponse> {
  const normalized = cleanObject({
    qty: payload.qty === undefined ? undefined : toDecimalString(payload.qty),
    unit_price: payload.unit_price === undefined ? undefined : Number(payload.unit_price || 0),
    nds_rate: payload.nds_rate === undefined ? undefined : normalizeTaxRateValue(payload.nds_rate),
  })

  return patchOnlyFirst<OrderDetailResponse>(
    [
      `/api/v1/orders/${orderId}/items/${itemId}/update/`,
    ],
    normalized
  ).then((data) => {
    const result = normalizeOrderDetail(data)
    salesEvents.emit()
    return result
  })
}

// Order itemini o'chiradi.
export async function removeOrderItem(orderId: number, itemId: number) {
  await deleteFirstWithBody<OrderDetailResponse>([
    `/api/v1/orders/${orderId}/items/${itemId}/remove/`,
  ])
  salesEvents.emit()
}

// Orderni tasdiqlaydi: NEW -> IN_PROGRESS
export async function confirmOrder(orderId: number): Promise<OrderDetailResponse> {
  await postFirst<OrderActionResponse>(orderActionUrls(orderId, "confirm"), {})
  const result = await fetchOrderDetail(orderId)
  salesEvents.emit()
  return result
}

// Orderni bekor qiladi.
export async function cancelOrder(orderId: number, reason: string): Promise<OrderDetailResponse> {
  try {
    await postFirst<OrderActionResponse>(orderActionUrls(orderId, "cancel"), { reason })
  } catch (error: any) {
    if (Number(error?.response?.status || 0) !== 400) throw error
    await postFirst<OrderActionResponse>(orderActionUrls(orderId, "cancel"), { note: reason })
  }
  const result = await fetchOrderDetail(orderId)
  salesEvents.emit()
  return result
}

function buildReadyReservationLines(detail: OrderDetailResponse) {
  const openReservedByItem = new Map<number, number>()

  for (const reservation of detail.reservations ?? []) {
    const itemId = Number(reservation?.item_id ?? 0)
    if (itemId <= 0) continue
    const reservationStatus = toText(reservation?.status).toUpperCase()
    if (reservationStatus === "CANCELLED") continue

    const reservedQty = Number(reservation?.qty ?? 0)
    const issuedQty = Number(reservation?.qty_issued ?? 0)
    const openQty = Math.max(reservedQty - issuedQty, 0)
    if (openQty <= 0) continue

    openReservedByItem.set(itemId, (openReservedByItem.get(itemId) || 0) + openQty)
  }

  return (detail.items ?? [])
    .map((item) => {
      const itemId = Number(item?.id ?? 0)
      const orderedQty = Number(item?.qty ?? 0)
      const alreadyReserved = openReservedByItem.get(itemId) || 0
      const qtyToReserve = Math.max(orderedQty - alreadyReserved, 0)

      return {
        item_id: itemId,
        qty: qtyToReserve,
      }
    })
    .filter((line) => line.item_id > 0 && line.qty > 0)
}

export async function reserveOrderToReady(orderId: number, payload: OrderReadyPayload): Promise<OrderDetailResponse> {
  const location = Number(payload.location || 0)
  if (!Number.isFinite(location) || location <= 0) {
    throw new Error("READY holati uchun location majburiy.")
  }

  const detail =
    payload.detail && Number(payload.detail.id || 0) === orderId ? payload.detail : await fetchOrderDetail(orderId)
  const reserveLines = buildReadyReservationLines(detail)

  for (const line of reserveLines) {
    await postFirst<OrderReserveResponse>(
      orderActionUrls(orderId, "reserve"),
      cleanObject({
        location,
        item_id: line.item_id,
        qty: toDecimalString(line.qty),
        note: payload.note?.trim() || undefined,
      })
    )
  }

  const result = await fetchOrderDetail(orderId)
  salesEvents.emit()
  return result
}

// Admin statusni qo'lda o'zgartiradi.
export async function setOrderStatus(
  orderId: number,
  status: OrderStatus,
  note?: string,
  cancelled_reason?: string
): Promise<OrderDetailResponse> {
  const nextStatus = toText(status, "NEW").toUpperCase() as OrderStatus
  const cancelReason =
    nextStatus === "CANCELLED" ? toText(cancelled_reason ?? note).trim() : ""

  if (nextStatus === "IN_PROGRESS") {
    return confirmOrder(orderId)
  }

  if (nextStatus === "DELIVERED") {
    return deliverOrder(orderId)
  }

  if (nextStatus === "NEW") {
    throw new Error("NEW holati buyurtma yaratilganda backend tomonidan beriladi.")
  }

  if (nextStatus === "CANCELLED") {
    return cancelOrder(orderId, cancelReason)
  }

  throw new Error("Bu holat uchun documented action topilmadi.")
}

export async function addOrderPayment(orderId: number, payload: OrderPaymentPayload) {
  const result = await postFirst<any>(
    ["/api/v1/finance/payments/order/"],
    cleanObject({
      order_id: orderId,
      method: payload.method,
      amount: Number(payload.amount || 0),
      note: payload.note ?? "",
      occurred_on: payload.paid_at,
    })
  )
  salesEvents.emit()
  return result
}

export async function printOrderReceipt(orderId: number, copies = 1) {
  void orderId
  void copies
  throw new Error("Chek chop etish endpointi backendda mavjud emas.")
}

export async function reserveOrderItem(orderId: number, payload: OrderReservationPayload): Promise<OrderReserveResponse> {
  const result = await postFirst<OrderReserveResponse>(
    orderActionUrls(orderId, "reserve"),
    cleanObject({
      location: payload.location,
      item_id: payload.item_id,
      qty: toDecimalString(payload.qty),
      note: payload.note ?? "",
    })
  )
  salesEvents.emit()
  return result
}

export async function unreserveOrder(orderId: number, reservationId: number): Promise<OrderUnreserveResponse> {
  const result = await postFirst<OrderUnreserveResponse>(orderActionUrls(orderId, "unreserve"), {
    reservation_id: reservationId,
  })
  salesEvents.emit()
  return result
}

export async function shipOrder(orderId: number, payload: OrderShipPayload) {
  const shipmentsFromList = Array.isArray(payload.shipments) ? payload.shipments : []
  const shipments = [
    ...(payload.item_id && Number(payload.qty) > 0
      ? [
          {
            item_id: Number(payload.item_id || 0),
            qty: toDecimalString(payload.qty),
          },
        ]
      : []),
    ...shipmentsFromList
      .map((line) => ({
        item_id: Number(line.item_id || 0),
        qty: toDecimalString(line.qty),
      }))
      .filter((line) => line.item_id > 0 && Number(line.qty) > 0),
  ]

  try {
    await postFirst<any>(orderActionUrls(orderId, "ship"), {})
  } catch (error: any) {
    if (Number(error?.response?.status || 0) !== 400) throw error
    if (shipments.length === 0) {
      throw new Error("Jo'natish uchun kamida bitta item kerak.")
    }
    await postFirst<any>(
      orderActionUrls(orderId, "ship"),
      cleanObject({
        location: payload.location,
        shipments,
        note: payload.note?.trim() || undefined,
      })
    )
  }
  const result = await fetchOrderDetail(orderId)
  salesEvents.emit()
  return result
}

export async function deliverOrder(orderId: number) {
  return postFirst<any>(orderActionUrls(orderId, "deliver"), {}).then(async () => {
    const result = await fetchOrderDetail(orderId)
    salesEvents.emit()
    return result
  })
}

export async function returnOrderItem(orderId: number, payload: OrderReturnPayload) {
  await postFirst<any>(
    orderActionUrls(orderId, "return"),
    cleanObject({
      location: payload.location,
      item_id: payload.item_id,
      qty: toDecimalString(payload.qty),
      note: payload.note?.trim() || undefined,
    })
  )
  const result = await fetchOrderDetail(orderId)
  salesEvents.emit()
  return result
}

export async function recalcOrder(orderId: number) {
  return fetchOrderDetail(orderId)
}

function sortKontragentsByName(rows: Kontragent[]) {
  return [...rows].sort((a, b) => {
    const nameCompare = a.name.localeCompare(b.name, "uz", { sensitivity: "base" })
    if (nameCompare !== 0) return nameCompare
    return a.id - b.id
  })
}

function filterKontragentsBySearch(rows: Kontragent[], search?: string) {
  const q = toText(search).trim().toLowerCase()
  if (!q) return rows

  return rows.filter((row) => {
    return [row.name, row.code, row.phone ?? "", row.inn ?? ""]
      .map((value) => toText(value).toLowerCase())
      .some((value) => value.includes(q))
  })
}

export async function fetchKontragents(params?: {
  search?: string
  page_size?: number
  limit?: number
}): Promise<Kontragent[]> {
  const search = toText(params?.search).trim()
  const requestedPageSize = Math.min(500, Math.max(20, Number(params?.page_size ?? (search ? 100 : 500))))
  const limit = Math.min(5000, Math.max(20, Number(params?.limit ?? requestedPageSize)))
  const found = new Map<number, Kontragent>()
  let page = 1
  let hasNext = true

  while (hasNext && found.size < limit) {
    const beforeCount = found.size
    const { data } = await api.get("/api/v1/partners/kontragents/", {
      params: cleanObject({
        kind: "CLIENT",
        page,
        ordering: "name",
        search: search || undefined,
      }),
    })

    const batch = unwrapResults<any>(data)
      .map(normalizeKontragent)
      .filter((row) => row.id > 0 && row.name && isClientLikeKontragent(row.kind))

    batch.forEach((row) => {
      if (!found.has(row.id)) found.set(row.id, row)
    })
    const addedCount = found.size - beforeCount

    if (Array.isArray(data)) {
      hasNext = false
      continue
    }

    const next = typeof data?.next === "string" ? data.next : ""
    const count = Number(data?.count ?? 0)
    if (next) {
      page += 1
      continue
    }
    if (Number.isFinite(count) && count > found.size && batch.length > 0 && addedCount > 0) {
      page += 1
      continue
    }
    hasNext = false
  }

  let rows = filterKontragentsBySearch(Array.from(found.values()), search)
  return sortKontragentsByName(rows).slice(0, limit)
}

// Sizda kontragent create endpoint bo‘lishi kerak.
// Agar URL boshqa bo‘lsa shu yerini almashtirasiz.
export async function createKontragent(payload: {
  kind?: string
  name: string
  phone?: string
  email?: string
  inn?: string
}): Promise<Kontragent> {
  const { data } = await api.post("/api/v1/partners/kontragents/", {
    kind: payload.kind ?? "CLIENT",
    ...payload,
  })
  return data
}

export async function fetchProducts(): Promise<Product[]> {
  const { data } = await api.get("/api/v1/catalog/products/")

  if (Array.isArray(data)) return data.map(normalizeProduct)
  if (Array.isArray(data?.results)) return data.results.map(normalizeProduct)
  return []
}



// Branch / Warehouse endpointlar sizda qandayligini bilmayman,
// shuning uchun "placeholder" qoldirdim. Moslab qo‘yasiz.
export async function fetchBranches(): Promise<Branch[]> {
  return (await fetchDictWarehouseLocationRows())
    .map((row) => ({
      id: row.id,
      name: row.name,
    }))
    .filter((row: Branch) => row.id > 0)
}

export async function fetchWarehouses(_branchId?: number): Promise<Warehouse[]> {
  const rows = await fetchDictWarehouseLocationRows()
  const byWarehouse = new Map<number, Warehouse>()

  for (const row of rows) {
    const warehouseId = row.warehouse_id ?? row.id
    if (!warehouseId) continue

    if (!byWarehouse.has(warehouseId)) {
      byWarehouse.set(warehouseId, {
        id: warehouseId,
        name: row.warehouse_name ?? row.name,
      })
    }
  }

  return Array.from(byWarehouse.values())
}

export async function fetchWarehouseLocations(_branchId?: number): Promise<WarehouseLocation[]> {
  return fetchDictWarehouseLocationRows()
}

export async function resolveWarehouseIdByLocation(locationId: number): Promise<number | null> {
  const id = toPositiveInt(locationId)
  if (!id) return null

  try {
    const { data } = await api.get(`/api/v1/dicts/locations/${id}/`)
    const row = normalizeWarehouseLocationLookup(data)
    return row.warehouse_id ?? null
  } catch (error: any) {
    const status = Number(error?.response?.status || 0)
    if (status !== 404) throw error
  }

  return null
}

// ⚠️ STOCK endpointni siz aytmadingiz.
// Sizda qaysi endpoint bo‘lsa shu yerini 1 joyda moslab qo‘ying.
export async function getProductStock(params: {
  warehouse_id: number
  product_id: number
}): Promise<StockResponse> {
  const { data } = await api.get<WarehouseStockRow[]>("/api/v1/warehouse/stock/", {
    params: {
      item_type: "FINISHED_PRODUCT",
      product_id: params.product_id,
    },
  })
  const rows = unwrapResults<WarehouseStockRow>(data).filter(
    (row) => (row.item_type === "PRODUCT" || row.item_type === "FINISHED_PRODUCT") && row.product_id === params.product_id
  )
  return {
    qty: rows.reduce((sum, row) => sum + Number(row.qty_onhand || 0), 0),
  }
}
