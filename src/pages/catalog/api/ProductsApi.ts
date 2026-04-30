import { api } from "@/lib/api"
import { http } from "@/shared/http"

export type Currency = "UZS" | "USD" | "RUB" | string

export type Product = {
  id: number
  name: string
  category: number | null
  category_name?: string | null
  uom: number | null
  uom_name?: string | null
  min_price: number | null
  selling_price: number | null
  default_selling_price: number | null
  currency: Currency
  barcode?: string | null
  barcode_image?: string | null
  deleted_at?: string | null
  created_at?: string
  updated_at?: string
  stock_qty?: number | string | null
  qty_onhand?: number | string | null
  balance_qty?: number | string | null
  qty?: number | string | null
  quantity?: number | string | null
}

export type ProductCreatePayload = {
  name: string
  category?: number | null
  uom: number
  min_price?: number | null
  selling_price?: number | null
  default_selling_price?: number | null
  currency: "UZS"
  barcode?: string
  code?: string
}

export type ProductPatchPayload = Partial<ProductCreatePayload>

export type ProductBinaryResponse = {
  blob: Blob
  contentType: string
  filename: string | null
}

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] }

type ListParams = {
  search?: string
  category?: number
  ordering?: "name" | "-name" | "created_at" | "-created_at"
  page?: number
  page_size?: number
}

function unwrapList<T>(res: any): { rows: T[]; count: number } {
  if (Array.isArray(res)) return { rows: res as T[], count: (res as T[]).length }
  if (res && Array.isArray(res.results)) {
    return { rows: res.results as T[], count: Number(res.count ?? res.results.length) }
  }
  return { rows: [], count: 0 }
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asObject(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : null
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim()
      if (trimmed) return trimmed
      continue
    }
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return null
}

function extractLookupId(value: unknown): number | null {
  const nested = asObject(value)
  return toNullableNumber(nested ? nested.id ?? nested.value ?? nested.pk : value)
}

function extractLookupLabel(value: unknown): string | null {
  const nested = asObject(value)
  if (!nested) return firstString(value)
  return firstString(nested.name, nested.label, nested.title, nested.code, nested.value)
}

function normalizeProduct(row: any): Product {
  const hasDeletedAt = row && Object.prototype.hasOwnProperty.call(row, "deleted_at")
  const category = asObject(row?.category)
  const uom = asObject(row?.uom)
  return {
    id: Number(row?.id ?? 0),
    name: String(row?.name ?? ""),
    category: extractLookupId(row?.category) ?? extractLookupId(row?.category_id),
    category_name: firstString(row?.category_name, row?.category_label, extractLookupLabel(category)) ?? null,
    uom: extractLookupId(row?.uom) ?? extractLookupId(row?.uom_id),
    uom_name: firstString(row?.uom_name, row?.uom_label, extractLookupLabel(uom)) ?? null,
    min_price: toNullableNumber(row?.min_price),
    selling_price: toNullableNumber(row?.selling_price ?? row?.default_selling_price),
    default_selling_price: toNullableNumber(row?.default_selling_price ?? row?.selling_price),
    currency: String(row?.currency ?? "UZS"),
    barcode: row?.barcode ? String(row.barcode) : row?.code ? String(row.code) : null,
    barcode_image: row?.barcode_image ? String(row.barcode_image) : null,
    deleted_at: hasDeletedAt ? (row?.deleted_at ? String(row.deleted_at) : null) : undefined,
    created_at: row?.created_at ? String(row.created_at) : undefined,
    updated_at: row?.updated_at ? String(row.updated_at) : undefined,
    stock_qty: row?.stock_qty ?? null,
    qty_onhand: row?.qty_onhand ?? null,
    balance_qty: row?.balance_qty ?? null,
    qty: row?.qty ?? null,
    quantity: row?.quantity ?? null,
  }
}

function isUnknownFieldError(value: unknown) {
  const message = String(value || "").toLowerCase()
  return (
    message.includes("unknown field") ||
    message.includes("not allowed") ||
    message.includes("cannot be sent") ||
    message.includes("unexpected field") ||
    message.includes("bu fieldni yuborish mumkin emas")
  )
}

function isRequiredFieldError(value: unknown) {
  const message = String(value || "").toLowerCase()
  return (
    message.includes("required") ||
    message.includes("majburiy") ||
    message.includes("this field is required") ||
    message.includes("обязател")
  )
}

function pickSellingPrice(payload: ProductCreatePayload | ProductPatchPayload) {
  const value = payload.selling_price ?? payload.default_selling_price
  return value === undefined ? undefined : value
}

function toProductPayload(
  payload: ProductCreatePayload | ProductPatchPayload,
  priceField: "selling_price" | "default_selling_price" = "selling_price"
) {
  const body: Record<string, unknown> = {}
  if (payload.name !== undefined) body.name = payload.name
  if (payload.category !== undefined) body.category = payload.category
  if (payload.uom !== undefined) body.uom = payload.uom
  if (payload.min_price !== undefined) body.min_price = payload.min_price
  const sellingPrice = pickSellingPrice(payload)
  if (sellingPrice !== undefined) {
    body[priceField] = sellingPrice
  }
  if (payload.currency !== undefined) body.currency = payload.currency
  if (payload.barcode !== undefined) body.barcode = payload.barcode
  if (payload.code !== undefined) body.code = payload.code
  return body
}

function remapProductPayloadForSerializer(
  body: Record<string, unknown>,
  errors: Record<string, unknown>
) {
  const next = { ...body }

  if (
    (isUnknownFieldError(errors?.selling_price) || isRequiredFieldError(errors?.default_selling_price)) &&
    next.selling_price !== undefined
  ) {
    next.default_selling_price = next.selling_price
    delete next.selling_price
  }

  if (
    (isUnknownFieldError(errors?.default_selling_price) || isRequiredFieldError(errors?.selling_price)) &&
    next.default_selling_price !== undefined
  ) {
    next.selling_price = next.default_selling_price
    delete next.default_selling_price
  }

  if (isUnknownFieldError(errors?.currency)) {
    delete next.currency
  }

  if (
    (isUnknownFieldError(errors?.barcode) || isRequiredFieldError(errors?.code)) &&
    next.barcode !== undefined
  ) {
    next.code = next.barcode
    delete next.barcode
  }

  if (
    (isUnknownFieldError(errors?.code) || isRequiredFieldError(errors?.barcode)) &&
    next.code !== undefined
  ) {
    next.barcode = next.code
    delete next.code
  }

  return next
}

function extractMessageFromNode(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractMessageFromNode(item)
      if (nested) return nested
    }
    return null
  }

  const objectValue = asObject(value)
  if (!objectValue) return null

  if (typeof objectValue.detail === "string" && objectValue.detail.trim()) {
    return objectValue.detail.trim()
  }

  for (const [key, nestedValue] of Object.entries(objectValue)) {
    const nested = extractMessageFromNode(nestedValue)
    if (!nested) continue
    return key === "non_field_errors" ? nested : `${key}: ${nested}`
  }

  return null
}

export function extractProductApiErrorMessage(error: unknown, fallback = "Something went wrong") {
  const apiMessage = extractMessageFromNode((error as any)?.response?.data)
  if (apiMessage) return apiMessage

  const errorMessage =
    typeof (error as any)?.message === "string" ? (error as any).message.trim() : ""
  return errorMessage || fallback
}

function extractFilename(disposition: unknown): string | null {
  const raw = String(disposition ?? "").trim()
  if (!raw) return null

  const utf8Match = raw.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).replace(/^["']|["']$/g, "").trim()
    } catch {
      return utf8Match[1].replace(/^["']|["']$/g, "").trim()
    }
  }

  const quotedMatch = raw.match(/filename\s*=\s*"([^"]+)"/i)
  if (quotedMatch?.[1]) return quotedMatch[1].trim()

  const plainMatch = raw.match(/filename\s*=\s*([^;]+)/i)
  if (plainMatch?.[1]) return plainMatch[1].replace(/^["']|["']$/g, "").trim()

  return null
}

async function fetchBinaryProductResponse(
  method: "get" | "post",
  url: string,
  data?: Record<string, unknown>
): Promise<ProductBinaryResponse> {
  const response =
    method === "get"
      ? await api.get(url, { responseType: "blob" })
      : await api.post(url, data, { responseType: "blob" })

  const contentType = String(response.headers?.["content-type"] ?? "")
  const filename = extractFilename(response.headers?.["content-disposition"])
  const blob =
    response.data instanceof Blob
      ? response.data
      : new Blob([response.data], {
          type: contentType || "application/octet-stream",
        })

  return { blob, contentType, filename }
}

async function submitProductRequest<T>(
  method: "post" | "patch",
  url: string,
  payload: ProductCreatePayload | ProductPatchPayload
) {
  const body = toProductPayload(payload)

  try {
    return method === "post" ? await http.post<T>(url, body) : await http.patch<T>(url, body)
  } catch (error: any) {
    const status = Number(error?.response?.status || 0)
    const responseData = error?.response?.data
    if (status !== 400 || !responseData || typeof responseData !== "object" || Array.isArray(responseData)) {
      throw error
    }

    const fallbackBody = remapProductPayloadForSerializer(body, responseData as Record<string, unknown>)
    if (JSON.stringify(fallbackBody) === JSON.stringify(body)) {
      throw error
    }

    return method === "post"
      ? await http.post<T>(url, fallbackBody)
      : await http.patch<T>(url, fallbackBody)
  }
}

const EP = {
  list: "/api/v1/catalog/products/",
  detail: (id: number) => `/api/v1/catalog/products/${id}/`,
  export: (id: number) => `/api/v1/catalog/products/${id}/export/`,
}

export const productsApi = {
  async list(params?: ListParams) {
    const res = await http.get<Paginated<Product> | Product[] | any>(EP.list, params as any)
    const { rows, count } = unwrapList<any>(res)
    return { rows: rows.map(normalizeProduct), count }
  },
  async listAll(params?: Omit<ListParams, "page" | "page_size">) {
    const firstResponse = await http.get<any>(EP.list, { ...params, page: 1 })
    const firstPage = unwrapList<any>(firstResponse)

    if (Array.isArray(firstResponse)) {
      return { rows: firstPage.rows.map(normalizeProduct), count: firstPage.count }
    }

    const totalCount = Number(firstResponse?.count ?? firstPage.count)
    if (!Array.isArray(firstResponse?.results) || firstPage.rows.length >= totalCount) {
      return { rows: firstPage.rows.map(normalizeProduct), count: firstPage.rows.length }
    }

    const collected = [...firstPage.rows]
    for (let nextPage = 2; collected.length < totalCount; nextPage += 1) {
      const nextResponse = await http.get<any>(EP.list, { ...params, page: nextPage })
      const nextPageRows = unwrapList<any>(nextResponse).rows
      if (nextPageRows.length === 0) break
      collected.push(...nextPageRows)
    }

    return { rows: collected.map(normalizeProduct), count: collected.length }
  },
  async create(payload: ProductCreatePayload) {
    const res = await submitProductRequest<any>("post", EP.list, payload)
    return normalizeProduct(res)
  },
  async patch(id: number, payload: ProductPatchPayload) {
    const res = await submitProductRequest<any>("patch", EP.detail(id), payload)
    return normalizeProduct(res)
  },
  async remove(id: number) {
    return http.delete<void>(EP.detail(id))
  },
  async detail(id: number) {
    const res = await http.get<any>(EP.detail(id))
    return normalizeProduct(res)
  },
  async exportFile(id: number) {
    return fetchBinaryProductResponse("get", EP.export(id))
  },
}
