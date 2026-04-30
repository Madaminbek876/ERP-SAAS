import { api } from "@/lib/api"
import { unwrapResults } from "@/lib/unwrap"

export type OnHandRow = {
  item_type: "FINISHED_PRODUCT" | "PRODUCT" | "RAW_MATERIAL"
  product_id: number | null
  raw_material_id: number | null
  location_id: number | null
  item_name: string | null
  qty_onhand: string
  value_onhand: number
  avg_unit_cost: number
}

function normalizeItemType(row: any): OnHandRow["item_type"] {
  const itemType = String(row?.item_type ?? "").toUpperCase()

  if (itemType === "FINISHED_PRODUCT" || itemType === "PRODUCT" || itemType === "RAW_MATERIAL") {
    return itemType
  }

  return row?.product_id ?? row?.product ? "FINISHED_PRODUCT" : "RAW_MATERIAL"
}

function buildStockParams(params?: {
  warehouse?: number
  location?: number
  item_type?: "FINISHED_PRODUCT" | "PRODUCT" | "RAW_MATERIAL"
  q?: string
  product_id?: number
  raw_material_id?: number
}) {
  const next: Record<string, string | number> = {}
  if (!params) return next

  const location = Number(params.location ?? 0)
  const productId = Number(params.product_id ?? 0)
  const rawMaterialId = Number(params.raw_material_id ?? 0)
  const itemType = String(params.item_type ?? "").trim()
  const q = String(params.q ?? "").trim()

  if (location > 0) next.location = location
  if (itemType) next.item_type = itemType === "PRODUCT" ? "FINISHED_PRODUCT" : itemType
  if (q) next.q = q
  if (productId > 0) next.product_id = productId
  if (rawMaterialId > 0) next.raw_material_id = rawMaterialId

  return next
}

async function getStockData(params?: {
  warehouse?: number
  location?: number
  item_type?: "FINISHED_PRODUCT" | "PRODUCT" | "RAW_MATERIAL"
  q?: string
  product_id?: number
  raw_material_id?: number
}) {
  const query = buildStockParams(params)
  const candidates = ["/api/v1/warehouse/stock/"]
  let lastError: unknown = null

  for (const url of candidates) {
    try {
      const { data } = await api.get(url, { params: query })
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

  throw lastError ?? new Error("Warehouse stock endpoint topilmadi")
}

export async function fetchOnHand(params?: {
  warehouse?: number
  location?: number
  item_type?: "FINISHED_PRODUCT" | "PRODUCT" | "RAW_MATERIAL"
  q?: string
  product_id?: number
  raw_material_id?: number
}): Promise<OnHandRow[]> {
  const data = await getStockData(params)
  return unwrapResults<any>(data).map((x: any): OnHandRow => {
    return {
      item_type: normalizeItemType(x),
      product_id: Number(x?.product_id ?? x?.product ?? 0) || null,
      raw_material_id: Number(x?.raw_material_id ?? x?.raw_material ?? 0) || null,
      location_id: Number(x?.location_id ?? x?.location ?? 0) || null,
      item_name: String(x?.item_name ?? x?.product_name ?? x?.raw_material_name ?? "") || null,
      qty_onhand: String(x?.qty_onhand ?? x?.balance_qty ?? x?.qty ?? "0"),
      value_onhand:
        Number(x?.value_onhand ?? 0) ||
        Number(x?.avg_unit_cost ?? x?.unit_cost ?? 0) * Number(x?.qty_onhand ?? x?.balance_qty ?? x?.qty ?? 0),
      avg_unit_cost: Number(x?.avg_unit_cost ?? x?.unit_cost ?? 0) || 0,
    }
  })
}
