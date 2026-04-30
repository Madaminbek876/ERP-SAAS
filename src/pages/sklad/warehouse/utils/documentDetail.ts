import { warehouseApi } from "../api/warehouseApi"

export type WarehouseDocumentMode = "transfer" | "writeoff" | "inventory"

export type WarehouseDocumentSourceRow = {
  id?: number | string
  type?: string
  movement_type?: string
  item_type?: string
  item_id?: number | string
  itemName?: string
  product_name?: string
  raw_material_name?: string
  item_name?: string
  location?: number | string
  location_name?: string
  from_location?: number | string
  to_location?: number | string
  from_location_name?: string
  to_location_name?: string
  qty?: number | string
  occurred_at?: string
  created_at?: string
  quantity?: number | string
  unit_cost?: number | string
  line_total?: number | string
  total?: number | string
  amount?: number | string
  total_cost?: number | string
  currency?: string
  ref_type?: string
  ref_id?: number | string | null
  date?: string
  note?: string
  location_id?: number | string
  from_location_id?: number | string
  to_location_id?: number | string
  uom_name?: string
  uom?: string
  unit_name?: string
  unit?: string
  [key: string]: unknown
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toUpperCase()
}

function normalizeDocumentDate(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return date.toISOString().slice(0, 19)
}

function rowDate(row: WarehouseDocumentSourceRow) {
  return row.date ?? row.occurred_at ?? row.created_at ?? ""
}

function rowLocation(row: WarehouseDocumentSourceRow) {
  return Number(row.location ?? row.location_id ?? 0)
}

function rowFromLocation(row: WarehouseDocumentSourceRow) {
  return Number(row.from_location ?? row.from_location_id ?? row.location ?? row.location_id ?? 0)
}

function rowToLocation(row: WarehouseDocumentSourceRow) {
  return Number(row.to_location ?? row.to_location_id ?? 0)
}

export function documentGroupKey(row: WarehouseDocumentSourceRow, mode: WarehouseDocumentMode) {
  const refType = normalizeText(row.ref_type)
  const refId = Number(row.ref_id ?? 0)

  if (mode === "transfer") {
    if (refType === "MANUAL_TRANSFER" && refId > 0) return `TRANSFER:REF:${refId}`
    return [
      "TRANSFER",
      normalizeDocumentDate(rowDate(row)),
      rowFromLocation(row),
      rowToLocation(row),
      normalizeText(row.note),
    ].join(":")
  }

  if (mode === "writeoff") {
    if (refType === "MANUAL_WASTE" && refId > 0) return `WASTE:REF:${refId}`
    return [
      "WASTE",
      normalizeDocumentDate(rowDate(row)),
      rowLocation(row),
      normalizeText(row.note),
      normalizeText(row.movement_type),
    ].join(":")
  }

  return [
    "ADJUST",
    normalizeDocumentDate(rowDate(row)),
    rowLocation(row),
    normalizeText(row.note),
    normalizeText(row.movement_type || "ADJUST"),
  ].join(":")
}

export async function fetchWarehouseDocumentLines({
  mode,
  anchorRow,
  filterRefType,
  filterMovementType,
}: {
  mode: WarehouseDocumentMode
  anchorRow: WarehouseDocumentSourceRow
  filterRefType?: string
  filterMovementType?: string
}) {
  const anchorKey = documentGroupKey(anchorRow, mode)
  if (!anchorKey) return [anchorRow]

  const pageSize = 500
  let targetPage = 1
  let guard = 0
  const collected: WarehouseDocumentSourceRow[] = []

  while (guard < 100) {
    const params: Record<string, string | number> = {
      page: targetPage,
      page_size: pageSize,
    }

    if (mode === "transfer") {
      params.ref_type = filterRefType || "MANUAL_TRANSFER"
    } else if (mode === "writeoff") {
      if (filterRefType) params.ref_type = filterRefType
      else params.movement_type = filterMovementType || "WASTE"
    } else {
      params.movement_type = filterMovementType || "ADJUST"
    }

    const res = await warehouseApi.listMovementsPage(params)
    const pageRows = (res.results ?? []) as WarehouseDocumentSourceRow[]
    collected.push(...pageRows)

    if (!res.next || pageRows.length < pageSize || collected.length >= Number(res.count ?? 0)) {
      break
    }

    targetPage += 1
    guard += 1
  }

  const matched = collected.filter((row) => documentGroupKey(row, mode) === anchorKey)
  return matched.length > 0 ? matched : [anchorRow]
}

export function documentRowName(row: WarehouseDocumentSourceRow) {
  return String(row.itemName ?? row.item_name ?? row.product_name ?? row.raw_material_name ?? "-")
}

export function documentRowQty(row: WarehouseDocumentSourceRow) {
  return Number(row.qty ?? row.quantity ?? 0)
}

export function documentRowUnitCost(row: WarehouseDocumentSourceRow) {
  return Number(row.unit_cost ?? 0)
}

export function documentRowTotal(row: WarehouseDocumentSourceRow) {
  const directTotal = Number(row.line_total ?? row.total ?? row.total_cost ?? row.amount ?? 0)
  if (Number.isFinite(directTotal) && directTotal > 0) return directTotal
  const qty = documentRowQty(row)
  const unitCost = documentRowUnitCost(row)
  return qty * unitCost
}

export function documentRowUnit(row: WarehouseDocumentSourceRow) {
  return String(row.uom_name ?? row.uom ?? row.unit_name ?? row.unit ?? "dona")
}
