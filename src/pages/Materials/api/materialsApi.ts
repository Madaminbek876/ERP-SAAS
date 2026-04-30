import { http } from "@/shared/http"

type ListParams = {
  search?: string
  ordering?: "name" | "-name" | "created_at" | "-created_at"
  page?: number
}

function unwrapList<T = any>(res: any): { rows: T[]; count: number } {
  if (Array.isArray(res)) return { rows: res as T[], count: res.length }
  if (res && Array.isArray(res.results)) {
    return { rows: res.results as T[], count: Number(res.count ?? res.results.length) }
  }
  return { rows: [], count: 0 }
}

export type Material = {
  id: number
  name: string
  barcode?: string | null
  description?: string | null
  material_type: number | null
  material_type_name?: string | null
  uom: number | null
  uom_name?: string | null
  purchase_price: number | null
  default_purchase_price?: number | null
  currency: "UZS" | string
  deleted_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type MaterialCreatePayload = {
  name: string
  material_type: number
  uom: number
  description?: string | null
  purchase_price?: number | null
  currency?: "UZS"
}

export type MaterialUpdatePayload = MaterialCreatePayload

const EP = {
  list: "",
  detail: (_id: number) => "",
}

function asObject(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : null
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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

function normalizeMaterial(row: any): Material {
  const hasDeletedAt = row && Object.prototype.hasOwnProperty.call(row, "deleted_at")
  const hasCreatedAt = row && Object.prototype.hasOwnProperty.call(row, "created_at")
  const hasUpdatedAt = row && Object.prototype.hasOwnProperty.call(row, "updated_at")
  const materialType = asObject(row?.material_type)
  const uom = asObject(row?.uom)
  return {
    id: Number(row?.id ?? 0),
    name: String(row?.name ?? ""),
    barcode: row?.barcode ? String(row.barcode) : row?.code ? String(row.code) : null,
    description: firstString(row?.description) ?? null,
    material_type: extractLookupId(row?.material_type) ?? extractLookupId(row?.material_type_id),
    material_type_name:
      firstString(row?.material_type_name, row?.material_type_label, extractLookupLabel(materialType)) ?? null,
    uom: extractLookupId(row?.uom) ?? extractLookupId(row?.uom_id),
    uom_name: firstString(row?.uom_name, row?.uom_label, extractLookupLabel(uom)) ?? null,
    purchase_price: toNullableNumber(row?.default_purchase_price ?? row?.purchase_price),
    default_purchase_price: toNullableNumber(row?.default_purchase_price ?? row?.purchase_price),
    currency: String(row?.currency ?? "UZS"),
    deleted_at: hasDeletedAt ? (row?.deleted_at ? String(row.deleted_at) : null) : undefined,
    created_at: hasCreatedAt ? (row?.created_at ? String(row.created_at) : null) : undefined,
    updated_at: hasUpdatedAt ? (row?.updated_at ? String(row.updated_at) : null) : undefined,
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

function toMaterialPayload(
  payload: MaterialCreatePayload | MaterialUpdatePayload,
  priceField: "default_purchase_price" | "purchase_price" = "purchase_price"
) {
  const body: Record<string, unknown> = {}
  if (payload.name !== undefined) body.name = payload.name
  if (payload.material_type !== undefined) body.material_type = payload.material_type
  if (payload.uom !== undefined) body.uom = payload.uom
  if (payload.description !== undefined) body.description = payload.description
  if (payload.purchase_price !== undefined) {
    body[priceField] = payload.purchase_price
  }
  if (payload.currency !== undefined) body.currency = payload.currency
  return body
}

function remapMaterialPayloadForSerializer(body: Record<string, unknown>, errors: Record<string, unknown>) {
  const next = { ...body }

  if (
    (isUnknownFieldError(errors?.default_purchase_price) || isRequiredFieldError(errors?.purchase_price)) &&
    next.default_purchase_price !== undefined
  ) {
    next.purchase_price = next.default_purchase_price
    delete next.default_purchase_price
  }

  if (
    (isUnknownFieldError(errors?.purchase_price) || isRequiredFieldError(errors?.default_purchase_price)) &&
    next.purchase_price !== undefined
  ) {
    next.default_purchase_price = next.purchase_price
    delete next.purchase_price
  }

  if ((isUnknownFieldError(errors?.material_type) || isRequiredFieldError(errors?.material_type_id)) && next.material_type !== undefined) {
    next.material_type_id = next.material_type
    delete next.material_type
  }

  if ((isUnknownFieldError(errors?.material_type_id) || isRequiredFieldError(errors?.material_type)) && next.material_type_id !== undefined) {
    next.material_type = next.material_type_id
    delete next.material_type_id
  }

  if ((isUnknownFieldError(errors?.uom) || isRequiredFieldError(errors?.uom_id)) && next.uom !== undefined) {
    next.uom_id = next.uom
    delete next.uom
  }

  if ((isUnknownFieldError(errors?.uom_id) || isRequiredFieldError(errors?.uom)) && next.uom_id !== undefined) {
    next.uom = next.uom_id
    delete next.uom_id
  }

  if (isUnknownFieldError(errors?.currency)) {
    delete next.currency
  }

  if (isUnknownFieldError(errors?.description)) {
    delete next.description
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

export function extractMaterialApiErrorMessage(error: unknown, fallback = "Something went wrong") {
  const apiMessage = extractMessageFromNode((error as any)?.response?.data)
  if (apiMessage) return apiMessage

  const errorMessage =
    typeof (error as any)?.message === "string" ? (error as any).message.trim() : ""
  return errorMessage || fallback
}

async function submitMaterialRequest<T>(
  method: "post" | "patch",
  url: string,
  payload: MaterialCreatePayload | MaterialUpdatePayload
) {
  const body = toMaterialPayload(payload)

  try {
    return method === "post" ? await http.post<T>(url, body) : await http.patch<T>(url, body)
  } catch (error: any) {
    const status = Number(error?.response?.status || 0)
    const responseData = error?.response?.data
    if (status !== 400 || !responseData || typeof responseData !== "object" || Array.isArray(responseData)) {
      throw error
    }

    const fallbackBody = remapMaterialPayloadForSerializer(body, responseData as Record<string, unknown>)
    if (JSON.stringify(fallbackBody) === JSON.stringify(body)) {
      throw error
    }

    return method === "post"
      ? await http.post<T>(url, fallbackBody)
      : await http.patch<T>(url, fallbackBody)
  }
}

export const materialsApi = {
  async list(params?: ListParams) {
    const res = await http.get<any>(EP.list, params)
    const { rows, count } = unwrapList<any>(res)
    return { rows: rows.map(normalizeMaterial), count }
  },
  async listAll(params?: Omit<ListParams, "page">) {
    const firstResponse = await http.get<any>(EP.list, { ...params, page: 1 })
    const firstPage = unwrapList<any>(firstResponse)

    if (Array.isArray(firstResponse)) {
      return { rows: firstPage.rows.map(normalizeMaterial), count: firstPage.count }
    }

    const totalCount = Number(firstResponse?.count ?? firstPage.count)
    if (!Array.isArray(firstResponse?.results) || firstPage.rows.length >= totalCount) {
      return { rows: firstPage.rows.map(normalizeMaterial), count: firstPage.rows.length }
    }

    const collected = [...firstPage.rows]
    for (let nextPage = 2; collected.length < totalCount; nextPage += 1) {
      const nextResponse = await http.get<any>(EP.list, { ...params, page: nextPage })
      const nextPageRows = unwrapList<any>(nextResponse).rows
      if (nextPageRows.length === 0) break
      collected.push(...nextPageRows)
    }

    return { rows: collected.map(normalizeMaterial), count: collected.length }
  },
  async detail(id: number) {
    const res = await http.get<any>(EP.detail(id))
    return normalizeMaterial(res)
  },
  async create(payload: MaterialCreatePayload) {
    const res = await submitMaterialRequest<any>("post", EP.list, payload)
    return normalizeMaterial(res)
  },
  async update(id: number, payload: MaterialUpdatePayload) {
    const res = await submitMaterialRequest<any>("patch", EP.detail(id), payload)
    return normalizeMaterial(res)
  },
  async remove(id: number) {
    return http.delete<void>(EP.detail(id))
  },
}
