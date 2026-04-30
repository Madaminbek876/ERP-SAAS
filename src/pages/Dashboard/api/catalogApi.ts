// src/pages/Dashboard/api/catalogApi.ts
import { http } from "@/shared/http"

export type CatalogCategory = { id: number; name: string }
export type CatalogUom = { id: number; name: string; code?: string }

export type ProductCreatePayload = {
  name: string
  category: number
  uom: number
  selling_price?: number
  default_selling_price?: number
  currency: "UZS"
  barcode?: string
  code?: string
}

export type ProductRow = {
  id: number
  name: string
  category: number | null
  category_name?: string
  uom: number
  uom_name?: string
  default_selling_price: number | null
  currency: string
  barcode?: string | null
  deleted_at?: string | null
  created_at?: string
  updated_at?: string
}

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] }

function unwrapList<T>(res: any): T[] {
  if (Array.isArray(res)) return res as T[]
  if (res && Array.isArray(res.results)) return res.results as T[]
  return []
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeProduct(row: any): ProductRow {
  const hasDeletedAt = row && Object.prototype.hasOwnProperty.call(row, "deleted_at")
  return {
    id: Number(row?.id ?? 0),
    name: String(row?.name ?? ""),
    category: toNullableNumber(row?.category),
    category_name: row?.category_name ? String(row.category_name) : undefined,
    uom: Number(row?.uom ?? 0),
    uom_name: row?.uom_name ? String(row.uom_name) : undefined,
    default_selling_price: toNullableNumber(row?.default_selling_price ?? row?.selling_price),
    currency: String(row?.currency ?? "UZS"),
    barcode: row?.barcode ? String(row.barcode) : row?.code ? String(row.code) : null,
    deleted_at: hasDeletedAt ? (row?.deleted_at ? String(row.deleted_at) : null) : undefined,
    created_at: row?.created_at ? String(row.created_at) : undefined,
    updated_at: row?.updated_at ? String(row.updated_at) : undefined,
  }
}

function normalizeCatalogUom(row: any): CatalogUom {
  return {
    id: Number(row?.id ?? row?.value ?? 0),
    name: String(row?.name ?? row?.label ?? row?.title ?? ""),
    code: row?.code ? String(row.code) : undefined,
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

function pickSellingPrice(payload: ProductCreatePayload) {
  const value = payload.selling_price ?? payload.default_selling_price
  return value === undefined ? undefined : value
}

function toProductPayload(
  payload: ProductCreatePayload,
  priceField: "selling_price" | "default_selling_price" = "selling_price"
) {
  const sellingPrice = pickSellingPrice(payload)
  return {
    name: payload.name,
    category: payload.category,
    uom: payload.uom,
    currency: payload.currency,
    ...(payload.barcode !== undefined ? { barcode: payload.barcode } : {}),
    ...(payload.code !== undefined ? { code: payload.code } : {}),
    ...(sellingPrice !== undefined ? { [priceField]: sellingPrice } : {}),
  }
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

async function createProductWithFallback(payload: ProductCreatePayload) {
  const body = toProductPayload(payload)

  try {
    return await http.post<any>(ENDPOINTS.products, body)
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

    return http.post<any>(ENDPOINTS.products, fallbackBody)
  }
}

function isNotFound(error: any) {
  return Number(error?.response?.status || 0) === 404
}

async function withEndpointFallback<T>(
  candidates: string[],
  runner: (base: string) => Promise<T>
): Promise<T> {
  let lastError: any = null
  for (const base of candidates) {
    try {
      return await runner(base)
    } catch (error: any) {
      if (!isNotFound(error)) throw error
      lastError = error
    }
  }
  throw lastError ?? new Error("Endpoint topilmadi")
}

const ENDPOINTS = {
  products: "/api/v1/catalog/products/",
  categories: ["/api/v1/dicts/product-categories/"],
  uoms: ["/api/v1/dicts/uom/"],
}

export const catalogApi = {
  async listCategories(): Promise<CatalogCategory[]> {
    const res = await withEndpointFallback(ENDPOINTS.categories, (base) =>
      http.get<Paginated<CatalogCategory> | CatalogCategory[] | any>(base)
    )
    return unwrapList<CatalogCategory>(res)
  },

  async listUoms(): Promise<CatalogUom[]> {
    const res = await withEndpointFallback(ENDPOINTS.uoms, (base) =>
      http.get<Paginated<CatalogUom> | CatalogUom[] | any>(base)
    )
    return unwrapList<any>(res).map(normalizeCatalogUom).filter((row) => row.id > 0)
  },

  async createProduct(payload: ProductCreatePayload): Promise<ProductRow> {
    const res = await createProductWithFallback(payload)
    return normalizeProduct(res)
  },

  // ✅ ixtiyoriy: product list kerak bo‘lsa (table uchun)
  async listProducts(params?: { search?: string; page?: number; page_size?: number }) {
    const res = await http.get<Paginated<ProductRow> | ProductRow[] | any>(ENDPOINTS.products, params as any)
    if (Array.isArray(res)) return res.map(normalizeProduct)
    if (Array.isArray(res?.results)) {
      return { ...res, results: res.results.map(normalizeProduct) }
    }
    return []
  },
}
