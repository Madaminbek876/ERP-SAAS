import { http } from "@/shared/http"
import { warehouseEvents } from "@/pages/sklad/warehouse/api/events"
import type {
  ChoiceOption,
  ProductionBatch,
  ProductionCancelPayload,
  ProductionConsumption,
  ProductionCreatePayload,
  ProductionDetail,
  ProductionDonePayload,
  ProductionFilters,
  ProductionMeta,
  ProductionPreview,
  ProductionPreviewMissing,
  ProductionUpdatePayload,
} from "../types/production.types"
import {
  FALLBACK_CURRENCY_CHOICES,
  getFallbackStatusChoices,
  getStatusLabel,
  normalizeProductionStatus,
  toNumber,
  toDecimalString,
} from "../utils/production.utils"

const BASE = ""

function unwrapList<T = any>(res: any): { rows: T[]; count: number; next: string | null; previous: string | null } {
  if (Array.isArray(res)) return { rows: res as T[], count: res.length, next: null, previous: null }
  if (res && Array.isArray(res.results)) {
    return {
      rows: res.results as T[],
      count: Number(res.count ?? res.results.length),
      next: typeof res.next === "string" ? res.next : null,
      previous: typeof res.previous === "string" ? res.previous : null,
    }
  }
  return { rows: [], count: 0, next: null, previous: null }
}

function normalizeChoice(value: any): ChoiceOption {
  if (Array.isArray(value)) {
    return {
      value: String(value[0] ?? ""),
      label: String(value[1] ?? value[0] ?? ""),
    }
  }

  if (value && typeof value === "object") {
    return {
      value: String(value.value ?? value.id ?? value.key ?? value.code ?? ""),
      label: String(value.label ?? value.name ?? value.title ?? value.value ?? value.id ?? ""),
    }
  }

  return {
    value: String(value ?? ""),
    label: String(value ?? ""),
  }
}

function normalizeStatusChoice(value: any): ChoiceOption {
  const choice = normalizeChoice(value)
  const normalizedValue = normalizeProductionStatus(choice.value || choice.label)

  return {
    value: normalizedValue,
    label: choice.label || getStatusLabel(normalizedValue),
  }
}

function normalizeMissing(row: any): ProductionPreviewMissing {
  const required = row?.qty_required ?? row?.required_qty ?? row?.required ?? row?.qty_needed ?? row?.need ?? 0
  const available = row?.qty_available ?? row?.available_qty ?? row?.available ?? row?.have ?? 0
  const shortfall = row?.shortfall ?? row?.shortage ?? row?.missing_qty ?? Number(required) - Number(available)

  return {
    raw_material:
      row?.raw_material_id === null || row?.raw_material_id === undefined
        ? row?.raw_material === null || row?.raw_material === undefined
          ? null
          : Number(row.raw_material)
        : Number(row.raw_material_id),
    raw_material_name: String(row?.raw_material_name ?? row?.material_name ?? row?.name ?? ""),
    qty_required: String(required ?? "0"),
    qty_available: String(available ?? "0"),
    shortfall: String(shortfall ?? "0"),
  }
}

function asObject(value: any): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null
}

function firstString(...values: any[]): string | null {
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

function toNullableNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function firstNumber(...values: any[]): number | null {
  for (const value of values) {
    const parsed = toNullableNumber(value)
    if (parsed !== null) return parsed
  }
  return null
}

function extractLookupLabel(value: any): string | null {
  const nested = asObject(value)
  if (!nested) return firstString(value)
  return firstString(nested.label, nested.name, nested.title, nested.value, nested.code)
}

function extractLookupId(value: any): number | null {
  const nested = asObject(value)
  return toNullableNumber(nested ? nested.id ?? nested.value ?? nested.pk : value)
}

function normalizeConsumption(row: any, index: number): ProductionConsumption {
  const rawMaterial = asObject(row?.raw_material)
  const material = asObject(row?.material)
  const rawMaterialDetail = asObject(row?.raw_material_detail)
  const relatedMaterial = rawMaterial ?? material ?? rawMaterialDetail
  const rawMaterialId =
    extractLookupId(row?.raw_material_id) ??
    extractLookupId(row?.raw_material) ??
    extractLookupId(row?.material_id) ??
    extractLookupId(row?.material) ??
    extractLookupId(row?.raw_material_detail)
  const uom = asObject(row?.uom) ?? asObject(relatedMaterial?.uom) ?? asObject(row?.unit)
  const qtyUsedRaw = row?.qty_used ?? row?.quantity ?? row?.qty ?? row?.amount_qty ?? "0.000000"
  const qtyUsed = String(qtyUsedRaw ?? "0.000000")
  const unitCost = firstNumber(
    row?.unit_cost,
    row?.avg_unit_cost,
    row?.avg_cost,
    row?.cost_per_unit,
    row?.unit_price,
    row?.cost,
    relatedMaterial?.unit_cost,
    relatedMaterial?.avg_unit_cost
  )
  const totalCost =
    firstNumber(
      row?.total_cost,
      row?.line_total,
      row?.total,
      row?.amount,
      row?.value,
      row?.total_amount,
      row?.line_amount
    ) ??
    (unitCost !== null && toNullableNumber(qtyUsedRaw) !== null ? unitCost * Number(qtyUsedRaw) : null)

  return {
    id: row?.id ?? `${rawMaterialId ?? "line"}-${index}`,
    raw_material: rawMaterialId,
    raw_material_name:
      firstString(
        row?.raw_material_name,
        row?.material_name,
        row?.name,
        relatedMaterial?.name,
        relatedMaterial?.title
      ) ?? null,
    qty_used: qtyUsed,
    uom_name:
      firstString(
        row?.uom_name,
        row?.raw_material_uom_name,
        row?.uom_label,
        row?.uom,
        row?.unit_name,
        row?.unit,
        relatedMaterial?.uom_name,
        relatedMaterial?.uom_label,
        relatedMaterial?.uom,
        extractLookupLabel(uom)
      ) ?? null,
    unit_cost: unitCost,
    total_cost: totalCost,
    currency: firstString(row?.currency, row?.unit_cost_currency, relatedMaterial?.currency) ?? null,
  }
}

function normalizeBatch(row: any): ProductionBatch {
  return {
    id: Number(row?.id ?? 0),
    batch_no: String(row?.batch_no ?? ""),
    status: normalizeProductionStatus(row?.status),
    product: row?.product === null || row?.product === undefined ? null : Number(row.product),
    product_name: String(row?.product_name ?? ""),
    recipe: row?.recipe === null || row?.recipe === undefined ? null : Number(row.recipe),
    recipe_name: row?.recipe_name ? String(row.recipe_name) : null,
    qty_produced: String(row?.qty_produced ?? "0.000000"),
    qty_actual: String(row?.qty_actual ?? "0.000000"),
    qty_waste: String(row?.qty_waste ?? "0.000000"),
    production_date: String(row?.production_date ?? ""),
    location: row?.location === null || row?.location === undefined ? null : Number(row.location),
    location_name: String(row?.location_name ?? ""),
    output_location:
      row?.output_location === null || row?.output_location === undefined ? null : Number(row.output_location),
    output_location_name: String(row?.output_location_name ?? ""),
    waste_location:
      row?.waste_location === null || row?.waste_location === undefined ? null : Number(row.waste_location),
    waste_location_name: row?.waste_location_name ? String(row.waste_location_name) : null,
    notes: String(row?.notes ?? ""),
    materials_cost_total: toNumber(row?.materials_cost_total),
    extra_cost_total: toNumber(row?.extra_cost_total),
    total_cost: toNumber(row?.total_cost),
    unit_cost: toNumber(row?.unit_cost),
    currency: String(row?.currency ?? "UZS"),
    confirmed_at: row?.confirmed_at ? String(row.confirmed_at) : null,
    started_at: row?.started_at ? String(row.started_at) : null,
    done_at: row?.done_at ? String(row.done_at) : null,
    cancelled_at: row?.cancelled_at ? String(row.cancelled_at) : null,
    created_at: String(row?.created_at ?? ""),
    updated_at: String(row?.updated_at ?? ""),
  }
}

function normalizeDetail(row: any): ProductionDetail {
  return {
    ...normalizeBatch(row),
    consumptions: Array.isArray(row?.consumptions) ? row.consumptions.map(normalizeConsumption) : [],
    cancel_reason: row?.cancel_reason ? String(row.cancel_reason) : null,
  }
}

function normalizePreview(row: any): ProductionPreview {
  const missing = Array.isArray(row?.missing) ? row.missing.map(normalizeMissing) : []
  return {
    can_confirm: Boolean(row?.can_confirm),
    missing,
    materials_cost_estimate: toNumber(row?.materials_cost_estimate),
    extra_cost_total: toNumber(row?.extra_cost_total),
    total_cost_estimate: toNumber(row?.total_cost_estimate),
    unit_cost_estimate: toNumber(row?.unit_cost_estimate),
  }
}

function buildListParams(filters: ProductionFilters) {
  const params: Record<string, string | number> = {}
  if (filters.search.trim()) params.search = filters.search.trim()
  if (filters.status !== "ALL") params.status = normalizeProductionStatus(filters.status)
  params.ordering = "-production_date"
  return params
}

function toCreateBody(payload: ProductionCreatePayload | ProductionUpdatePayload) {
  const body: Record<string, unknown> = {}
  if (payload.product !== undefined) body.product = payload.product
  if (payload.recipe !== undefined) body.recipe = payload.recipe
  if (payload.qty_produced !== undefined) body.qty_produced = toDecimalString(payload.qty_produced)
  if (payload.production_date !== undefined) body.production_date = payload.production_date
  if (payload.location !== undefined) body.location = payload.location
  if (payload.output_location !== undefined) body.output_location = payload.output_location
  if (payload.notes !== undefined) body.notes = payload.notes
  if (payload.extra_cost_total !== undefined) body.extra_cost_total = toNumber(payload.extra_cost_total)
  if (payload.currency !== undefined) body.currency = payload.currency
  return body
}

export async function listProductionOrders(filters: ProductionFilters) {
  const allRows: any[] = []
  const normalizedStatusFilter = filters.status === "ALL" ? "ALL" : normalizeProductionStatus(filters.status)
  let page = 1
  let totalCount = Number.POSITIVE_INFINITY

  while (page <= 100 && allRows.length < totalCount) {
    const res = await http.get<any>(BASE, { ...buildListParams(filters), page })
    const current = unwrapList<any>(res)
    totalCount = Math.max(Number(current.count || allRows.length), allRows.length)
    allRows.push(...current.rows)

    if (!current.rows.length) break
    if (!current.next && allRows.length >= totalCount) break
    if (current.rows.length > 0 && !current.next && current.count === 0) break

    page += 1
  }

  return allRows
    .map(normalizeBatch)
    .filter((row) => {
      if (normalizedStatusFilter !== "ALL" && row.status !== normalizedStatusFilter) return false
      if (filters.product !== "ALL" && row.product !== filters.product) return false
      if (filters.location !== "ALL" && row.location !== filters.location) return false
      if (filters.dateFrom && row.production_date && row.production_date < filters.dateFrom) return false
      if (filters.dateTo && row.production_date && row.production_date > filters.dateTo) return false
      return true
    })
}

export async function getProductionOrder(id: number) {
  const res = await http.get<any>(`${BASE}${id}/`)
  return normalizeDetail(res)
}

export async function createProductionOrder(payload: ProductionCreatePayload) {
  const res = await http.post<any>(BASE, toCreateBody(payload))
  const created = normalizeDetail(res)
  warehouseEvents.emit()
  return created
}

export async function updateProductionOrder(id: number, payload: ProductionUpdatePayload) {
  const res = await http.patch<any>(`${BASE}${id}/`, toCreateBody(payload))
  const updated = normalizeDetail(res)
  warehouseEvents.emit()
  return updated
}

export async function deleteProductionOrder(id: number) {
  const result = await http.delete<void>(`${BASE}${id}/`)
  warehouseEvents.emit()
  return result
}

export async function previewProductionOrder(id: number) {
  const res = await http.patch<any>(`${BASE}${id}/preview/`, {})
  return normalizePreview(res)
}

export async function confirmProductionOrder(id: number) {
  const result = await http.patch<any>(`${BASE}${id}/confirm/`, {})
  warehouseEvents.emit()
  return result
}

export async function startProductionOrder(id: number) {
  const result = await http.patch<any>(`${BASE}${id}/start/`, {})
  warehouseEvents.emit()
  return result
}

export async function doneProductionOrder(id: number, payload: ProductionDonePayload) {
  const body: Record<string, unknown> = {}
  if (payload.qty_actual !== undefined) body.qty_actual = toDecimalString(payload.qty_actual)
  if (payload.qty_waste !== undefined) body.qty_waste = toDecimalString(payload.qty_waste)
  if (payload.waste_location !== undefined) body.waste_location = payload.waste_location
  const result = await http.patch<any>(`${BASE}${id}/done/`, body)
  warehouseEvents.emit()
  return result
}

export async function cancelProductionOrder(id: number, payload: ProductionCancelPayload) {
  const result = await http.patch<any>(`${BASE}${id}/cancel/`, payload)
  warehouseEvents.emit()
  return result
}

export async function getProductionMeta(): Promise<ProductionMeta> {
  try {
    const res = await http.get<any>(`${BASE}meta/`)
    const statusChoicesRaw = Array.isArray(res?.status_choices) ? res.status_choices : []
    const currencyChoicesRaw = Array.isArray(res?.currency_choices) ? res.currency_choices : []
    const statusChoiceEntries = statusChoicesRaw
      .map((item: any): ChoiceOption => normalizeStatusChoice(item))
      .filter((item: ChoiceOption): item is ChoiceOption => Boolean(item.value))
    const normalizedStatusChoices = Array.from(
      new Map<string, ChoiceOption>(
        statusChoiceEntries.map((item: ChoiceOption): [string, ChoiceOption] => [item.value, item])
      ).values()
    )
    return {
      status_choices: normalizedStatusChoices.length > 0 ? normalizedStatusChoices : getFallbackStatusChoices(),
      currency_choices: currencyChoicesRaw.map(normalizeChoice).filter((item: ChoiceOption) => item.value),
    }
  } catch {
    return {
      status_choices: getFallbackStatusChoices(),
      currency_choices: FALLBACK_CURRENCY_CHOICES,
    }
  }
}
