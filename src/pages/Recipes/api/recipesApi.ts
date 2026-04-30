import { http } from "@/shared/http"

function unwrapList<T = any>(res: any): { rows: T[]; count: number } {
  if (Array.isArray(res)) return { rows: res as T[], count: res.length }
  if (res && Array.isArray(res.results)) {
    return { rows: res.results as T[], count: Number(res.count ?? res.results.length) }
  }
  if (res && Array.isArray(res.rows)) {
    return { rows: res.rows as T[], count: Number(res.count ?? res.rows.length) }
  }
  if (res && Array.isArray(res.items)) {
    return { rows: res.items as T[], count: Number(res.count ?? res.items.length) }
  }
  if (res && Array.isArray(res.data)) {
    return { rows: res.data as T[], count: Number(res.count ?? res.data.length) }
  }
  return { rows: [], count: 0 }
}

function isNotFound(error: any) {
  return Number(error?.response?.status || 0) === 404
}

async function withEndpointFallback<T>(
  candidates: string[],
  runner: (url: string) => Promise<T>
): Promise<T> {
  let lastError: any = null
  for (const url of candidates) {
    try {
      return await runner(url)
    } catch (error: any) {
      if (!isNotFound(error)) throw error
      lastError = error
    }
  }
  throw lastError ?? new Error("Recipe endpoint topilmadi")
}

function asArray<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value as T[]
  if (Array.isArray(value?.results)) return value.results as T[]
  if (Array.isArray(value?.rows)) return value.rows as T[]
  if (Array.isArray(value?.items)) return value.items as T[]
  if (Array.isArray(value?.data)) return value.data as T[]
  return []
}

export type RecipeCostByCurrency = {
  currency: string
  amount: number
  label?: string
}

export type RecipeStatus = "DRAFT" | "ACTIVE" | "ARCHIVED"

export type RecipeListItem = {
  id: number
  product: number
  product_name: string
  name?: string
  version: number
  status: RecipeStatus
  is_active: boolean
  created_at: string
  items_count: number
  unit_material_cost_by_currency?: RecipeCostByCurrency[]
  unit_material_cost_display?: string
  cost_warnings?: string[]
}

export type RecipeItemDetail = {
  id?: number
  raw_material: number
  raw_material_name?: string
  raw_material_currency?: string
  raw_material_default_purchase_price?: number | null
  qty_per_unit: string
  currency?: string
  default_purchase_price?: number | null
  line_material_cost_estimate?: number | null
  line_material_cost_display?: string
}

export type RecipeDetail = {
  id: number
  product: number
  product_name?: string
  name?: string
  version: number
  status: RecipeStatus
  is_active: boolean
  created_at: string
  updated_at?: string
  items: RecipeItemDetail[]
  unit_material_cost_by_currency?: RecipeCostByCurrency[]
  unit_material_cost_display?: string
  cost_warnings?: string[]
}

export type RecipePayloadItem = {
  raw_material?: number
  raw_material_id?: number
  material?: number
  material_id?: number
  qty_per_unit?: string
  qty?: string
  quantity?: string
}

export type RecipePayload = {
  name?: string
  version?: number
  product?: number
  product_id?: number
  status?: RecipeStatus
  is_active?: boolean
  items: RecipePayloadItem[]
}

type RecipeListParams = {
  product?: number
  status?: RecipeStatus
  is_default?: boolean
  search?: string
  page?: number
  is_active?: boolean
  q?: string
  ordering?: "created_at" | "-created_at" | "version" | "-version"
}

const EP = {
  list: [] as string[],
  detail: (_id: number) => [] as string[],
  productRecipes: (_productId: number) => [] as string[],
  createGeneric: [] as string[],
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
    message.includes("РѕР±СЏР·Р°С‚РµР»")
  )
}

function cloneRecipeItemsWithAlias(
  items: RecipePayloadItem[],
  transform: (item: RecipePayloadItem) => RecipePayloadItem
) {
  return items.map((item) => transform({ ...item }))
}

function pickRecipeItemId(item: RecipePayloadItem) {
  return item.raw_material ?? item.raw_material_id ?? item.material ?? item.material_id
}

function pickRecipeItemQty(item: RecipePayloadItem) {
  return item.qty_per_unit ?? item.qty ?? item.quantity
}

function remapRecipeItemIdField(items: RecipePayloadItem[], field: "raw_material" | "raw_material_id" | "material" | "material_id") {
  return cloneRecipeItemsWithAlias(items, (item) => {
    const id = pickRecipeItemId(item)
    delete item.raw_material
    delete item.raw_material_id
    delete item.material
    delete item.material_id
    if (id !== undefined) item[field] = id
    return item
  })
}

function remapRecipeItemQtyField(items: RecipePayloadItem[], field: "qty_per_unit" | "qty" | "quantity") {
  return cloneRecipeItemsWithAlias(items, (item) => {
    const qty = pickRecipeItemQty(item)
    delete item.qty_per_unit
    delete item.qty
    delete item.quantity
    if (qty !== undefined) item[field] = qty
    return item
  })
}

function toRecipePayload(payload: RecipePayload) {
  const body: Record<string, unknown> = {}

  if (payload.name !== undefined) body.name = payload.name
  if (payload.version !== undefined) body.version = payload.version
  if (payload.product !== undefined) body.product = payload.product
  else if (payload.product_id !== undefined) body.product_id = payload.product_id
  if (payload.status !== undefined) body.status = payload.status
  else if (payload.is_active !== undefined) body.status = payload.is_active ? "ACTIVE" : "DRAFT"
  body.items = Array.isArray(payload.items)
    ? payload.items.map((item) => {
        const next: RecipePayloadItem = {}
        const id = pickRecipeItemId(item)
        const qty = pickRecipeItemQty(item)

        if (id !== undefined) {
          if (item.raw_material !== undefined) next.raw_material = id
          else if (item.raw_material_id !== undefined) next.raw_material_id = id
          else if (item.material !== undefined) next.material = id
          else if (item.material_id !== undefined) next.material_id = id
          else next.raw_material = id
        }

        if (qty !== undefined) {
          if (item.qty_per_unit !== undefined) next.qty_per_unit = qty
          else if (item.qty !== undefined) next.qty = qty
          else if (item.quantity !== undefined) next.quantity = qty
          else next.qty_per_unit = qty
        }

        return next
      })
    : []

  return body
}

function remapRecipePayloadForSerializer(body: Record<string, unknown>, errors: Record<string, unknown>) {
  const next: Record<string, unknown> = {
    ...body,
    items: Array.isArray(body.items) ? (body.items as RecipePayloadItem[]).map((item) => ({ ...item })) : body.items,
  }

  if (
    (isUnknownFieldError(errors?.name) || isRequiredFieldError(errors?.recipe_name)) &&
    next.name !== undefined
  ) {
    next.recipe_name = next.name
    delete next.name
  }

  if (
    (isUnknownFieldError(errors?.recipe_name) || isRequiredFieldError(errors?.name)) &&
    next.recipe_name !== undefined
  ) {
    next.name = next.recipe_name
    delete next.recipe_name
  }

  if (
    (isUnknownFieldError(errors?.product) || isRequiredFieldError(errors?.product_id)) &&
    next.product !== undefined
  ) {
    next.product_id = next.product
    delete next.product
  }

  if (
    (isUnknownFieldError(errors?.product_id) || isRequiredFieldError(errors?.product)) &&
    next.product_id !== undefined
  ) {
    next.product = next.product_id
    delete next.product_id
  }

  if (isUnknownFieldError(errors?.version)) delete next.version

  if (isUnknownFieldError(errors?.status) && next.status !== undefined) {
    next.is_active = String(next.status).toUpperCase() === "ACTIVE"
    delete next.status
  }

  if (isUnknownFieldError(errors?.is_active) && next.is_active !== undefined) {
    delete next.is_active
  }

  const itemErrors = Array.isArray(errors?.items)
    ? (errors.items as Array<Record<string, unknown>>)
    : errors?.items && typeof errors.items === "object"
      ? [errors.items as Record<string, unknown>]
      : []

  if (Array.isArray(next.items) && itemErrors.length > 0) {
    if (itemErrors.some((itemError) => isRequiredFieldError(itemError?.material_id))) {
      next.items = remapRecipeItemIdField(next.items as RecipePayloadItem[], "material_id")
    } else if (itemErrors.some((itemError) => isRequiredFieldError(itemError?.material))) {
      next.items = remapRecipeItemIdField(next.items as RecipePayloadItem[], "material")
    } else if (itemErrors.some((itemError) => isRequiredFieldError(itemError?.raw_material_id))) {
      next.items = remapRecipeItemIdField(next.items as RecipePayloadItem[], "raw_material_id")
    } else if (itemErrors.some((itemError) => isRequiredFieldError(itemError?.raw_material))) {
      next.items = remapRecipeItemIdField(next.items as RecipePayloadItem[], "raw_material")
    } else if (itemErrors.some((itemError) => isUnknownFieldError(itemError?.material_id))) {
      next.items = remapRecipeItemIdField(next.items as RecipePayloadItem[], "material")
    } else if (itemErrors.some((itemError) => isUnknownFieldError(itemError?.material))) {
      next.items = remapRecipeItemIdField(next.items as RecipePayloadItem[], "material_id")
    } else if (itemErrors.some((itemError) => isUnknownFieldError(itemError?.raw_material_id))) {
      next.items = remapRecipeItemIdField(next.items as RecipePayloadItem[], "raw_material")
    } else if (itemErrors.some((itemError) => isUnknownFieldError(itemError?.raw_material))) {
      next.items = remapRecipeItemIdField(next.items as RecipePayloadItem[], "raw_material_id")
    }

    if (itemErrors.some((itemError) => isRequiredFieldError(itemError?.quantity))) {
      next.items = remapRecipeItemQtyField(next.items as RecipePayloadItem[], "quantity")
    } else if (itemErrors.some((itemError) => isRequiredFieldError(itemError?.qty))) {
      next.items = remapRecipeItemQtyField(next.items as RecipePayloadItem[], "qty")
    } else if (itemErrors.some((itemError) => isUnknownFieldError(itemError?.quantity))) {
      next.items = remapRecipeItemQtyField(next.items as RecipePayloadItem[], "qty_per_unit")
    } else if (itemErrors.some((itemError) => isUnknownFieldError(itemError?.qty))) {
      next.items = remapRecipeItemQtyField(next.items as RecipePayloadItem[], "qty_per_unit")
    } else if (itemErrors.some((itemError) => isUnknownFieldError(itemError?.qty_per_unit))) {
      next.items = remapRecipeItemQtyField(next.items as RecipePayloadItem[], "qty")
    }
  }

  return next
}

async function submitRecipeRequest<T>(
  method: "post" | "patch",
  url: string,
  payload: RecipePayload
) {
  const body = toRecipePayload(payload)

  try {
    return method === "post" ? await http.post<T>(url, body) : await http.patch<T>(url, body)
  } catch (error: any) {
    const status = Number(error?.response?.status || 0)
    const responseData = error?.response?.data
    if (status !== 400 || !responseData || typeof responseData !== "object" || Array.isArray(responseData)) {
      throw error
    }

    const fallbackBody = remapRecipePayloadForSerializer(body, responseData as Record<string, unknown>)
    if (JSON.stringify(fallbackBody) === JSON.stringify(body)) {
      throw error
    }

    return method === "post"
      ? await http.post<T>(url, fallbackBody)
      : await http.patch<T>(url, fallbackBody)
  }
}

export function extractRecipeApiErrorMessage(error: any, fallback: string) {
  const detail = error?.response?.data?.detail
  if (typeof detail === "string" && detail.trim()) return detail

  const data = error?.response?.data
  if (typeof data === "string") {
    const normalized = data.trim().toLowerCase()
    if (normalized.startsWith("<!doctype html") || normalized.startsWith("<html")) {
      return fallback
    }
    if (data.trim()) return data
  }

  const messages = flattenErrorMessages(data).filter((message) => {
    const normalized = message.trim().toLowerCase()
    return normalized !== "detail" && !normalized.startsWith("detail:")
  })
  if (messages.length > 0) return messages.join(" | ")

  return String(error?.message || fallback)
}

function normalizeCostByCurrency(value: any): RecipeCostByCurrency[] {
  return asArray(value).map((row: any) => ({
    currency: String(row?.currency ?? "UZS"),
    amount: Number(row?.amount ?? 0) || 0,
    label: row?.label ? String(row.label) : undefined,
  }))
}

function normalizeRecipeStatus(value: any): RecipeStatus {
  const status = String(value ?? "").toUpperCase()
  if (status === "ACTIVE" || status === "ARCHIVED") return status
  return "DRAFT"
}

function toRecipeListParams(params?: RecipeListParams) {
  if (!params) return undefined

  const next: Record<string, unknown> = {}
  const search = params.search?.trim() || params.q?.trim()

  if (params.product !== undefined) next.product = params.product
  if (params.ordering !== undefined) next.ordering = params.ordering
  if (params.page !== undefined) next.page = params.page
  if (params.is_default !== undefined) next.is_default = params.is_default
  if (search) next.search = search

  if (params.status !== undefined) next.status = params.status
  else if (params.is_active === true) next.status = "ACTIVE"

  return next
}

function normalizeRecipeItem(row: any): RecipeItemDetail {
  return {
    id: row?.id ? Number(row.id) : undefined,
    raw_material: Number(row?.raw_material ?? row?.material ?? row?.material_id ?? 0) || 0,
    raw_material_name:
      row?.raw_material_name ?? row?.material_name ?? row?.name
        ? String(row?.raw_material_name ?? row?.material_name ?? row?.name)
        : undefined,
    raw_material_currency: row?.raw_material_currency ? String(row.raw_material_currency) : undefined,
    raw_material_default_purchase_price:
      row?.raw_material_default_purchase_price === null || row?.raw_material_default_purchase_price === undefined
        ? null
        : Number(row.raw_material_default_purchase_price),
    qty_per_unit: String(row?.qty_per_unit ?? "0"),
    currency: row?.currency ? String(row.currency) : undefined,
    default_purchase_price:
      row?.default_purchase_price === null || row?.default_purchase_price === undefined
        ? null
        : Number(row.default_purchase_price),
    line_material_cost_estimate:
      row?.line_material_cost_estimate === null || row?.line_material_cost_estimate === undefined
        ? null
        : Number(row.line_material_cost_estimate),
    line_material_cost_display: row?.line_material_cost_display ? String(row.line_material_cost_display) : undefined,
  }
}

function normalizeRecipeListItem(row: any): RecipeListItem {
  const status = normalizeRecipeStatus(row?.status)
  return {
    id: Number(row?.id ?? 0) || 0,
    product: Number(row?.product ?? 0) || 0,
    product_name: String(row?.product_name ?? ""),
    name: row?.name ? String(row.name) : undefined,
    version: Number(row?.version ?? 0) || 0,
    status,
    is_active: row?.is_active === undefined ? status === "ACTIVE" : Boolean(row?.is_active),
    created_at: String(row?.created_at ?? ""),
    items_count: Number(row?.items_count ?? asArray(row?.items).length) || 0,
    unit_material_cost_by_currency: normalizeCostByCurrency(row?.unit_material_cost_by_currency),
    unit_material_cost_display: row?.unit_material_cost_display ? String(row.unit_material_cost_display) : undefined,
    cost_warnings: asArray<string>(row?.cost_warnings).map((x: any) => String(x)),
  }
}

function normalizeRecipeDetail(row: any): RecipeDetail {
  const status = normalizeRecipeStatus(row?.status)
  return {
    id: Number(row?.id ?? 0) || 0,
    product: Number(row?.product ?? 0) || 0,
    product_name: row?.product_name ? String(row.product_name) : undefined,
    name: row?.name ? String(row.name) : undefined,
    version: Number(row?.version ?? 0) || 0,
    status,
    is_active: row?.is_active === undefined ? status === "ACTIVE" : Boolean(row?.is_active),
    created_at: String(row?.created_at ?? ""),
    updated_at: row?.updated_at ? String(row.updated_at) : undefined,
    items: asArray(row?.items).map(normalizeRecipeItem),
    unit_material_cost_by_currency: normalizeCostByCurrency(row?.unit_material_cost_by_currency),
    unit_material_cost_display: row?.unit_material_cost_display ? String(row.unit_material_cost_display) : undefined,
    cost_warnings: asArray<string>(row?.cost_warnings).map((x: any) => String(x)),
  }
}

export const recipesApi = {
  async list(params?: RecipeListParams) {
    const res = await withEndpointFallback(EP.list, (url) => http.get<any>(url, toRecipeListParams(params)))
    const list = unwrapList<any>(res)
    return {
      rows: list.rows.map(normalizeRecipeListItem),
      count: list.count,
    }
  },

  async listAll(params?: Omit<RecipeListParams, "page">) {
    const firstResponse = await withEndpointFallback(EP.list, (url) =>
      http.get<any>(url, toRecipeListParams({ ...params, page: 1 }))
    )
    const firstPage = unwrapList<any>(firstResponse)

    if (Array.isArray(firstResponse)) {
      return { rows: firstPage.rows.map(normalizeRecipeListItem), count: firstPage.count }
    }

    const totalCount = Number(firstResponse?.count ?? firstPage.count)
    if (!Array.isArray(firstResponse?.results) || firstPage.rows.length >= totalCount) {
      return { rows: firstPage.rows.map(normalizeRecipeListItem), count: firstPage.rows.length }
    }

    const collected = [...firstPage.rows]
    for (let nextPage = 2; collected.length < totalCount; nextPage += 1) {
      const nextResponse = await withEndpointFallback(EP.list, (url) =>
        http.get<any>(url, toRecipeListParams({ ...params, page: nextPage }))
      )
      const nextPageRows = unwrapList<any>(nextResponse).rows
      if (nextPageRows.length === 0) break
      collected.push(...nextPageRows)
    }

    return { rows: collected.map(normalizeRecipeListItem), count: collected.length }
  },

  async listByProduct(productId: number) {
    let res: any
    try {
      res = await withEndpointFallback(EP.productRecipes(productId), (url) => http.get<any>(url))
    } catch {
      res = await withEndpointFallback(EP.list, (url) => http.get<any>(url, { product: productId }))
    }
    const list = unwrapList<any>(res)
    return {
      rows: list.rows.map(normalizeRecipeListItem),
      count: list.count,
    }
  },

  async read(id: number) {
    const res = await withEndpointFallback(EP.detail(id), (url) => http.get<any>(url))
    return normalizeRecipeDetail(res)
  },

  async update(id: number, payload: RecipePayload) {
    const res = await withEndpointFallback(EP.detail(id), (url) => submitRecipeRequest<any>("patch", url, payload))
    return normalizeRecipeDetail(res)
  },

  async createForProduct(productId: number, payload: RecipePayload) {
    const genericPayload = {
      ...payload,
      product: productId,
    }

    const res = await withEndpointFallback(EP.createGeneric, (url) => submitRecipeRequest<any>("post", url, genericPayload))

    if (res && typeof res === "object" && (res.id || res.items || res.product)) {
      if (Array.isArray(res?.items)) return normalizeRecipeDetail(res)
      if (res?.product && res?.version) {
        try {
          return await this.read(Number(res.id))
        } catch {
          return normalizeRecipeDetail(res)
        }
      }
    }

    const latest = await this.listByProduct(productId)
    const candidate = latest.rows
      .slice()
      .sort((a, b) => {
        if (b.version !== a.version) return b.version - a.version
        return b.id - a.id
      })[0]

    if (!candidate?.id) throw new Error("Yaratilgan recipe topilmadi")
    return this.read(candidate.id)
  },

  async activate(id: number) {
    const res = await withEndpointFallback(EP.detail(id), (url) => http.patch<any>(url, { status: "ACTIVE" }))
    return normalizeRecipeDetail(res)
  },

  async remove(id: number) {
    return withEndpointFallback(EP.detail(id), (url) => http.delete<void>(url))
  },
}
