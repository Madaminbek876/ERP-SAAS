import { http } from "@/shared/http"
import { warehouseEvents } from "@/pages/sklad/warehouse/api/events"

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] }

function unwrapList<T>(res: any): T[] {
  const data = res?.data ?? res
  if (Array.isArray(data)) return data as T[]
  if (data && Array.isArray(data.results)) return data.results as T[]
  return []
}

export type UomRow = { id: number; name: string; code?: string }
export type MaterialTypeRow = { id: number; name: string }
export type ProductCategoryRow = { id: number;  name: string }
export type WarehouseLocationRow = { id: number;  name: string }

type CreatePayload = { name: string; code?: string }
type PatchPayload = Partial<CreatePayload>

const ENDPOINTS = {
  uom: ["/api/v1/dicts/uom/"],
  productCategory: ["/api/v1/dicts/product-categories/"],
  warehouseLocation: ["/api/v1/dicts/locations/"],
}

const detailUrl = (base: string, id: number) => `${base}${id}/`
const restoreUrl = (base: string, id: number) => `${base}${id}/restore/`

function isNotFound(error: any) {
  const status = Number(error?.response?.status || 0)
  return status === 404 || status === 405
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

function normalizeWarehouseLocationRow(row: any): WarehouseLocationRow {
  return {
    id: Number(row?.id ?? row?.value ?? row?.location_id ?? 0) || 0,
    name: String(row?.name ?? row?.label ?? row?.title ?? `Location #${row?.id ?? row?.value ?? "-"}`),
  }
}

function isHiddenDefaultWarehouseName(name: string | undefined) {
  const normalized = String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  return normalized === "warehouse 1" || normalized === "склад производства" || normalized === "склад сырья"
}

function normalizeUomRow(row: any): UomRow {
  return {
    id: Number(row?.id ?? row?.value ?? 0) || 0,
    code: row?.code ? String(row.code) : undefined,
    name: String(row?.name ?? row?.label ?? row?.title ?? `UOM #${row?.id ?? row?.value ?? "-"}`),
  }
}

function normalizeMaterialTypeRow(row: any): MaterialTypeRow {
  return {
    id: Number(row?.id ?? row?.value ?? 0) || 0,
    name: String(row?.name ?? row?.label ?? row?.title ?? `Material type #${row?.id ?? row?.value ?? "-"}`),
  }
}

function normalizeProductCategoryRow(row: any): ProductCategoryRow {
  return {
    id: Number(row?.id ?? row?.value ?? 0) || 0,
    name: String(row?.name ?? row?.label ?? row?.title ?? `Category #${row?.id ?? row?.value ?? "-"}`),
  }
}

function cleanNameOnlyPayload(payload: CreatePayload | PatchPayload) {
  return payload?.name === undefined ? {} : { name: String(payload.name).trim() }
}

function cleanUomPayload(payload: CreatePayload | PatchPayload) {
  return {
    ...(payload?.name === undefined ? {} : { name: String(payload.name).trim() }),
    ...(payload?.code === undefined ? {} : { code: String(payload.code).trim() }),
  }
}

function cleanWarehouseLocationPayload(payload: CreatePayload | PatchPayload) {
  return payload?.name === undefined ? {} : { name: String(payload.name).trim() }
}

export const dictsApi = {
  async listUom() {
    const res = await withEndpointFallback(ENDPOINTS.uom, (base) =>
      http.get<Paginated<UomRow> | UomRow[] | any>(base)
    )
    return unwrapList<any>(res).map(normalizeUomRow).filter((row) => row.id > 0)
  },
  async createUom(payload: CreatePayload) {
    const created = await withEndpointFallback(ENDPOINTS.uom, (base) =>
      http.post<UomRow>(base, cleanUomPayload(payload))
    )
    return normalizeUomRow(created)
  },
  async getUom(id: number) {
    const row = await withEndpointFallback(ENDPOINTS.uom, (base) =>
      http.get<UomRow>(detailUrl(base, id))
    )
    return normalizeUomRow(row)
  },
  async patchUom(id: number, payload: PatchPayload) {
    const updated = await withEndpointFallback(ENDPOINTS.uom, (base) =>
      http.patch<UomRow>(detailUrl(base, id), cleanUomPayload(payload))
    )
    return normalizeUomRow(updated)
  },
  async deleteUom(id: number) {
    return withEndpointFallback(ENDPOINTS.uom, (base) => http.delete<void>(detailUrl(base, id)))
  },
  async restoreUom(id: number) {
    const restored = await withEndpointFallback(ENDPOINTS.uom, (base) =>
      http.post<UomRow>(restoreUrl(base, id), {})
    )
    return normalizeUomRow(restored)
  },

  async listMaterialTypes() {
    return [] as MaterialTypeRow[]
  },
  async createMaterialType(payload: CreatePayload) {
    void payload
    throw new Error("Material type endpoint backendda mavjud emas.")
  },
  async getMaterialType(id: number) {
    void id
    throw new Error("Material type endpoint backendda mavjud emas.")
  },
  async patchMaterialType(id: number, payload: PatchPayload) {
    void id
    void payload
    throw new Error("Material type endpoint backendda mavjud emas.")
  },
  async deleteMaterialType(id: number) {
    void id
    throw new Error("Material type endpoint backendda mavjud emas.")
  },
  async restoreMaterialType(id: number) {
    void id
    throw new Error("Material type endpoint backendda mavjud emas.")
  },

  async listProductCategories() {
    const res = await withEndpointFallback(ENDPOINTS.productCategory, (base) =>
      http.get<Paginated<ProductCategoryRow> | ProductCategoryRow[] | any>(base)
    )
    return unwrapList<any>(res).map(normalizeProductCategoryRow).filter((row) => row.id > 0)
  },
  async createProductCategory(payload: CreatePayload) {
    const created = await withEndpointFallback(ENDPOINTS.productCategory, (base) =>
      http.post<ProductCategoryRow>(base, cleanNameOnlyPayload(payload))
    )
    return normalizeProductCategoryRow(created)
  },
  async getProductCategory(id: number) {
    const row = await withEndpointFallback(ENDPOINTS.productCategory, (base) =>
      http.get<ProductCategoryRow>(detailUrl(base, id))
    )
    return normalizeProductCategoryRow(row)
  },
  async patchProductCategory(id: number, payload: PatchPayload) {
    const updated = await withEndpointFallback(ENDPOINTS.productCategory, (base) =>
      http.patch<ProductCategoryRow>(detailUrl(base, id), cleanNameOnlyPayload(payload))
    )
    return normalizeProductCategoryRow(updated)
  },
  async deleteProductCategory(id: number) {
    return withEndpointFallback(ENDPOINTS.productCategory, (base) =>
      http.delete<void>(detailUrl(base, id))
    )
  },
  async restoreProductCategory(id: number) {
    return withEndpointFallback(ENDPOINTS.productCategory, (base) =>
      http.post<ProductCategoryRow>(restoreUrl(base, id), {})
    )
  },

  async listWarehouseLocations() {
    const res = await withEndpointFallback(ENDPOINTS.warehouseLocation, (base) =>
      http.get<Paginated<WarehouseLocationRow> | WarehouseLocationRow[] | any>(base)
    )
    return unwrapList<any>(res)
      .map(normalizeWarehouseLocationRow)
      .filter((row) => row.id > 0 && !isHiddenDefaultWarehouseName(row.name))
  },
  async createWarehouseLocation(payload: CreatePayload) {
    const created = await withEndpointFallback(ENDPOINTS.warehouseLocation, (base) =>
      http.post<WarehouseLocationRow>(base, cleanWarehouseLocationPayload(payload))
    )
    warehouseEvents.emit()
    return normalizeWarehouseLocationRow(created)
  },
  async getWarehouseLocation(id: number) {
    const row = await withEndpointFallback(ENDPOINTS.warehouseLocation, (base) =>
      http.get<WarehouseLocationRow>(detailUrl(base, id))
    )
    return normalizeWarehouseLocationRow(row)
  },
  async patchWarehouseLocation(id: number, payload: PatchPayload) {
    const updated = await withEndpointFallback(ENDPOINTS.warehouseLocation, (base) =>
      http.patch<WarehouseLocationRow>(detailUrl(base, id), cleanWarehouseLocationPayload(payload))
    )
    warehouseEvents.emit()
    return normalizeWarehouseLocationRow(updated)
  },
  async deleteWarehouseLocation(id: number) {
    const result = await withEndpointFallback(ENDPOINTS.warehouseLocation, (base) =>
      http.delete<void>(detailUrl(base, id))
    )
    warehouseEvents.emit()
    return result
  },
  async restoreWarehouseLocation(id: number) {
    const restored = await withEndpointFallback(ENDPOINTS.warehouseLocation, (base) =>
      http.post<WarehouseLocationRow>(restoreUrl(base, id), {})
    )
    warehouseEvents.emit()
    return normalizeWarehouseLocationRow(restored)
  },
}
