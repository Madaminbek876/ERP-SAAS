import { api } from "@/lib/api"
import { apiAxios } from "@/Api/api.axios"
import { unwrapResults } from "@/lib/unwrap"
import { downloadPurchaseDocumentTemplate } from "@/pages/sklad/warehouse/utils/exportFile"
import type {
  PageResponse,
  PurchaseDetail,
  PurchaseListItem,
  PurchasesMeta,
} from "@/pages/purchases/types"
import type { LookupItem } from "@/pages/sklad/warehouse/api/types"
import { warehouseEvents } from "@/pages/sklad/warehouse/api/events"

const PURCHASES_BASE = "/api/v1/purchases"
const FALLBACK_PURCHASES_META: PurchasesMeta = {
  currency_choices: ["UZS"],
  payment_method_choices: ["CASH", "BANK_TRANSFER", "CARD"],
  purchase_status_choices: ["DRAFT", "CONFIRMED", "CANCELLED"],
}

export type PurchasesListParams = {
  page?: number
  page_size?: number
  supplier?: number
  status?: string
  payment_status?: string
  date_from?: string
  date_to?: string
  search?: string
  ordering?: string
}

export type CreatePurchasePayload = {
  supplier: number
  received_date?: string | null
  produced_date?: string | null
  delivery_company?: string | null
  location: number
  notes?: string | null
  currency?: "UZS" | "USD"
  items?: Array<{
    raw_material?: number
    qty: string
    unit_price: number
  }>
}

export type PatchPurchasePayload = Partial<
  Pick<CreatePurchasePayload, "supplier" | "received_date" | "produced_date" | "delivery_company" | "location" | "notes" | "currency">
>

export type PurchaseItemPayload = {
  raw_material: number
  qty: string
  unit_price: number
}

export type PurchaseMaterialOption = LookupItem & {
  material_type: number | null
  material_type_name?: string | null
}

async function postPurchaseActionWithFallback(primaryUrl: string, fallbackUrl: string) {
  try {
    const { data } = await api.post(primaryUrl, {})
    return data
  } catch (error: any) {
    if (Number(error?.response?.status || 0) !== 404) throw error
    const { data } = await api.post(fallbackUrl, {})
    return data
  }
}

function isUnknownFieldError(value: unknown) {
  const s = String(value || "").toLowerCase()
  return (
    s.includes("unknown field") ||
    s.includes("not allowed") ||
    s.includes("cannot be sent") ||
    s.includes("unexpected field") ||
    s.includes("bu fieldni yuborish mumkin emas")
  )
}

function isRequiredFieldError(value: unknown) {
  const s = String(value || "").toLowerCase()
  return (
    s.includes("required") ||
    s.includes("majburiy") ||
    s.includes("this field is required") ||
    s.includes("обязател")
  )
}

function isInvalidChoiceError(value: unknown) {
  const s = String(value || "").toLowerCase()
  return s.includes("valid choice") || s.includes("invalid choice") || s.includes("not one of the available choices")
}

function cleanParams<T extends Record<string, unknown>>(params: T): Partial<T> {
  const out: Record<string, unknown> = {}
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    if (typeof v === "string" && v.trim() === "") return
    out[k] = v
  })
  return out as Partial<T>
}

function toFiniteNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function toQtyString(value: unknown): string | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n.toFixed(6)
}

function asList(data: any): any[] {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.rows)) return data.rows
  if (Array.isArray(data?.data)) return data.data
  if (data && typeof data === "object") return [data]
  return []
}

function flattenErrorMessages(value: unknown, prefix = ""): string[] {
  if (value === null || value === undefined) return []
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [prefix ? `${prefix}: ${String(value)}` : String(value)]
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenErrorMessages(item, prefix)).filter(Boolean)
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
      flattenErrorMessages(nested, prefix ? `${prefix}.${key}` : key)
    )
  }
  return []
}

function normalizeChoiceArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function normalizePurchasesMeta(data: unknown): PurchasesMeta | null {
  if (!data || typeof data !== "object") return null

  const direct = data as Record<string, unknown>
  const nested =
    Array.isArray(direct.results) && direct.results.length === 1 && direct.results[0] && typeof direct.results[0] === "object"
      ? (direct.results[0] as Record<string, unknown>)
      : direct

  const normalized: PurchasesMeta = {
    currency_choices: normalizeChoiceArray(nested.currency_choices),
    payment_method_choices: normalizeChoiceArray(nested.payment_method_choices),
    purchase_status_choices: normalizeChoiceArray(nested.purchase_status_choices),
  }

  if (
    normalized.currency_choices.length ||
    normalized.payment_method_choices.length ||
    normalized.purchase_status_choices.length
  ) {
    return normalized
  }

  return null
}

export function getPurchaseApiErrorMessage(error: any, fallback = "So'rov bajarilmadi") {
  const detail = error?.response?.data?.detail
  if (detail !== undefined && detail !== null && String(detail).trim()) return String(detail)

  const messages = flattenErrorMessages(error?.response?.data).filter((msg) => {
    const lower = msg.toLowerCase()
    return lower !== "detail" && lower !== "non_field_errors"
  })
  if (messages.length) return messages.join(" | ")

  return String(error?.message || fallback)
}

function cloneItemsWithAliases(items: any[], addAlias: (item: Record<string, any>) => void) {
  return items.map((item) => {
    const next = { ...item }
    addAlias(next)
    return next
  })
}

function remapPurchaseCreateBodyForSerializer(body: Record<string, any>, errors: Record<string, unknown>) {
  const next: Record<string, any> = {
    ...body,
    items: Array.isArray(body.items) ? body.items.map((item: any) => ({ ...item })) : body.items,
  }

  const setIf = (to: string, from: string) => {
    if (next[from] !== undefined && next[to] === undefined) next[to] = next[from]
  }

  if (isUnknownFieldError(errors?.supplier)) setIf("supplier_id", "supplier")
  if (isRequiredFieldError(errors?.supplier_id)) setIf("supplier_id", "supplier")
  if (isRequiredFieldError(errors?.partner)) setIf("partner", "supplier")
  if (isRequiredFieldError(errors?.kontragent)) setIf("kontragent", "supplier")

  if (isUnknownFieldError(errors?.location)) {
    setIf("location_id", "location")
    setIf("warehouse_location", "location")
  }
  if (isRequiredFieldError(errors?.location_id)) setIf("location_id", "location")
  if (isRequiredFieldError(errors?.warehouse_location)) setIf("warehouse_location", "location")

  if (isUnknownFieldError(errors?.currency)) delete next.currency
  if (isInvalidChoiceError(errors?.currency) && next.currency && next.currency !== "UZS") {
    next.currency = "UZS"
  }

  const rawItemErrors = Array.isArray(errors?.items)
    ? (errors.items as Array<Record<string, unknown>>)
    : errors?.items && typeof errors.items === "object"
      ? [errors.items as Record<string, unknown>]
      : []

  const needsRawMaterialId = rawItemErrors.some(
    (itemError) =>
      isUnknownFieldError(itemError?.raw_material) || isRequiredFieldError(itemError?.raw_material_id)
  )
  const needsRawMaterial = rawItemErrors.some(
    (itemError) =>
      isUnknownFieldError(itemError?.raw_material_id) || isRequiredFieldError(itemError?.raw_material)
  )

  if (Array.isArray(next.items) && needsRawMaterialId) {
    next.items = cloneItemsWithAliases(next.items, (item) => {
      if (item.raw_material !== undefined && item.raw_material_id === undefined) {
        item.raw_material_id = item.raw_material
      }
      if (isUnknownFieldError(rawItemErrors[0]?.raw_material) && item.raw_material_id !== undefined) {
        delete item.raw_material
      }
    })
  }
  if (Array.isArray(next.items) && needsRawMaterial) {
    next.items = cloneItemsWithAliases(next.items, (item) => {
      if (item.raw_material_id !== undefined && item.raw_material === undefined) {
        item.raw_material = item.raw_material_id
      }
      if (isUnknownFieldError(rawItemErrors[0]?.raw_material_id) && item.raw_material !== undefined) {
        delete item.raw_material_id
      }
    })
  }

  return next
}

function remapPurchaseItemBodyForSerializer(body: Record<string, any>, errors: Record<string, unknown>) {
  const next: Record<string, any> = { ...body }

  const needsRawMaterialId =
    isUnknownFieldError(errors?.raw_material) || isRequiredFieldError(errors?.raw_material_id)
  const needsRawMaterial =
    isUnknownFieldError(errors?.raw_material_id) || isRequiredFieldError(errors?.raw_material)

  if (needsRawMaterialId && next.raw_material !== undefined && next.raw_material_id === undefined) {
    next.raw_material_id = next.raw_material
  }
  if (needsRawMaterialId && isUnknownFieldError(errors?.raw_material) && next.raw_material_id !== undefined) {
    delete next.raw_material
  }

  if (needsRawMaterial && next.raw_material_id !== undefined && next.raw_material === undefined) {
    next.raw_material = next.raw_material_id
  }
  if (needsRawMaterial && isUnknownFieldError(errors?.raw_material_id) && next.raw_material !== undefined) {
    delete next.raw_material_id
  }

  return next
}

async function postPurchaseWithBodyFallback(url: string, body: Record<string, any>) {
  try {
    const { data } = await api.post(url, body)
    return data
  } catch (error: any) {
    const status = Number(error?.response?.status || 0)
    const responseData = error?.response?.data
    if (status !== 400 || !responseData || typeof responseData !== "object" || Array.isArray(responseData)) {
      throw error
    }

    const fallbackBody = remapPurchaseCreateBodyForSerializer(body, responseData as Record<string, unknown>)
    if (JSON.stringify(fallbackBody) === JSON.stringify(body)) {
      console.error("PURCHASE CREATE 400", { requestBody: body, responseData })
      throw error
    }

    try {
      const { data } = await api.post(url, fallbackBody)
      return data
    } catch (retryError: any) {
      console.error("PURCHASE CREATE 400 RETRY", {
        requestBody: body,
        fallbackBody,
        responseData: retryError?.response?.data ?? responseData,
      })
      throw retryError
    }
  }
}

function normalizePurchaseListItem(row: any): PurchaseListItem {
  return {
    id: Number(row?.id ?? 0),
    purchase_no: String(row?.purchase_no ?? ""),
    supplier: row?.supplier ? Number(row.supplier) : null,
    supplier_name: row?.supplier_name ? String(row.supplier_name) : null,
    received_date: row?.received_date ? String(row.received_date) : null,
    produced_date: row?.produced_date ? String(row.produced_date) : null,
    delivery_company: row?.delivery_company ? String(row.delivery_company) : "",
    location: row?.location ? Number(row.location) : null,
    location_name: row?.location_name ? String(row.location_name) : null,
    notes: row?.notes ? String(row.notes) : "",
    status: String(row?.status ?? "DRAFT") as PurchaseListItem["status"],
    currency: String(row?.currency ?? "UZS") as PurchaseListItem["currency"],
    subtotal: toFiniteNumber(row?.subtotal),
    total: toFiniteNumber(row?.total),
    remaining_amount: toFiniteNumber(row?.remaining_amount),
    payment_status: String(row?.payment_status ?? "UNPAID"),
    paid_amount: toFiniteNumber(row?.paid_amount),
    confirmed_at: row?.confirmed_at ? String(row.confirmed_at) : null,
    cancelled_at: row?.cancelled_at ? String(row.cancelled_at) : null,
    deleted_at: row?.deleted_at ? String(row.deleted_at) : null,
    created_at: String(row?.created_at ?? ""),
    updated_at: String(row?.updated_at ?? ""),
  }
}

function normalizePurchaseDetail(row: any): PurchaseDetail {
  const base = normalizePurchaseListItem(row)
  const items = asList(row?.items).map((item) => ({
    id: Number(item?.id ?? 0),
    raw_material: Number(item?.raw_material ?? item?.raw_material_id ?? 0) || null,
    raw_material_name: String(item?.raw_material_name ?? item?.material_name ?? ""),
    qty: String(item?.qty ?? item?.quantity ?? "0"),
    unit_price: toFiniteNumber(item?.unit_price ?? item?.price),
    line_subtotal:
      toFiniteNumber(item?.line_subtotal ?? item?.subtotal) ||
      toFiniteNumber(item?.line_total ?? item?.total) ||
      toFiniteNumber(item?.qty ?? item?.quantity) * toFiniteNumber(item?.unit_price ?? item?.price),
    line_total:
      toFiniteNumber(item?.line_total ?? item?.total) ||
      toFiniteNumber(item?.line_subtotal ?? item?.subtotal) ||
      toFiniteNumber(item?.qty ?? item?.quantity) * toFiniteNumber(item?.unit_price ?? item?.price),
  }))
  const payments = asList(row?.payments).map((payment) => ({
    id: Number(payment?.id ?? 0),
    method: String(payment?.method ?? ""),
    amount: toFiniteNumber(payment?.amount),
    currency: String(payment?.currency ?? "UZS") as PurchaseDetail["currency"],
    paid_at: String(payment?.paid_at ?? ""),
    note: payment?.note ? String(payment.note) : null,
  }))
  return {
    ...base,
    items,
    payments,
  }
}

export async function fetchPurchasesMeta() {
  try {
    const { data } = await api.get<PurchasesMeta>(`${PURCHASES_BASE}/meta/`)
    return normalizePurchasesMeta(data) ?? FALLBACK_PURCHASES_META
  } catch (error: any) {
    if (Number(error?.response?.status || 0) !== 404) throw error
    return FALLBACK_PURCHASES_META
  }
}

async function mutatePurchaseItemWithBodyFallback(
  method: "post" | "patch",
  url: string,
  body: Record<string, any>
) {
  try {
    const { data } = await api[method](url, body)
    return data
  } catch (error: any) {
    const status = Number(error?.response?.status || 0)
    const responseData = error?.response?.data
    if (status !== 400 || !responseData || typeof responseData !== "object" || Array.isArray(responseData)) {
      throw error
    }

    const fallbackBody = remapPurchaseItemBodyForSerializer(body, responseData as Record<string, unknown>)
    if (JSON.stringify(fallbackBody) === JSON.stringify(body)) {
      throw error
    }

    const { data } = await api[method](url, fallbackBody)
    return data
  }
}

export async function fetchPurchases(params: PurchasesListParams) {
  const { data } = await api.get<PageResponse<PurchaseListItem>>(`${PURCHASES_BASE}/`, {
    params: cleanParams(params),
  })
  const rows = asList(data).map(normalizePurchaseListItem)
  if (Array.isArray(data)) {
    return {
      results: rows,
      count: rows.length,
      next: null,
      previous: null,
    }
  }
  return {
    results: rows,
    count: Number(data?.count ?? rows.length),
    next: data?.next ?? null,
    previous: data?.previous ?? null,
  }
}

export async function fetchPurchase(id: number) {
  const { data } = await api.get<PurchaseDetail>(`${PURCHASES_BASE}/${id}/`)
  return normalizePurchaseDetail(data)
}

export async function addPurchasePayment(
  purchaseId: number,
  payload: {
    method: string
    amount: number
    currency?: "UZS" | "USD" | string
    occurred_on?: string
    note?: string
  }
) {
  const body = cleanParams({
    purchase_id: purchaseId,
    method: payload.method,
    amount: Number(payload.amount || 0),
    occurred_on: payload.occurred_on ? String(payload.occurred_on).slice(0, 10) : undefined,
    note: payload.note ?? "",
  })

  let lastError: unknown = null
  for (const url of ["/api/v1/finance/payments/purchase/", "/api/v1/finance/payments/purchase"]) {
    try {
      await api.post(url, body)
      return fetchPurchase(purchaseId)
    } catch (error: any) {
      const status = Number(error?.response?.status || 0)
      if (status !== 404) throw error
      lastError = error
    }
  }

  throw lastError ?? new Error("Purchase payment endpoint topilmadi")
}

export async function createPurchase(payload: CreatePurchasePayload) {
  const items = Array.isArray(payload.items)
    ? payload.items
        .map((item) => {
          const rawMaterialId = Number(item?.raw_material ?? 0)
          const qty = toQtyString(item?.qty)
          const unitPrice = Number(item?.unit_price ?? 0)
          if (!rawMaterialId || !qty || !Number.isFinite(unitPrice) || unitPrice < 0) return null
          return {
            raw_material: rawMaterialId,
            qty,
            unit_price: unitPrice,
          }
        })
        .filter(Boolean)
    : []

  const body = {
    supplier: payload.supplier,
    received_date: payload.received_date || undefined,
    produced_date: payload.produced_date || undefined,
    delivery_company: payload.delivery_company || undefined,
    location: payload.location,
    notes: payload.notes || undefined,
    currency: payload.currency || "UZS",
    items,
  }

  const data = await postPurchaseWithBodyFallback(`${PURCHASES_BASE}/`, body)
  return normalizePurchaseDetail(data)
}

export async function patchPurchase(id: number, payload: PatchPurchasePayload) {
  const requestBody = cleanParams({
    supplier: payload.supplier,
    received_date: payload.received_date || undefined,
    produced_date: payload.produced_date || undefined,
    delivery_company: payload.delivery_company || undefined,
    location: payload.location,
    notes: payload.notes || undefined,
    currency: payload.currency || undefined,
  })

  try {
    const { data } = await api.patch<PurchaseDetail>(`${PURCHASES_BASE}/${id}/`, requestBody)
    return normalizePurchaseDetail(data)
  } catch (error: any) {
    const responseData = error?.response?.data
    const fallbackBody = { ...(requestBody as Record<string, unknown>) }

    if (Number(error?.response?.status || 0) !== 400 || !responseData || typeof responseData !== "object") {
      throw error
    }

    if (isUnknownFieldError((responseData as Record<string, unknown>)?.currency)) {
      delete fallbackBody.currency
    }

    if (Object.keys(fallbackBody).length === Object.keys(requestBody).length) {
      throw error
    }

    const { data } = await api.patch<PurchaseDetail>(`${PURCHASES_BASE}/${id}/`, fallbackBody)
    return normalizePurchaseDetail(data)
  }
}

export async function addPurchaseItem(purchaseId: number, payload: PurchaseItemPayload) {
  const qty = toQtyString(payload.qty)
  if (!qty) throw new Error("Qty musbat son bo'lishi kerak")
  const body = {
    raw_material: payload.raw_material,
    qty,
    unit_price: payload.unit_price,
  }
  const data = await mutatePurchaseItemWithBodyFallback("post", `${PURCHASES_BASE}/${purchaseId}/items/`, body)
  return normalizePurchaseDetail(data)
}

export async function patchPurchaseItem(
  purchaseId: number,
  itemId: number,
  payload: Partial<PurchaseItemPayload>
) {
  const qty = payload.qty ? toQtyString(payload.qty) : undefined
  if (payload.qty && !qty) throw new Error("Qty musbat son bo'lishi kerak")
  const body = cleanParams({
    raw_material: payload.raw_material,
    qty,
    unit_price: payload.unit_price,
  })
  const data = await mutatePurchaseItemWithBodyFallback(
    "patch",
    `${PURCHASES_BASE}/${purchaseId}/items/${itemId}/`,
    body
  )
  return normalizePurchaseDetail(data)
}

export async function deletePurchaseItem(purchaseId: number, itemId: number) {
  await api.delete(`${PURCHASES_BASE}/${purchaseId}/items/${itemId}/`)
  return fetchPurchase(purchaseId)
}

export async function deletePurchase(purchaseId: number) {
  await api.delete(`${PURCHASES_BASE}/${purchaseId}/`)
  warehouseEvents.emit()
}

export async function confirmPurchase(purchaseId: number) {
  await postPurchaseActionWithFallback(
    `${PURCHASES_BASE}/${purchaseId}/confirm/`,
    `${PURCHASES_BASE}/${purchaseId}/confirm`
  )
  const normalized = await fetchPurchase(purchaseId)
  warehouseEvents.emit()
  return normalized
}

export async function cancelPurchase(purchaseId: number) {
  await postPurchaseActionWithFallback(
    `${PURCHASES_BASE}/${purchaseId}/cancel/`,
    `${PURCHASES_BASE}/${purchaseId}/cancel`
  )
  warehouseEvents.emit()
  return fetchPurchase(purchaseId)
}

async function downloadPurchaseExport(url: string, filename: string) {
  const { data } = await api.get(url, { responseType: "blob" })
  const blob = new Blob([data])
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

function toCsvCell(value: string | number | null | undefined) {
  const text = String(value ?? "")
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export async function exportPurchasesExcel() {
  const rows = (await fetchPurchases({ page: 1, page_size: 10000, ordering: "-id" })).results
  if (!rows.length) {
    throw new Error("Eksport uchun kirim topilmadi")
  }

  const detail = await fetchPurchase(rows[0].id)
  const docDateSource = detail.received_date || detail.created_at || new Date().toISOString()
  const docDate = new Date(docDateSource)
  const formattedDate = Number.isNaN(docDate.getTime())
    ? String(docDateSource)
    : `${docDate.getDate().toString().padStart(2, "0")} ${docDate.toLocaleString("ru-RU", { month: "long" })} ${docDate.getFullYear()}г.`

  downloadPurchaseDocumentTemplate({
    filename: `purchase-order-${detail.purchase_no || detail.id}.xls`,
    title: "Заказ поставщику",
    docNumber: detail.purchase_no || String(detail.id),
    docDate: `от ${formattedDate}`,
    customer: detail.location_name || 'Общество с ограниченной ответственностью "Продуктовый рай"',
    supplier: detail.supplier_name || "Поставщик не указан",
    note: detail.notes || "",
    rows: detail.items.map((item) => ({
      name: item.raw_material_name || `Материал #${item.raw_material ?? "-"}`,
      uom: "шт.",
      qty: Number(item.qty || 0),
      price: Number(item.unit_price || 0),
      total: Number(item.line_total || 0),
    })),
  })
}

export async function exportPurchasesTemplateExcel() {
  const rows = (await fetchPurchases({ page: 1, page_size: 10000, ordering: "-id" })).results
  if (!rows.length) {
    throw new Error("Eksport uchun kirim topilmadi")
  }

  const detail = await fetchPurchase(rows[0].id)
  const docDateSource = detail.received_date || detail.created_at || new Date().toISOString()
  const docDate = new Date(docDateSource)
  const formattedDate = Number.isNaN(docDate.getTime())
    ? String(docDateSource)
    : `${docDate.getDate().toString().padStart(2, "0")} ${docDate.toLocaleString("ru-RU", { month: "long" })} ${docDate.getFullYear()}г.`

  downloadPurchaseDocumentTemplate({
    filename: `purchase-order-${detail.purchase_no || detail.id}.xls`,
    title: "Заказ поставщику",
    docNumber: detail.purchase_no || String(detail.id),
    docDate: `от ${formattedDate}`,
    customer: detail.location_name || 'Общество с ограниченной ответственностью "Продуктовый рай"',
    supplier: detail.supplier_name || "Поставщик не указан",
    note: detail.notes || "",
    rows: detail.items.map((item) => ({
      name: item.raw_material_name || `Материал #${item.raw_material ?? "-"}`,
      uom: "шт.",
      qty: Number(item.qty || 0),
      price: Number(item.unit_price || 0),
      total: Number(item.line_total || 0),
    })),
  })
}

export async function exportPurchasesPdf() {
  await downloadPurchaseExport(
    `${PURCHASES_BASE}/export-pdf/`,
    `purchases_${new Date().toISOString().slice(0, 10)}.pdf`
  )
}

function buildPurchaseExportFilename(purchaseId: number, purchaseNo?: string | null) {
  const normalizedNumber = String(purchaseNo || "").trim().replace(/[^\w.-]+/g, "-")
  return normalizedNumber ? `${normalizedNumber}.xlsx` : `purchase-${purchaseId}.xlsx`
}

export async function exportPurchaseExcel(purchaseId: number, purchaseNo?: string | null) {
  if (!Number.isFinite(purchaseId) || purchaseId <= 0) {
    throw new Error("Eksport uchun purchase ID noto'g'ri")
  }

  await downloadPurchaseExport(
    `${PURCHASES_BASE}/${purchaseId}/export/`,
    buildPurchaseExportFilename(purchaseId, purchaseNo)
  )
}

export async function fetchPurchaseSuppliers(): Promise<LookupItem[]> {
  const suppliers = await apiAxios.listSuppliersPage({
    page: 1,
    page_size: 500,
    ordering: "name",
    is_active: true,
  })
  return suppliers.items
    .map((x) => ({
      id: Number(x?.id ?? 0),
      name: String(x?.name ?? x?.company ?? `Supplier #${x?.id ?? "-"}`),
    }))
    .filter((x) => x.id > 0)
}

export async function fetchPurchaseLocations(): Promise<Array<LookupItem & { warehouse_id?: number }>> {
  const { data } = await api.get("/api/v1/dicts/locations/")
  return unwrapResults<any>(data?.locations ?? data)
    .map((x) => {
      const nestedWarehouse =
        typeof x?.warehouse === "object" && x?.warehouse !== null ? x.warehouse : null
      const id = Number(x?.id ?? x?.value ?? x?.location_id ?? 0)
      const warehouseRef = Number(x?.warehouse_id ?? x?.warehouse ?? nestedWarehouse?.id ?? 0)
      const warehouseName = String(x?.warehouse_name ?? nestedWarehouse?.name ?? "").trim()
      const name = String(
        x?.name ??
          x?.label ??
          x?.title ??
          (warehouseName ? `${warehouseName} - #${id}` : `Location #${id || "-"}`)
      )
      return { id, name, warehouse_id: warehouseRef || undefined }
    })
    .filter((x) => x.id > 0)
}

export async function fetchPurchaseMaterials(): Promise<PurchaseMaterialOption[]> {
  return []
}
